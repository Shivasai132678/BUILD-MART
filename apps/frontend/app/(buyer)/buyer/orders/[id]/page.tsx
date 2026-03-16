'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  cancelBuyerOrder, createDispute, createPaymentOrder, downloadInvoice,
  fetchBuyerOrder, submitReview, type OrderDetail,
} from '@/lib/buyer-api';
import { getApiErrorMessage } from '@/lib/api';
import { formatIST } from '@/lib/utils/date';
import { formatINR } from '@/lib/utils/money';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useUserStore } from '@/store/user.store';
import { PageTransition } from '@/components/ui/Motion';

// --- Razorpay types ---
type RazorpayCheckoutOptions = {
  key: string; amount: number; currency: string; name: string; description: string;
  order_id: string; handler: () => void; modal: { ondismiss: () => void };
  prefill: { contact?: string; name?: string };
};
type RazorpayCheckoutInstance = {
  open: () => void;
  on: (event: string, handler: (response: { error?: { description?: string } }) => void) => void;
};

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && 'Razorpay' in window) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
    document.head.appendChild(script);
  });
}

function openRazorpayCheckout(options: RazorpayCheckoutOptions): RazorpayCheckoutInstance {
  const RazorpayConstructor = (window as unknown as Record<string, unknown>).Razorpay as
    | (new (opts: RazorpayCheckoutOptions) => RazorpayCheckoutInstance) | undefined;
  if (!RazorpayConstructor) throw new Error('Razorpay SDK not loaded');
  return new RazorpayConstructor(options);
}

type PaymentFlowState = 'idle' | 'creating' | 'polling' | 'success' | 'timeout';

