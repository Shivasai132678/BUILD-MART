'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { ChevronDown, ChevronUp, RefreshCw, Clock } from 'lucide-react';
import { createOrderFromQuote, fetchBuyerRfq, fetchQuotesForRfq, type Order, type Quote } from '@/lib/buyer-api';
import { getApiErrorMessage } from '@/lib/api';
import { formatIST } from '@/lib/utils/date';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard, SkeletonRow } from '@/components/ui/Skeleton';

const pageV = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] } } };

function formatMoney(value: string): string { return `₹${Number(value).toLocaleString('en-IN')}`; }

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

  if (!rfqId) return <EmptyState title="Invalid RFQ ID" />;
  if (rfqQuery.isLoading || quotesQuery.isLoading) return <div className="space-y-6"><SkeletonCard /><SkeletonCard /><div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}</div></div>;
  if (rfqQuery.isError || !rfqQuery.data) return <EmptyState title="Failed to load RFQ" subtitle={getApiErrorMessage(rfqQuery.error)} actionLabel="Back" actionHref="/buyer/dashboard" />;

  const rfq = rfqQuery.data;
  const quotes = quotesQuery.data ?? [];

  return (
    <motion.div className="space-y-6" variants={pageV} initial="hidden" animate="visible">
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="text-xs font-mono text-text-tertiary bg-elevated px-2 py-0.5 rounded">#{rfq.id.slice(0, 8)}</span>
            <h1 className="mt-2 text-2xl font-semibold text-text-primary">{rfq.city} procurement request</h1>
            <p className="mt-1 text-sm text-text-secondary">Created {formatIST(rfq.createdAt)} · Valid until {formatIST(rfq.validUntil)}</p>
          </div>
          <Badge status={rfq.status} />
        </div>
        {rfq.notes && <div className="mt-4 rounded-xl bg-elevated px-4 py-3 text-sm text-text-secondary border border-border-subtle">{rfq.notes}</div>}
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-text-primary mb-2">Requested Items</h3>
          <div className="space-y-2">
            {rfq.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-xl border border-border-subtle px-4 py-2.5 text-sm">
                <span className="text-text-primary font-mono text-xs">Product #{item.productId.slice(0, 8)}</span>
                <span className="text-text-secondary">{String(item.quantity)} {item.unit}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold text-text-primary">Quotes Received</h2>
          {quotesQuery.isFetching && <span className="flex items-center gap-1.5 text-xs text-text-tertiary"><RefreshCw className="h-3 w-3 animate-spin" />Refreshing…</span>}
        </div>
        {quotes.length > 0 ? (
          <div className="space-y-3">
            {quotes.map((quote: Quote) => (
              <div key={quote.id} className="rounded-xl border border-border-subtle p-4 transition-all hover:border-border">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-text-primary">Vendor #{quote.vendorId.slice(0, 8)}</p>
                    <p className="mt-1 text-sm text-text-secondary">Delivery: {formatMoney(quote.deliveryFee)} · Valid until {formatIST(quote.validUntil)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-text-tertiary">Total</p>
                    <p className="text-xl font-bold text-text-primary">{formatMoney(quote.totalAmount)}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setExpandedQuote(expandedQuote === quote.id ? null : quote.id)} className="mt-3 flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-hover transition-colors">
                  {expandedQuote === quote.id ? <>Hide details <ChevronUp className="h-3 w-3" /></> : <>View details <ChevronDown className="h-3 w-3" /></>}
                </button>
                {expandedQuote === quote.id && (
                  <div className="mt-3 space-y-1.5">
                    {quote.items?.map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-lg bg-elevated px-3 py-2 text-sm border border-border-subtle">
                        <span className="text-text-primary">{item.productName}</span>
                        <span className="text-text-secondary">{item.quantity} {item.unit} × ₹{item.unitPrice} = ₹{item.subtotal}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-4">
                  <Button variant="primary" size="sm" loading={acceptQuoteMutation.isPending && acceptQuoteMutation.variables === quote.id} onClick={() => acceptQuoteMutation.mutate(quote.id)} disabled={acceptQuoteMutation.isPending}>
                    Accept Quote
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={<Clock className="h-6 w-6" />} title="Waiting for vendor quotes" subtitle="Vendors will submit quotes here. Auto-refreshes every 15 seconds." />
        )}
      </div>
    </motion.div>
  );
}
