'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { cancelBuyerOrder, createPaymentOrder, fetchBuyerOrder, type OrderDetail } from '@/lib/buyer-api';
import { getApiErrorMessage } from '@/lib/api';
import { formatIST } from '@/lib/utils/date';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useUserStore } from '@/store/user.store';

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

function OrderStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    CONFIRMED: 'bg-green-500/15 text-green-400 border border-green-500/30',
    OUT_FOR_DELIVERY: 'bg-[#D97706]/15 text-[#F59E0B] border border-[#D97706]/30',
    DELIVERED: 'bg-green-600/15 text-green-300 border border-green-600/30',
    CANCELLED: 'bg-red-500/10 text-red-400 border border-red-500/20',
    SUCCESS: 'bg-green-500/15 text-green-400 border border-green-500/30',
    PENDING: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
    FAILED: 'bg-red-500/10 text-red-400 border border-red-500/20',
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${map[status] ?? 'bg-[#3A3027]/50 text-[#A89F91]'}`}>{status}</span>;
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

  if (!orderId) return (
    <div className="bg-[#1A1714] border border-[#2A2520] rounded-2xl p-12 text-center">
      <span className="material-symbols-outlined text-4xl text-[#7A7067]">error</span>
      <p className="mt-3 font-semibold text-[#F5F0E8]">Invalid order ID</p>
    </div>
  );
  if (orderQuery.isLoading) return (
    <div className="space-y-4">
      {[1, 2].map((i) => <div key={i} className="bg-[#1A1714] border border-[#2A2520] rounded-2xl h-40 animate-pulse" />)}
    </div>
  );
  if (orderQuery.isError || !orderQuery.data) return (
    <div className="bg-[#1A1714] border border-[#2A2520] rounded-2xl p-12 text-center">
      <span className="material-symbols-outlined text-4xl text-[#7A7067]">error</span>
      <p className="mt-3 font-semibold text-[#F5F0E8]">Failed to load order</p>
      <p className="mt-1 text-sm text-[#A89F91]">{orderQuery.error ? getApiErrorMessage(orderQuery.error) : 'Order not found'}</p>
      <Link href="/buyer/orders" className="mt-4 inline-block text-sm font-medium text-[#D97706]">← Back to Orders</Link>
    </div>
  );

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
    <div className="space-y-6">
      {/* Back nav */}
      <Link href="/buyer/orders" className="inline-flex items-center gap-1.5 text-sm text-[#A89F91] hover:text-[#F5F0E8] transition-colors">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        All Orders
      </Link>

      {/* Order header */}
      <div className="bg-[#1A1714] border border-[#2A2520] rounded-2xl p-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#2A2520] text-[#7A7067]">Order #{order.id.slice(0, 10)}</span>
          <h1 className="mt-2 text-3xl font-bold text-[#F5F0E8]">₹{Number(order.totalAmount).toLocaleString('en-IN')}</h1>
          <p className="mt-1 text-sm text-[#A89F91]">Created {formatIST(order.createdAt)}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Timeline */}
          <div className="bg-[#1A1714] border border-[#2A2520] rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-[#F5F0E8] mb-4">Order Timeline</h2>
            {order.status === 'CANCELLED' && (
              <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                Cancelled{order.cancelledAt ? ` on ${formatIST(order.cancelledAt)}` : ''}{order.cancelReason ? ` · ${order.cancelReason}` : ''}
              </div>
            )}
            <ol className="space-y-0">
              {timeline.map((step, i) => (
                <li key={step.key} className="flex gap-3.5">
                  <div className="flex flex-col items-center">
                    <div className={`h-3 w-3 rounded-full mt-1 ${step.complete ? 'bg-green-500' : 'bg-[#3A3027]'}`} />
                    {i < timeline.length - 1 && (
                      <div className={`w-0.5 flex-1 my-1 min-h-[32px] ${step.complete ? 'bg-green-500/40' : 'bg-[#2A2520]'}`} />
                    )}
                  </div>
                  <div className="pb-4">
                    <p className={`text-sm font-medium ${step.complete ? 'text-[#F5F0E8]' : 'text-[#7A7067]'}`}>{step.label}</p>
                    <p className="text-xs text-[#7A7067]">{step.timestamp ? formatIST(step.timestamp) : 'Pending'}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Order items */}
          {order.quote && (order.quote.items?.length ?? 0) > 0 && (
            <div className="bg-[#1A1714] border border-[#2A2520] rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-[#F5F0E8] mb-3">Order Items</h2>
              <div className="space-y-2">
                {(order.quote.items ?? []).map((item) => (
                  <div key={item.id} className="flex items-center justify-between bg-[#211E19] border border-[#2A2520] rounded-xl px-4 py-3 text-sm">
                    <span className="font-medium text-[#F5F0E8]">{item.productName}</span>
                    <span className="text-[#A89F91]">{item.quantity} {item.unit} × ₹{item.unitPrice}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div>
          <div className="bg-[#1A1714] border border-[#2A2520] rounded-2xl p-6 sticky top-24 space-y-4">
            <h3 className="text-sm font-semibold text-[#F5F0E8]">Order Summary</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-[#A89F91]">Total</span>
                <span className="font-semibold text-[#F5F0E8]">₹{Number(order.totalAmount).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#A89F91]">Payment</span>
                {order.payment ? <OrderStatusBadge status={order.payment.status} /> : <span className="text-[#7A7067] text-xs">Not initiated</span>}
              </div>
              <div className="flex justify-between">
                <span className="text-[#A89F91]">Vendor</span>
                <span className="font-mono text-xs text-[#7A7067]">#{order.vendorId.slice(0, 8)}</span>
              </div>
            </div>

            {/* Payment state banners */}
            {paymentState === 'polling' && (
              <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 px-4 py-3 text-sm text-blue-400 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                Confirming payment…
              </div>
            )}
            {paymentState === 'success' && (
              <div className="rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-3 text-sm text-green-400 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                Payment confirmed!
              </div>
            )}
            {paymentState === 'timeout' && (
              <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/20 px-4 py-3 text-sm text-yellow-400">
                Payment received but confirmation is delayed. Please refresh in a few moments.
              </div>
            )}

            {/* Pay Now button */}
            {needsPayment && order.status !== 'CANCELLED' && (paymentState === 'idle' || paymentState === 'creating') && (
              <button
                type="button"
                disabled={paymentState === 'creating'}
                onClick={() => void handlePayNow()}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm bg-[#D97706] hover:bg-[#B45309] text-white transition-all disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[18px]">credit_card</span>
                {paymentState === 'creating' ? 'Loading…' : 'Pay Now'}
              </button>
            )}

            {/* Cancel button */}
            {canCancel && (
              <button
                type="button"
                disabled={cancelMutation.isPending}
                onClick={() => setCancelDialogOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[18px]">cancel</span>
                {cancelMutation.isPending ? 'Cancelling…' : 'Cancel Order'}
              </button>
            )}

            <Link href="/buyer/orders" className="block text-center text-sm font-medium text-[#A89F91] hover:text-[#F5F0E8] transition-colors">
              ← Back to Orders
            </Link>
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
    </div>
  );
}
