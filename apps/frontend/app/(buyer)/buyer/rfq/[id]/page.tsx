'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { Spinner } from '@/components/ui/Spinner';
import {
  createOrderFromQuote,
  fetchBuyerRfq,
  fetchQuotesForRfq,
  type Order,
  type Quote,
  type Rfq,
} from '@/lib/buyer-api';
import { getApiErrorMessage } from '@/lib/api';
import { formatIST } from '@/lib/utils/date';

function getRfqStatusClasses(status: Rfq['status']): string {
  switch (status) {
    case 'OPEN':
      return 'bg-blue-100 text-blue-800';
    case 'QUOTED':
      return 'bg-indigo-100 text-indigo-800';
    case 'CLOSED':
      return 'bg-slate-200 text-slate-800';
    case 'EXPIRED':
      return 'bg-rose-100 text-rose-800';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

function formatMoney(value: string): string {
  return `₹${value}`;
}

type AcceptingQuoteMap = Record<string, boolean>;

export default function BuyerRfqDetailPage() {
  const params = useParams<{ id: string | string[] }>();
  const router = useRouter();
  const rfqId = Array.isArray(params.id) ? params.id[0] : params.id;

  const rfqQuery = useQuery({
    queryKey: ['buyer-rfq', rfqId],
    queryFn: () => fetchBuyerRfq(rfqId),
    enabled: Boolean(rfqId),
  });

  const quotesQuery = useQuery({
    queryKey: ['buyer-rfq-quotes', rfqId],
    queryFn: () => fetchQuotesForRfq(rfqId),
    enabled: Boolean(rfqId),
    refetchInterval: 15_000,
  });

  const acceptQuoteMutation = useMutation({
    mutationFn: (quoteId: string) => createOrderFromQuote(quoteId),
    onSuccess: (order: Order) => {
      router.push(`/buyer/orders/${order.id}`);
    },
  });

  const acceptingQuoteId = acceptQuoteMutation.variables ?? null;
  const isLoading = rfqQuery.isLoading || quotesQuery.isLoading;
  const isError = rfqQuery.isError || quotesQuery.isError;
  const errorMessage = rfqQuery.isError
    ? getApiErrorMessage(rfqQuery.error, 'Failed to load RFQ details.')
    : quotesQuery.isError
      ? getApiErrorMessage(quotesQuery.error, 'Failed to load quotes.')
      : acceptQuoteMutation.isError
        ? getApiErrorMessage(acceptQuoteMutation.error, 'Failed to accept quote.')
        : null;

  if (!rfqId) {
    return <ErrorMessage message="Invalid RFQ ID" />;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-700">
          <Spinner size="sm" />
          Loading RFQ details...
        </div>
      </div>
    );
  }

  if (isError || !rfqQuery.data) {
    return (
      <div className="space-y-4">
        <ErrorMessage message={errorMessage ?? 'Failed to load RFQ'} />
        <Link
          href="/buyer/dashboard"
          className="inline-flex rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const rfq = rfqQuery.data;
  const quotes = quotesQuery.data ?? [];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">RFQ #{rfq.id.slice(0, 8)}</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">
              {rfq.city} procurement request
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Created {formatIST(rfq.createdAt)} • Valid until {formatIST(rfq.validUntil)}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${getRfqStatusClasses(
              rfq.status,
            )}`}
          >
            {rfq.status}
          </span>
        </div>

        {rfq.notes ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {rfq.notes}
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Requested Items</h2>
        <div className="mt-4 space-y-3">
          {rfq.items.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-slate-900">Product ID: {item.productId}</p>
                <p className="text-slate-700">
                  {String(item.quantity)} {item.unit}
                </p>
              </div>
              {item.notes ? (
                <p className="mt-1 text-slate-600">{item.notes}</p>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">Quotes</h2>
          <p className="text-xs text-slate-500">Auto-refreshes every 15 seconds</p>
        </div>

        <ErrorMessage message={errorMessage} className="mt-4" />

        {quotesQuery.isFetching ? (
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            <Spinner size="sm" />
            Refreshing quotes...
          </div>
        ) : null}

        <div className="mt-4 space-y-4">
          {quotes.length > 0 ? (
            quotes.map((quote: Quote) => (
              <div
                key={quote.id}
                className="rounded-xl border border-slate-200 p-4 transition hover:border-slate-300"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">
                      Vendor: {quote.vendorId.slice(0, 10)}...
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Delivery fee: {formatMoney(quote.deliveryFee)} • Valid until{' '}
                      {formatIST(quote.validUntil)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Total Amount</p>
                    <p className="text-xl font-semibold text-slate-900">
                      {formatMoney(quote.totalAmount)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {quote.items.map((item) => (
                    <span
                      key={item.id}
                      className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700"
                    >
                      {item.productName} • {item.quantity} {item.unit}
                    </span>
                  ))}
                </div>

                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => acceptQuoteMutation.mutate(quote.id)}
                    disabled={acceptQuoteMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {acceptQuoteMutation.isPending && acceptingQuoteId === quote.id ? (
                      <Spinner size="sm" className="border-white/30 border-t-white" />
                    ) : null}
                    {acceptQuoteMutation.isPending && acceptingQuoteId === quote.id
                      ? 'Creating Order...'
                      : 'Accept Quote'}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
              No quotes yet. Vendors matching your RFQ will appear here.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

