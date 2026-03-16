'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { createOrderFromQuote, fetchBuyerRfq, fetchQuotesForRfq, sendCounterOffer, type Order, type Quote } from '@/lib/buyer-api';
import { getApiErrorMessage } from '@/lib/api';
import { formatIST } from '@/lib/utils/date';
import { formatINR, toPaise } from '@/lib/utils/money';
import { PageTransition, StaggerContainer, StaggerItem } from '@/components/ui/Motion';

function RfqStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    OPEN: 'bg-[#D97706]/15 text-[#F59E0B] border border-[#D97706]/30',
    QUOTED: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
    CLOSED: 'bg-green-600/15 text-green-300 border border-green-500/30',
    EXPIRED: 'bg-[#3A3027]/50 text-[#7A7067] border border-[#3A3027]',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${map[status] ?? 'bg-[#3A3027]/50 text-[#A89F91]'}`}>
      {status}
    </span>
  );
}

function CounterStatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    PENDING:  { cls: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30', label: 'Counter-offer pending' },
    ACCEPTED: { cls: 'bg-green-500/15 text-green-400 border border-green-500/30',   label: 'Counter-offer accepted' },
    REJECTED: { cls: 'bg-red-500/15 text-red-400 border border-red-500/30',         label: 'Counter-offer rejected' },
  };
  const cfg = map[status];
  if (!cfg) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.cls}`}>
      <span className="material-symbols-outlined text-[12px]">swap_horiz</span>
      {cfg.label}
    </span>
  );
}