function buildTimeline(order: OrderDetail) {
  const delivered = order.status === 'DELIVERED';
  const outForDelivery = order.status === 'OUT_FOR_DELIVERY' || delivered;
  return [
    { key: 'CONFIRMED', label: 'Order Confirmed', icon: 'check_circle', timestamp: order.confirmedAt, complete: true },
    { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', icon: 'local_shipping', timestamp: order.dispatchedAt, complete: outForDelivery },
    { key: 'DELIVERED', label: 'Delivered', icon: 'inventory', timestamp: order.deliveredAt, complete: delivered },
  ];
}

function AnimatedTimeline({ order }: { order: OrderDetail }) {
  const timeline = buildTimeline(order);
  return (
    <div className="bg-[#1A1714] border border-[#2A2520] rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-[#F5F0E8] mb-5">Order Timeline</h2>
      {order.status === 'CANCELLED' && (
        <motion.div
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400"
        >
          Cancelled{order.cancelledAt ? ` on ${formatIST(order.cancelledAt)}` : ''}
          {order.cancelReason ? ` · ${order.cancelReason}` : ''}
        </motion.div>
      )}
      <ol className="space-y-0">
        {timeline.map((step, i) => (
          <motion.li
            key={step.key}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: i * 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="flex gap-4"
          >
            <div className="flex flex-col items-center">
              <motion.div
                initial={{ scale: 0.6 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3, delay: i * 0.1 + 0.1 }}
                className={`w-8 h-8 rounded-full flex items-center justify-center mt-0.5 ${
                  step.complete
                    ? 'bg-green-500/20 ring-2 ring-green-500/40'
                    : 'bg-[#2A2520] ring-2 ring-[#2A2520]'
                }`}
              >
                <span className={`material-symbols-outlined text-[16px] ${step.complete ? 'text-green-400' : 'text-[#7A7067]'}`}>
                  {step.icon}
                </span>
              </motion.div>
              {i < timeline.length - 1 && (
                <div className={`w-0.5 flex-1 my-1.5 min-h-[28px] transition-colors duration-700 ${step.complete ? 'bg-green-500/40' : 'bg-[#2A2520]'}`} />
              )}
            </div>
            <div className="pb-5">
              <p className={`text-sm font-semibold ${step.complete ? 'text-[#F5F0E8]' : 'text-[#7A7067]'}`}>{step.label}</p>
              <p className="text-xs text-[#7A7067] mt-0.5">{step.timestamp ? formatIST(step.timestamp) : 'Pending'}</p>
            </div>
          </motion.li>
        ))}
      </ol>
    </div>
  );
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
  const router = useRouter();
  const queryClient = useQueryClient();
  const orderId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [paymentState, setPaymentState] = useState<PaymentFlowState>('idle');
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeDescription, setDisputeDescription] = useState('');
  const [invoiceDownloading, setInvoiceDownloading] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const user = useUserStore((s) => s.user);

  const orderQuery = useQuery({ queryKey: ['buyer-order', orderId], queryFn: () => fetchBuyerOrder(orderId), enabled: Boolean(orderId) });

  const cancelMutation = useMutation({
    mutationFn: () => cancelBuyerOrder(orderId),
    onSuccess: async () => { toast.success('Order cancelled'); setCancelDialogOpen(false); await queryClient.invalidateQueries({ queryKey: ['buyer-order', orderId] }); },
    onError: (error) => { toast.error(getApiErrorMessage(error)); },
  });

  const reviewMutation = useMutation({
    mutationFn: () => submitReview(orderId, { rating: reviewRating, ...(reviewComment.trim() ? { comment: reviewComment.trim() } : {}) }),
    onSuccess: async () => {
      toast.success('Review submitted!'); setReviewSubmitted(true);
      await queryClient.invalidateQueries({ queryKey: ['buyer-order', orderId] });
    },
    onError: (error) => { toast.error(getApiErrorMessage(error, 'Failed to submit review.')); },
  });

  const disputeMutation = useMutation({
    mutationFn: () => createDispute({ orderId, reason: disputeReason.trim(), description: disputeDescription.trim() }),
    onSuccess: () => {
      toast.success('Dispute filed successfully.'); setDisputeOpen(false);
      setDisputeReason(''); setDisputeDescription('');
      router.push('/buyer/disputes');
    },
    onError: (error) => { toast.error(getApiErrorMessage(error, 'Failed to file dispute.')); },
  });

  const handleDownloadInvoice = async () => {
    setInvoiceDownloading(true);
    try {
      const blob = await downloadInvoice(orderId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${orderId.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Invoice downloaded!');
    } catch {
      toast.error('Failed to download invoice.');
    } finally {
      setInvoiceDownloading(false);
    }
  };

  useEffect(() => { return () => { if (pollingRef.current) clearInterval(pollingRef.current); }; }, []);

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
  const canCancel = order.status === 'CONFIRMED' && (!order.payment || order.payment.status === 'FAILED' || order.payment.status === 'CANCELLED');
  const needsPayment = !order.payment || order.payment.status !== 'SUCCESS';
  const reviewAlreadySubmitted = Boolean(order.review);
  const canDispute = order.status === 'DELIVERED' && order.payment?.status === 'SUCCESS';

  const startPolling = () => {
    setPaymentState('polling');
    const startTime = Date.now();
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
        } catch { /* continue polling */ }
        if (Date.now() - startTime >= 60_000) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          pollingRef.current = null;
          setPaymentState('timeout');
          void queryClient.invalidateQueries({ queryKey: ['buyer-order', orderId] });
        }
      })();
    }, 3_000);
  };

  const handlePayNow = async () => {
    setPaymentState('creating');
    try {
      const paymentOrder = await createPaymentOrder(orderId);
      await loadRazorpayScript();
      const rzp = openRazorpayCheckout({
        key: paymentOrder.key, amount: paymentOrder.amount, currency: paymentOrder.currency,
        name: 'BuildMart', description: `Order #${orderId.slice(0, 10)}`,
        order_id: paymentOrder.razorpayOrderId,
        handler: () => { startPolling(); },
        modal: { ondismiss: () => { setPaymentState('idle'); } },
        prefill: { contact: user?.phone, name: user?.name ?? undefined },
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
    <PageTransition className="space-y-6">
      {/* Back nav */}
      <Link href="/buyer/orders" className="inline-flex items-center gap-1.5 text-sm text-[#A89F91] hover:text-[#F5F0E8] transition-colors">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        All Orders
      </Link>

      {/* Order header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="bg-[#1A1714] border border-[#2A2520] rounded-2xl p-6 flex flex-wrap items-start justify-between gap-4"
      >
        <div>
          <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#2A2520] text-[#7A7067]">Order #{order.referenceCode ?? order.id.slice(0, 10)}</span>
          <h1 className="mt-2 text-3xl font-bold text-[#F5F0E8]">{formatINR(order.totalAmount)}</h1>
          <p className="mt-1 text-sm text-[#A89F91]">Created {formatIST(order.createdAt)}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <OrderStatusBadge status={order.status} />
          {/* Invoice download */}
          {order.payment?.status === 'SUCCESS' && (
            <button
              type="button"
              disabled={invoiceDownloading}
              onClick={() => void handleDownloadInvoice()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-[#2A2520] text-[#A89F91] hover:text-[#F5F0E8] hover:border-[#3A3027] bg-[#211E19] transition-all disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[14px]">{invoiceDownloading ? 'progress_activity' : 'download'}</span>
              {invoiceDownloading ? 'Downloading…' : 'Invoice PDF'}
            </button>
          )}
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Animated Timeline */}
          <AnimatedTimeline order={order} />

          {/* Order items */}
          {order.quote && (order.quote.items?.length ?? 0) > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="bg-[#1A1714] border border-[#2A2520] rounded-2xl p-6"
            >
              <h2 className="text-lg font-semibold text-[#F5F0E8] mb-3">Order Items</h2>
              <div className="space-y-2">
                {(order.quote.items ?? []).map((item) => (
                  <div key={item.id} className="flex items-center justify-between bg-[#211E19] border border-[#2A2520] rounded-xl px-4 py-3 text-sm">
                    <span className="font-medium text-[#F5F0E8]">{item.productName}</span>
                    <span className="text-[#A89F91]">{item.quantity} {item.unit} × ₹{item.unitPrice}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* Sidebar */}
        <div>
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="bg-[#1A1714] border border-[#2A2520] rounded-2xl p-6 sticky top-24 space-y-4"
          >
            <h3 className="text-sm font-semibold text-[#F5F0E8]">Order Summary</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-[#A89F91]">Total</span>
                <span className="font-semibold text-[#F5F0E8]">{formatINR(order.totalAmount)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#A89F91]">Payment</span>
                {order.payment ? <OrderStatusBadge status={order.payment.status} /> : <span className="text-[#7A7067] text-xs">Not initiated</span>}
              </div>
              <div className="flex justify-between">
                <span className="text-[#A89F91]">Vendor</span>
                <span className="font-mono text-xs text-[#7A7067]">{order.vendor?.businessName ?? `#${order.vendorId.slice(0, 8)}`}</span>
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

            {/* Pay Now */}
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

            {/* Cancel */}
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

            {order.status === 'CONFIRMED' && order.payment?.status === 'INITIATED' && (
              <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/20 px-4 py-3 text-xs text-yellow-400">
                Payment is in progress. Cancellation is unavailable until payment completes or fails.
              </div>
            )}

            {/* Dispute button */}
            {canDispute && (
              <button
                type="button"
                onClick={() => setDisputeOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">report_problem</span>
                Report an Issue
              </button>
            )}

            {/* Review */}
            {order.status === 'DELIVERED' && !reviewAlreadySubmitted && !reviewSubmitted && (
              <div className="space-y-3 border-t border-[#2A2520] pt-4">
                <p className="text-sm font-semibold text-[#F5F0E8]">Rate this order</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star} type="button" onClick={() => setReviewRating(star)}
                      className={`text-2xl transition-colors ${star <= reviewRating ? 'text-[#D97706]' : 'text-[#3A3027] hover:text-[#D97706]/60'}`}
                    >★</button>
                  ))}
                </div>
                <textarea
                  value={reviewComment} onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Leave a comment (optional)" rows={3}
                  className="w-full rounded-xl border border-[#2A2520] bg-[#211E19] px-4 py-2.5 text-sm text-[#F5F0E8] placeholder:text-[#7A7067] outline-none transition-all focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/20 resize-none"
                />
                <button
                  type="button" disabled={reviewRating === 0 || reviewMutation.isPending}
                  onClick={() => void reviewMutation.mutate()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm bg-[#D97706] hover:bg-[#B45309] text-white transition-all disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-[18px]">star</span>
                  {reviewMutation.isPending ? 'Submitting…' : 'Submit Review'}
                </button>
              </div>
            )}

            {(reviewAlreadySubmitted || reviewSubmitted) && (
              <div className="flex items-center gap-2 rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-3 text-sm text-green-400">
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                Review submitted. Thank you!
              </div>
            )}

            <Link href="/buyer/orders" className="block text-center text-sm font-medium text-[#A89F91] hover:text-[#F5F0E8] transition-colors">
              ← Back to Orders
            </Link>
          </motion.div>
        </div>
      </div>

      {/* Cancel confirm dialog */}
      <ConfirmDialog
        open={cancelDialogOpen}
        onClose={() => setCancelDialogOpen(false)}
        onConfirm={() => cancelMutation.mutate()}
        title="Cancel this order?"
        description="This action cannot be undone. The order will be permanently cancelled."
        confirmLabel="Cancel Order" cancelLabel="Keep Order"
        variant="danger" loading={cancelMutation.isPending}
      />

      {/* Dispute modal */}
      <AnimatePresence>
        {disputeOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="bg-[#1A1714] border border-[#2A2520] rounded-2xl p-6 w-full max-w-md shadow-2xl"
            >
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-orange-400 text-[22px]">report_problem</span>
                <h2 className="text-base font-bold text-[#F5F0E8]">Report an Issue</h2>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[#7A7067] uppercase tracking-wide mb-1.5">Reason</label>
                  <input
                    type="text" value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)}
                    placeholder="e.g. Wrong items delivered"
                    className="w-full rounded-xl border border-[#2A2520] bg-[#211E19] px-3 py-2.5 text-sm text-[#F5F0E8] placeholder:text-[#7A7067] outline-none focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/20 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#7A7067] uppercase tracking-wide mb-1.5">Description</label>
                  <textarea
                    value={disputeDescription} onChange={(e) => setDisputeDescription(e.target.value)}
                    placeholder="Describe the issue in detail…" rows={4}
                    className="w-full rounded-xl border border-[#2A2520] bg-[#211E19] px-3 py-2.5 text-sm text-[#F5F0E8] placeholder:text-[#7A7067] outline-none focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/20 transition-all resize-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-5">
                <button
                  type="button" onClick={() => setDisputeOpen(false)} disabled={disputeMutation.isPending}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-[#A89F91] hover:text-[#F5F0E8] border border-[#2A2520] bg-[#211E19] transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!disputeReason.trim() || !disputeDescription.trim() || disputeMutation.isPending}
                  onClick={() => disputeMutation.mutate()}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 border border-orange-500/30 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {disputeMutation.isPending && <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>}
                  Submit Dispute
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
}
