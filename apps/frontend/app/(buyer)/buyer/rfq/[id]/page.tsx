'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { createOrderFromQuote, fetchBuyerRfq, fetchQuotesForRfq, type Order, type Quote } from '@/lib/buyer-api';
import { getApiErrorMessage } from '@/lib/api';
import { formatIST } from '@/lib/utils/date';

function formatMoney(value: string): string { return `₹${Number(value).toLocaleString('en-IN')}`; }

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

export default function BuyerRfqDetailPage() {
  const params = useParams<{ id: string | string[] }>();
  const router = useRouter();
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

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <Link href="/buyer/rfq" className="inline-flex items-center gap-1.5 text-sm text-[#A89F91] hover:text-[#F5F0E8] transition-colors">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        All RFQs
      </Link>

      {/* RFQ Header card */}
      <div className="bg-[#1A1714] border border-[#2A2520] rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#2A2520] text-[#7A7067]">#{rfq.id.slice(0, 8)}</span>
            <h1 className="mt-2 text-2xl font-bold text-[#F5F0E8]">{rfq.city} procurement request</h1>
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
                <span className="font-mono text-xs text-[#A89F91]">Product #{item.productId.slice(0, 8)}</span>
                <span className="text-[#F5F0E8]">{String(item.quantity)} {item.unit}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quotes section */}
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
          <div className="space-y-3">
            {quotes.map((quote: Quote) => (
              <div key={quote.id} className="bg-[#211E19] border border-[#2A2520] hover:border-[#3A3027] rounded-2xl p-5 transition-all">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#F5F0E8]">Vendor #{quote.vendorId.slice(0, 8)}</p>
                    <p className="mt-1 text-sm text-[#A89F91]">
                      Delivery: {formatMoney(quote.deliveryFee)} · Valid until {formatIST(quote.validUntil)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[#7A7067]">Total</p>
                    <p className="text-2xl font-bold text-[#D97706]">{formatMoney(quote.totalAmount)}</p>
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

                {expandedQuote === quote.id && (
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
                )}

                <div className="mt-4">
                  <button
                    type="button"
                    disabled={acceptQuoteMutation.isPending}
                    onClick={() => acceptQuoteMutation.mutate(quote.id)}
                    className="px-5 py-2 rounded-xl text-sm font-semibold bg-[#D97706] hover:bg-[#B45309] text-white transition-all disabled:opacity-60"
                  >
                    {acceptQuoteMutation.isPending && acceptQuoteMutation.variables === quote.id
                      ? 'Accepting…'
                      : 'Accept Quote'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-[#211E19] border border-dashed border-[#2A2520] rounded-2xl p-12 text-center">
            <span className="material-symbols-outlined text-4xl text-[#7A7067]">schedule</span>
            <p className="mt-3 font-semibold text-[#F5F0E8]">Waiting for vendor quotes</p>
            <p className="mt-1 text-sm text-[#A89F91]">Vendors will submit quotes here. Auto-refreshes every 15 seconds.</p>
          </div>
        )}
      </div>
    </div>
  );
}