function CounterOfferForm({
  quote,
  onSuccess,
}: {
  quote: Quote;
  onSuccess: () => void;
}) {
  const [price, setPrice] = useState('');
  const [note, setNote] = useState('');
  const [open, setOpen] = useState(false);

  const counterMutation = useMutation({
    mutationFn: () => sendCounterOffer(quote.id, price, note),
    onSuccess: () => {
      toast.success('Counter-offer sent to vendor.');
      setOpen(false);
      setPrice('');
      setNote('');
      onSuccess();
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Failed to send counter-offer.'));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!price || Number.isNaN(Number(price)) || Number(price) <= 0) {
      toast.error('Enter a valid counter-offer price.');
      return;
    }
    counterMutation.mutate();
  };

  return (
    <div className="mt-3">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#D97706]/10 hover:bg-[#D97706]/20 text-[#F59E0B] border border-[#D97706]/25 transition-colors"
        >
          <span className="material-symbols-outlined text-[14px]">swap_horiz</span>
          Counter-offer
        </button>
      ) : (
        <AnimatePresence>
          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="mt-2 bg-[#211E19] border border-[#D97706]/20 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-[#F59E0B] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px]">swap_horiz</span>
                Send Counter-Offer
              </p>
              <div className="space-y-1">
                <label className="block text-xs text-[#A89F91]">Proposed total price (₹)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 45000.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full h-9 rounded-lg border border-[#3A3027] bg-[#1A1714] px-3 text-sm text-[#F5F0E8] placeholder:text-[#5A5047] outline-none focus:border-[#D97706]/60 focus:ring-1 focus:ring-[#D97706]/20 transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs text-[#A89F91]">Note (optional)</label>
                <input
                  type="text"
                  placeholder="Reason for counter-offer"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full h-9 rounded-lg border border-[#3A3027] bg-[#1A1714] px-3 text-sm text-[#F5F0E8] placeholder:text-[#5A5047] outline-none focus:border-[#D97706]/60 transition-all"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={counterMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#D97706] hover:bg-[#B45309] text-white transition-all disabled:opacity-60"
                >
                  {counterMutation.isPending ? (
                    <span className="material-symbols-outlined text-[13px] animate-spin">progress_activity</span>
                  ) : (
                    <span className="material-symbols-outlined text-[13px]">send</span>
                  )}
                  Send
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-[#7A7067] hover:text-[#A89F91] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.form>
        </AnimatePresence>
      )}
    </div>
  );
}

function ComparisonTable({ quotes, rfqIsActive, onAccept, acceptingId }: {
  quotes: Quote[];
  rfqIsActive: boolean;
  onAccept: (id: string) => void;
  acceptingId: string | null;
}) {
  const active = quotes.filter((q) => !q.isWithdrawn);
  if (active.length < 2) return null;

  const lowestTotal = Math.min(...active.map((q) => toPaise(q.totalAmount)));

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="bg-[#1A1714] border border-[#2A2520] rounded-2xl p-6 overflow-x-auto"
    >
      <div className="flex items-center gap-2 mb-5">
        <span className="material-symbols-outlined text-[#D97706] text-[20px]">compare</span>
        <h2 className="text-lg font-semibold text-[#F5F0E8]">Quote Comparison</h2>
        <span className="ml-1 text-xs text-[#7A7067] bg-[#2A2520] px-2 py-0.5 rounded-full">{active.length} quotes</span>
      </div>
      <table className="w-full min-w-[480px] text-sm">
        <thead>
          <tr className="border-b border-[#2A2520]">
            <th className="text-left text-xs font-semibold text-[#7A7067] uppercase tracking-wide pb-3 w-40">Field</th>
            {active.map((q) => (
              <th key={q.id} className="text-left text-xs font-semibold text-[#F5F0E8] pb-3 px-3">
                {q.vendor?.businessName ?? `Vendor #${q.vendorId.slice(0, 8)}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#2A2520]">
          {[
            { label: 'Subtotal', key: 'subtotal' },
            { label: 'Tax', key: 'taxAmount' },
            { label: 'Delivery', key: 'deliveryFee' },
          ].map((row) => (
            <tr key={row.key}>
              <td className="py-3 text-[#7A7067]">{row.label}</td>
              {active.map((q) => (
                <td key={q.id} className="py-3 px-3 text-[#A89F91]">
                  {formatINR(q[row.key as keyof Quote] as string)}
                </td>
              ))}
            </tr>
          ))}
          <tr className="border-t-2 border-[#3A3027]">
            <td className="py-3 font-semibold text-[#F5F0E8]">Total</td>
            {active.map((q) => {
              const isLowest = toPaise(q.totalAmount) === lowestTotal;
              return (
                <td key={q.id} className="py-3 px-3">
                  <span className={`text-lg font-bold ${isLowest ? 'text-[#D97706]' : 'text-[#F5F0E8]'}`}>
                    {formatINR(q.totalAmount)}
                  </span>
                  {isLowest && (
                    <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#D97706]/15 text-[#F59E0B] border border-[#D97706]/30">
                      Best
                    </span>
                  )}
                </td>
              );
            })}
          </tr>
          <tr>
            <td className="py-3 text-[#7A7067]">Valid until</td>
            {active.map((q) => (
              <td key={q.id} className="py-3 px-3 text-xs text-[#A89F91]">{formatIST(q.validUntil)}</td>
            ))}
          </tr>
          {rfqIsActive && (
            <tr>
              <td className="py-3" />
              {active.map((q) => (
                <td key={q.id} className="py-3 px-3">
                  <button
                    type="button"
                    disabled={acceptingId !== null}
                    onClick={() => onAccept(q.id)}
                    className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 ${
                       toPaise(q.totalAmount) === lowestTotal
                        ? 'bg-[#D97706] hover:bg-[#B45309] text-white'
                        : 'bg-[#2A2520] hover:bg-[#3A3027] text-[#F5F0E8] border border-[#3A3027]'
                    }`}
                  >
                    {acceptingId === q.id ? (
                      <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                    ) : (
                      <span className="material-symbols-outlined text-[16px]">check</span>
                    )}
                    Accept
                  </button>
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </motion.div>
  );
}

export default function BuyerRfqDetailPage() {
  const params = useParams<{ id: string | string[] }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const rfqId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [expandedQuote, setExpandedQuote] = useState<string | null>(null);

  const rfqQuery = useQuery({ queryKey: ['buyer-rfq', rfqId], queryFn: () => fetchBuyerRfq(rfqId), enabled: Boolean(rfqId) });
  const quotesQuery = useQuery({ queryKey: ['buyer-rfq-quotes', rfqId], queryFn: () => fetchQuotesForRfq(rfqId), enabled: Boolean(rfqId), refetchInterval: 15_000 });

  const acceptQuoteMutation = useMutation({
    mutationFn: (quoteId: string) => createOrderFromQuote(quoteId),
    onSuccess: (order: Order) => { toast.success('Order created successfully!'); router.push(`/buyer/orders/${order.id}`); },
    onError: (error) => { toast.error(getApiErrorMessage(error, 'Failed to accept quote.')); },
  });

  if (!rfqId) return (
    <div className="bg-[#1A1714] border border-[#2A2520] rounded-2xl p-12 text-center">
      <span className="material-symbols-outlined text-4xl text-[#7A7067]">error</span>
      <p className="mt-3 font-semibold text-[#F5F0E8]">Invalid RFQ ID</p>
    </div>
  );

  if (rfqQuery.isLoading || quotesQuery.isLoading) return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => <div key={i} className="bg-[#1A1714] border border-[#2A2520] rounded-2xl h-28 animate-pulse" />)}
    </div>
  );

  if (rfqQuery.isError || !rfqQuery.data) return (
    <div className="bg-[#1A1714] border border-[#2A2520] rounded-2xl p-12 text-center">
      <span className="material-symbols-outlined text-4xl text-[#7A7067]">error</span>
      <p className="mt-3 font-semibold text-[#F5F0E8]">Failed to load RFQ</p>
      <p className="mt-1 text-sm text-[#A89F91]">{getApiErrorMessage(rfqQuery.error)}</p>
      <Link href="/buyer/dashboard" className="mt-4 inline-block text-sm font-medium text-[#D97706]">← Back</Link>
    </div>
  );

  const rfq = rfqQuery.data;
  const quotes = quotesQuery.data ?? [];
  const rfqIsActive = rfq.status === 'OPEN' || rfq.status === 'QUOTED';
  const canAcceptQuotes = rfqIsActive;
  const acceptingId = acceptQuoteMutation.isPending ? (acceptQuoteMutation.variables ?? null) : null;

  return (
    <PageTransition className="space-y-6">
      {/* Back nav */}
      <Link href="/buyer/rfq" className="inline-flex items-center gap-1.5 text-sm text-[#A89F91] hover:text-[#F5F0E8] transition-colors">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        All RFQs
      </Link>

      {/* RFQ Header card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="bg-[#1A1714] border border-[#2A2520] rounded-2xl p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#2A2520] text-[#7A7067]">#{rfq.id.slice(0, 8)}</span>
            <h1 className="mt-2 text-2xl font-bold text-[#F5F0E8]">{rfq.title?.trim() || `${rfq.city} procurement request`}</h1>
            <p className="mt-1 text-sm text-[#A89F91]">Created {formatIST(rfq.createdAt)} · Valid until {formatIST(rfq.validUntil)}</p>
          </div>
          <RfqStatusBadge status={rfq.status} />
        </div>

        {rfq.notes && (
          <div className="mt-4 bg-[#211E19] border border-[#2A2520] rounded-xl px-4 py-3 text-sm text-[#A89F91]">
            {rfq.notes}
          </div>
        )}

        <div className="mt-5">
          <h3 className="text-sm font-semibold text-[#F5F0E8] mb-2">Requested Items</h3>
          <div className="space-y-2">
            {rfq.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between border border-[#2A2520] rounded-xl px-4 py-2.5 text-sm">
                <span className="text-[#F5F0E8]">{item.product?.name ?? `Product #${item.productId.slice(0, 8)}`}</span>
                <span className="text-[#F5F0E8]">{String(item.quantity)} {item.unit}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Quote comparison table (shown when 2+ active quotes) */}
      {quotes.filter((q) => !q.isWithdrawn).length >= 2 && (
        <ComparisonTable
          quotes={quotes}
          rfqIsActive={rfqIsActive}
          onAccept={(id) => acceptQuoteMutation.mutate(id)}
          acceptingId={acceptingId}
        />
      )}

      {/* Individual quotes */}
      <div className="bg-[#1A1714] border border-[#2A2520] rounded-2xl p-6">
        <div className="flex items-center justify-between gap-3 mb-5">
          <h2 className="text-lg font-semibold text-[#F5F0E8]">Quotes Received</h2>
          {quotesQuery.isFetching && (
            <span className="flex items-center gap-1.5 text-xs text-[#7A7067]">
              <span className="material-symbols-outlined text-sm animate-spin">refresh</span>
              Refreshing…
            </span>
          )}
        </div>

        {quotes.length > 0 ? (
          <StaggerContainer className="space-y-3">
            {quotes.map((quote: Quote) => (
              <StaggerItem key={quote.id}>
                <div className={`bg-[#211E19] border rounded-2xl p-5 transition-all ${quote.isWithdrawn ? 'border-[#2A2520] opacity-60' : 'border-[#2A2520] hover:border-[#3A3027]'}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-[#F5F0E8]">{quote.vendor?.businessName ?? `Vendor #${quote.vendorId.slice(0, 8)}`}</p>
                        {quote.isWithdrawn && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#3A3027]/80 text-[#7A7067] border border-[#3A3027]">
                            Withdrawn
                          </span>
                        )}
                        {quote.counterStatus && <CounterStatusBadge status={quote.counterStatus} />}
                      </div>
                      <p className="mt-1 text-sm text-[#A89F91]">
                        Delivery: {formatINR(quote.deliveryFee)} · Valid until {formatIST(quote.validUntil)}
                      </p>
                      {quote.counterOfferPrice && (
                        <p className="mt-1 text-xs text-[#F59E0B]">
                          Your counter-offer: {formatINR(quote.counterOfferPrice)}
                          {quote.counterOfferNote && <span className="text-[#A89F91]"> — {quote.counterOfferNote}</span>}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-[#7A7067]">Total</p>
                      <p className="text-2xl font-bold text-[#D97706]">{formatINR(quote.totalAmount)}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setExpandedQuote(expandedQuote === quote.id ? null : quote.id)}
                    className="mt-3 flex items-center gap-1 text-xs font-medium text-[#D97706] hover:text-[#F59E0B] transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">
                      {expandedQuote === quote.id ? 'expand_less' : 'expand_more'}
                    </span>
                    {expandedQuote === quote.id ? 'Hide details' : 'View details'}
                  </button>

                  <AnimatePresence>
                    {expandedQuote === quote.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3 space-y-1.5">
                          {quote.items?.map((item) => (
                            <div key={item.id} className="flex items-center justify-between bg-[#1A1714] border border-[#2A2520] rounded-xl px-3 py-2 text-sm">
                              <span className="text-[#F5F0E8]">{item.productName}</span>
                              <span className="text-[#A89F91]">
                                {item.quantity} {item.unit} × ₹{item.unitPrice} = ₹{item.subtotal}
                              </span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {!quote.isWithdrawn && canAcceptQuotes && (
                    <div className="mt-4 flex flex-wrap gap-2 items-center">
                      <button
                        type="button"
                        disabled={acceptQuoteMutation.isPending}
                        onClick={() => acceptQuoteMutation.mutate(quote.id)}
                        className="px-5 py-2 rounded-xl text-sm font-semibold bg-[#D97706] hover:bg-[#B45309] text-white transition-all disabled:opacity-60"
                      >
                        {acceptQuoteMutation.isPending && acceptQuoteMutation.variables === quote.id
                          ? 'Accepting…'
                          : quote.counterStatus === 'ACCEPTED'
                          ? 'Accept (counter agreed)'
                          : 'Accept Quote'}
                      </button>
                    </div>
                  )}

                  {!quote.isWithdrawn && canAcceptQuotes && quote.counterStatus !== 'PENDING' && (
                    <CounterOfferForm
                      quote={quote}
                      onSuccess={() => queryClient.invalidateQueries({ queryKey: ['buyer-rfq-quotes', rfqId] })}
                    />
                  )}

                  {!quote.isWithdrawn && !canAcceptQuotes && (
                    <div className="mt-4">
                      <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-[#2A2520]/60 text-[#7A7067] border border-[#2A2520] cursor-not-allowed">
                        <span className="material-symbols-outlined text-[16px]">lock</span>
                        RFQ {rfq.status === 'CLOSED' ? 'closed' : 'expired'}
                      </span>
                    </div>
                  )}
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        ) : (
          <div className="bg-[#211E19] border border-dashed border-[#2A2520] rounded-2xl p-12 text-center">
            <span className="material-symbols-outlined text-4xl text-[#7A7067]">schedule</span>
            <p className="mt-3 font-semibold text-[#F5F0E8]">Waiting for vendor quotes</p>
            <p className="mt-1 text-sm text-[#A89F91]">Vendors will submit quotes here. Auto-refreshes every 15 seconds.</p>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
