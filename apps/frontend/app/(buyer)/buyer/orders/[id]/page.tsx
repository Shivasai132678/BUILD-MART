'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { CheckCircle2, CreditCard, Loader2, X } from 'lucide-react';
import { cancelBuyerOrder, createPaymentOrder, fetchBuyerOrder, type OrderDetail } from '@/lib/buyer-api';
import { getApiErrorMessage } from '@/lib/api';
import { formatIST } from '@/lib/utils/date';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/utils';
import { useUserStore } from '@/store/user.store';

const pageV = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] } } };

// --- Razorpay Checkout types ---

type RazorpayCheckoutOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: () => void;
  modal: { ondismiss: () => void };
  prefill: { contact?: string; name?: string };
};

type RazorpayCheckoutInstance = {
  open: () => void;
  on: (event: string, handler: (response: { error?: { description?: string } }) => void) => void;
};

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && 'Razorpay' in window) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
    document.head.appendChild(script);
  });
}

function openRazorpayCheckout(options: RazorpayCheckoutOptions): RazorpayCheckoutInstance {
  const RazorpayConstructor = (window as unknown as Record<string, unknown>).Razorpay as
    | (new (opts: RazorpayCheckoutOptions) => RazorpayCheckoutInstance)
    | undefined;
  if (!RazorpayConstructor) {
    throw new Error('Razorpay SDK not loaded');
  }
  return new RazorpayConstructor(options);
}

type PaymentFlowState = 'idle' | 'creating' | 'polling' | 'success' | 'timeout';

function buildTimeline(order: OrderDetail) {
  const delivered = order.status === 'DELIVERED';
  const outForDelivery = order.status === 'OUT_FOR_DELIVERY' || delivered;
  return [
    { key: 'CONFIRMED', label: 'Order Confirmed', timestamp: order.confirmedAt, complete: true },
    { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', timestamp: order.dispatchedAt, complete: outForDelivery },
    { key: 'DELIVERED', label: 'Delivered', timestamp: order.deliveredAt, complete: delivered },
  ];
}

export default function BuyerOrderDetailPage() {
  const params = useParams<{ id: string | string[] }>();
  const queryClient = useQueryClient();
  const orderId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [paymentState, setPaymentState] = useState<PaymentFlowState>('idle');
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const user = useUserStore((s) => s.user);

  const orderQuery = useQuery({ queryKey: ['buyer-order', orderId], queryFn: () => fetchBuyerOrder(orderId), enabled: Boolean(orderId) });
  const cancelMutation = useMutation({
    mutationFn: () => cancelBuyerOrder(orderId),
    onSuccess: async () => { toast.success('Order cancelled'); setCancelDialogOpen(false); await queryClient.invalidateQueries({ queryKey: ['buyer-order', orderId] }); },
    onError: (error) => { toast.error(getApiErrorMessage(error)); },
  });

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  if (!orderId) return <EmptyState title="Invalid order ID" />;
  if (orderQuery.isLoading) return <div className="space-y-6"><SkeletonCard /><SkeletonCard /></div>;
  if (orderQuery.isError || !orderQuery.data) return <EmptyState title="Failed to load order" subtitle={getApiErrorMessage(orderQuery.error)} actionLabel="Back" actionHref="/buyer/orders" />;

  const order = orderQuery.data;
  const timeline = buildTimeline(order);
  const canCancel = order.status === 'CONFIRMED';
  const needsPayment = !order.payment || order.payment.status !== 'SUCCESS';

  const startPolling = () => {
    setPaymentState('polling');
    const startTime = Date.now();
    const POLL_INTERVAL_MS = 3_000;
    const POLL_TIMEOUT_MS = 60_000;

    pollingRef.current = setInterval(() => {
      void (async () => {
        try {
          const updated = await fetchBuyerOrder(orderId);
          if (updated.payment?.status === 'SUCCESS') {
            if (pollingRef.current) clearInterval(pollingRef.current);
            pollingRef.current = null;
            setPaymentState('success');
            void queryClient.invalidateQueries({ queryKey: ['buyer-order', orderId] });
            return;
          }
          if (updated.payment?.status === 'FAILED') {
            if (pollingRef.current) clearInterval(pollingRef.current);
            pollingRef.current = null;
            toast.error('Payment failed. Please try again.');
            setPaymentState('idle');
            void queryClient.invalidateQueries({ queryKey: ['buyer-order', orderId] });
            return;
          }
        } catch {
          // Continue polling on transient network errors
        }

        if (Date.now() - startTime >= POLL_TIMEOUT_MS) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          pollingRef.current = null;
          setPaymentState('timeout');
          void queryClient.invalidateQueries({ queryKey: ['buyer-order', orderId] });
        }
      })();
    }, POLL_INTERVAL_MS);
  };

  const handlePayNow = async () => {
    setPaymentState('creating');
    try {
      const paymentOrder = await createPaymentOrder(orderId);
      await loadRazorpayScript();

      const rzp = openRazorpayCheckout({
        key: paymentOrder.key,
        amount: paymentOrder.amount,
        currency: paymentOrder.currency,
        name: 'BuildMart',
        description: `Order #${orderId.slice(0, 10)}`,
        order_id: paymentOrder.razorpayOrderId,
        handler: () => {
          startPolling();
        },
        modal: {
          ondismiss: () => {
            setPaymentState('idle');
          },
        },
        prefill: {
          contact: user?.phone,
          name: user?.name,
        },
      });

      rzp.on('payment.failed', (response) => {
        toast.error(response.error?.description ?? 'Payment failed. Please try again.');
        setPaymentState('idle');
      });

      rzp.open();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'Failed to initiate payment'));
      setPaymentState('idle');
    }
  };

  return (
    <motion.div className="space-y-6" variants={pageV} initial="hidden" animate="visible">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="text-xs font-mono text-text-tertiary bg-elevated px-2 py-0.5 rounded">Order #{order.id.slice(0, 10)}</span>
          <h1 className="mt-2 text-3xl font-bold text-text-primary">₹{Number(order.totalAmount).toLocaleString('en-IN')}</h1>
          <p className="mt-1 text-sm text-text-secondary">Created {formatIST(order.createdAt)}</p>
        </div>
        <Badge status={order.status} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Timeline */}
          <div className="card p-5">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Order Timeline</h2>
            {order.status === 'CANCELLED' && (
              <div className="mb-4 rounded-xl bg-danger/10 border border-danger/20 px-4 py-3 text-sm text-danger">
                Cancelled{order.cancelledAt ? ` on ${formatIST(order.cancelledAt)}` : ''}{order.cancelReason ? ` · ${order.cancelReason}` : ''}
              </div>
            )}
            <ol className="space-y-0">
              {timeline.map((step, i) => (
                <li key={step.key} className="flex gap-3.5">
                  <div className="flex flex-col items-center">
                    <div className={cn('h-3 w-3 rounded-full mt-1', step.complete ? 'bg-success' : 'bg-border-strong')} />
                    {i < timeline.length - 1 && <div className={cn('w-0.5 flex-1 my-1 min-h-[32px]', step.complete ? 'bg-success' : 'bg-border-subtle')} />}
                  </div>
                  <div className="pb-4">
                    <p className={cn('text-sm font-medium', step.complete ? 'text-text-primary' : 'text-text-tertiary')}>{step.label}</p>
                    <p className="text-xs text-text-tertiary">{step.timestamp ? formatIST(step.timestamp) : 'Pending'}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {order.quote && (order.quote.items?.length ?? 0) > 0 && (
            <div className="card p-5">
              <h2 className="text-lg font-semibold text-text-primary mb-3">Order Items</h2>
              <div className="space-y-2">
                {(order.quote.items ?? []).map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-xl bg-elevated border border-border-subtle px-4 py-3 text-sm">
                    <span className="font-medium text-text-primary">{item.productName}</span>
                    <span className="text-text-secondary">{item.quantity} {item.unit} × ₹{item.unitPrice}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="card p-5 sticky top-24 space-y-4">
            <h3 className="text-sm font-semibold text-text-primary">Order Summary</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-text-secondary">Total</span><span className="font-semibold text-text-primary">₹{order.totalAmount}</span></div>
              <div className="flex justify-between"><span className="text-text-secondary">Payment</span>{order.payment ? <Badge status={order.payment.status} /> : <span className="text-text-tertiary">Not initiated</span>}</div>
              <div className="flex justify-between"><span className="text-text-secondary">Vendor</span><span className="font-mono text-xs text-text-tertiary">#{order.vendorId.slice(0, 8)}</span></div>
            </div>
            {paymentState === 'polling' && (
              <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700">
                <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Confirming payment…</div>
              </div>
            )}
            {paymentState === 'success' && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />Payment confirmed!
              </div>
            )}
            {paymentState === 'timeout' && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
                Payment received but confirmation is delayed. Please refresh in a few moments.
              </div>
            )}
            {needsPayment && order.status !== 'CANCELLED' && (paymentState === 'idle' || paymentState === 'creating') && (
              <Button className="w-full" loading={paymentState === 'creating'} disabled={paymentState === 'creating'} onClick={() => void handlePayNow()}><CreditCard className="h-4 w-4" />Pay Now</Button>
            )}
            {canCancel && <Button variant="danger" className="w-full" loading={cancelMutation.isPending} onClick={() => setCancelDialogOpen(true)}><X className="h-4 w-4" />Cancel Order</Button>}
            <Link href="/buyer/orders" className="block text-center text-sm font-medium text-text-secondary hover:text-text-primary transition-colors">← Back to Orders</Link>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={cancelDialogOpen}
        onClose={() => setCancelDialogOpen(false)}
        onConfirm={() => cancelMutation.mutate()}
        title="Cancel this order?"
        description="This action cannot be undone. The order will be permanently cancelled."
        confirmLabel="Cancel Order"
        cancelLabel="Keep Order"
        variant="danger"
        loading={cancelMutation.isPending}
      />
    </motion.div>
  );
}
