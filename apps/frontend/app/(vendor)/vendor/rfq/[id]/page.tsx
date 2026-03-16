'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/api';
import { formatIST } from '@/lib/utils/date';
import { formatINR, toPaise } from '@/lib/utils/money';
import { getRfqById, submitQuote, getMyQuoteForRfq, respondToCounterOffer } from '@/lib/vendor-api';
import { getVendorProfile } from '@/lib/vendor-profile-api';

const DECIMAL_STRING_REGEX = /^\d+(\.\d{1,2})?$/;

const quoteFormSchema = z.object({
  items: z
    .array(
      z.object({
        productName: z.string().min(1, 'Product name is required'),
        quantity: z.string().regex(DECIMAL_STRING_REGEX, 'Quantity must be a decimal string'),
        unit: z.string().min(1, 'Unit is required'),
        unitPrice: z.string().regex(DECIMAL_STRING_REGEX, 'Unit price must be a decimal string'),
      }),
    )
    .min(1, 'At least one quote item is required'),
  taxAmount: z.string().regex(DECIMAL_STRING_REGEX, 'Tax amount must be a decimal string'),
  deliveryFee: z.string().regex(DECIMAL_STRING_REGEX, 'Delivery fee must be a decimal string'),
  validUntil: z.string().min(1, 'Valid until is required'),
  notes: z.string().optional(),
});

type QuoteFormValues = z.infer<typeof quoteFormSchema>;

function parseMoney(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toMoneyString(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

const inputClassName =
  'w-full h-10 rounded-xl border border-[#1E3A5F] bg-[#1E2A3A] px-4 text-sm text-[#E8F0F8] placeholder:text-[#4A6080] outline-none transition-all focus:border-[#3B7FC1] focus:ring-2 focus:ring-[#3B7FC1]/20';

const readOnlyClassName =
  'w-full h-10 rounded-xl border border-[#1E3A5F] bg-[#1E2A3A] px-4 text-sm text-[#4A6080] opacity-60 cursor-not-allowed';

export default function VendorRfqDetailPage() {
  const params = useParams<{ id: string | string[] }>();
  const rfqId = Array.isArray(params.id) ? params.id[0] : params.id;
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const rfqQuery = useQuery({
    queryKey: ['vendor-rfq', rfqId],
    queryFn: () => getRfqById(rfqId),
    enabled: Boolean(rfqId),
  });

  const profileQuery = useQuery({
    queryKey: ['vendor-profile'],
    queryFn: getVendorProfile,
    retry: false,
  });

  const myQuoteQuery = useQuery({
    queryKey: ['vendor-my-quote', rfqId],
    queryFn: () => getMyQuoteForRfq(rfqId),
    enabled: Boolean(rfqId),
    refetchInterval: 20_000,
  });

  const respondMutation = useMutation({
    mutationFn: ({ quoteId, accept }: { quoteId: string; accept: boolean }) =>
      respondToCounterOffer(quoteId, accept),
    onSuccess: (_, { accept }) => {
      toast.success(accept ? 'Counter-offer accepted.' : 'Counter-offer rejected.');
      void queryClient.invalidateQueries({ queryKey: ['vendor-my-quote', rfqId] });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Failed to respond to counter-offer.'));
    },
  });

  const isVendorApproved = profileQuery.data?.status === 'APPROVED';

  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors },
    setError,
    clearErrors,
  } = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: {
      items: [],
      taxAmount: '0.00',
      deliveryFee: '0.00',
      validUntil: '',
      notes: '',
    },
  });

  const { fields } = useFieldArray({ control, name: 'items' });

  useEffect(() => {
    if (!rfqQuery.data) return;
    reset({
      items: rfqQuery.data.items.map((item) => ({
        productName: item.product?.name ?? item.productId,
        quantity: String(item.quantity),
        unit: item.unit,
        unitPrice: '0.00',
      })),
      taxAmount: '0.00',
      deliveryFee: '0.00',
      validUntil: rfqQuery.data.validUntil.slice(0, 10),
      notes: '',
    });
    queueMicrotask(() => {
      setSubmitSuccess(false);
      setSubmitError(null);
    });
  }, [reset, rfqQuery.data]);

  const watchedItems = useWatch({ control, name: 'items' }) ?? [];
  const watchedTaxAmount = useWatch({ control, name: 'taxAmount' }) ?? '0.00';
  const watchedDeliveryFee = useWatch({ control, name: 'deliveryFee' }) ?? '0.00';

  const itemSubtotals = useMemo(
    () => watchedItems.map((item) => toMoneyString(parseMoney(item?.quantity) * parseMoney(item?.unitPrice))),
    [watchedItems],
  );

  const quoteSubtotal = useMemo(
    () => toMoneyString(itemSubtotals.reduce((sum, subtotal) => sum + parseMoney(subtotal), 0)),
    [itemSubtotals],
  );

  const totalAmount = useMemo(
    () => toMoneyString(parseMoney(quoteSubtotal) + parseMoney(watchedTaxAmount) + parseMoney(watchedDeliveryFee)),
    [quoteSubtotal, watchedTaxAmount, watchedDeliveryFee],
  );

  const submitQuoteMutation = useMutation({
    mutationFn: submitQuote,
    onSuccess: () => {
      setSubmitSuccess(true);
      setSubmitError(null);
      toast.success('Quote submitted successfully!');
    },
    onError: (error) => {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        setSubmitError('You have already submitted a quote for this RFQ');
        toast.error('Duplicate quote — already submitted');
        return;
      }
      setSubmitError(getApiErrorMessage(error, 'Failed to submit quote.'));
    },
  });

  const handleQuoteSubmit = handleSubmit(async (values) => {
    if (!rfqQuery.data) return;
    clearErrors('root');
    setSubmitError(null);

    if (rfqQuery.data.status !== 'OPEN') {
      setError('root', { type: 'server', message: 'This RFQ is no longer open.' });
      return;
    }

    const validUntilDate = new Date(values.validUntil);
    const validUntil = Number.isNaN(validUntilDate.getTime()) ? values.validUntil : validUntilDate.toISOString();

    await submitQuoteMutation.mutateAsync({
      rfqId: rfqQuery.data.id,
      subtotal: quoteSubtotal,
      taxAmount: toMoneyString(parseMoney(values.taxAmount)),
      deliveryFee: toMoneyString(parseMoney(values.deliveryFee)),
      totalAmount,
      validUntil,
      ...(values.notes?.trim() ? { notes: values.notes.trim() } : {}),
      items: values.items.map((item, index) => ({
        productName: item.productName,
        quantity: toMoneyString(parseMoney(item.quantity)),
        unit: item.unit,
        unitPrice: toMoneyString(parseMoney(item.unitPrice)),
        subtotal: itemSubtotals[index] ?? '0.00',
      })),
    });
  });

  if (!rfqId) return (
    <div className="bg-[#1E2A3A] border border-[#253347] rounded-2xl p-12 text-center">
      <span className="material-symbols-outlined text-4xl text-[#4A6080]">error</span>
      <p className="mt-3 font-semibold text-[#E2EAF4]">Invalid RFQ ID</p>
    </div>
  );

  if (rfqQuery.isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => <div key={i} className="bg-[#1E2A3A] border border-[#253347] rounded-2xl h-36 animate-pulse" />)}
      </div>
    );
  }

  if (rfqQuery.isError || !rfqQuery.data) {
    return (
      <div className="bg-[#1E2A3A] border border-[#253347] rounded-2xl p-12 text-center">
        <span className="material-symbols-outlined text-4xl text-[#4A6080]">error</span>
        <p className="mt-3 font-semibold text-[#E2EAF4]">Failed to load RFQ</p>
        <p className="mt-1 text-sm text-[#8EA5C0]">{getApiErrorMessage(rfqQuery.error)}</p>
      </div>
    );
  }

  const rfq = rfqQuery.data;
  const isFormDisabled = submitSuccess || submitQuoteMutation.isPending || rfq.status !== 'OPEN' || !isVendorApproved;

  return (
    <div className="space-y-6">
      {/* RFQ Info */}
      <div className="bg-[#1E2A3A] border border-[#253347] rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#253347] text-[#4A6080]">RFQ #{rfq.id.slice(0, 8)}</span>
            <h1 className="mt-2 text-2xl font-bold text-[#E2EAF4]">{rfq.title?.trim() || `${rfq.city} request`}</h1>
            <p className="mt-1 text-sm text-[#8EA5C0]">Created {formatIST(rfq.createdAt)} · Valid until {formatIST(rfq.validUntil)}</p>
          </div>
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${rfq.status === 'OPEN' ? 'bg-[#3B7FC1]/15 text-[#60A5FA] border border-[#3B7FC1]/30' : 'bg-[#253347] text-[#8EA5C0]'}`}>
            {rfq.status}
          </span>
        </div>

        {rfq.notes && (
          <div className="mt-4 bg-[#111827] border border-[#253347] rounded-xl px-4 py-3 text-sm text-[#8EA5C0]">
            {rfq.notes}
          </div>
        )}

        <div className="mt-4 space-y-2">
          <h3 className="text-sm font-semibold text-[#E2EAF4]">Requested Items</h3>
          {rfq.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between border border-[#253347] rounded-xl px-4 py-2.5 text-sm">
              <span className="text-[#E2EAF4]">{item.product?.name ?? `Product #${item.productId.slice(0, 8)}`}</span>
              <span className="text-[#E2EAF4]">{String(item.quantity)} {item.unit}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quote Form */}
      <div className="bg-[#1E2A3A] border border-[#253347] rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="material-symbols-outlined text-[22px] text-[#3B7FC1]">description</span>
          <h2 className="text-lg font-semibold text-[#E2EAF4]">Submit Quote</h2>
        </div>
        <p className="text-sm text-[#8EA5C0] mb-4">Fill in pricing for each requested line item.</p>

        {!isVendorApproved && !profileQuery.isLoading && (
          <div className="mb-4 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-400 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">pending</span>
            Your vendor profile is pending admin approval. You can view RFQs but cannot submit quotes until approved.
          </div>
        )}

        {submitSuccess && (
          <div className="mb-4 rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-3 text-sm text-green-400 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            Quote submitted successfully!
          </div>
        )}

        {rfq.status !== 'OPEN' && (
          <div className="mb-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 px-4 py-3 text-sm text-yellow-400">
            This RFQ is currently {rfq.status}. Quote submission is only available while OPEN.
          </div>
        )}

        {submitError && (
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {submitError}
          </div>
        )}

        {errors.root && (
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {errors.root.message}
          </div>
        )}

        <form onSubmit={handleQuoteSubmit} className="space-y-5">
          <fieldset disabled={isFormDisabled} className="space-y-5 disabled:opacity-70">
            {fields.map((field, index) => (
              <div key={field.id} className="bg-[#111827] border border-[#253347] rounded-xl p-4">
                <p className="mb-3 text-sm font-semibold text-[#E2EAF4]">Line Item {index + 1}</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="block text-sm font-medium text-[#8EA5C0]">Product Name</label>
                    <input className={inputClassName} {...register(`items.${index}.productName`)} />
                    {errors.items?.[index]?.productName && <p className="text-xs text-red-400">{errors.items[index].productName?.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-[#8EA5C0]">Quantity</label>
                    <input readOnly className={readOnlyClassName} {...register(`items.${index}.quantity`)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-[#8EA5C0]">Unit</label>
                    <input readOnly className={readOnlyClassName} {...register(`items.${index}.unit`)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-[#8EA5C0]">Unit Price (₹)</label>
                    <input type="text" inputMode="decimal" className={inputClassName} {...register(`items.${index}.unitPrice`)} />
                    {errors.items?.[index]?.unitPrice && <p className="text-xs text-red-400">{errors.items[index].unitPrice?.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-[#8EA5C0]">Subtotal</label>
                    <div className="flex items-center h-10 rounded-xl bg-[#1E2A3A] border border-[#253347] px-4 text-sm font-semibold text-[#E2EAF4]">
                      ₹{itemSubtotals[index] ?? '0.00'}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-[#8EA5C0]">Subtotal</label>
                <div className="flex items-center h-10 rounded-xl bg-[#111827] border border-[#253347] px-4 text-sm font-bold text-[#E2EAF4]">₹{quoteSubtotal}</div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-[#8EA5C0]" htmlFor="taxAmount">Tax Amount (₹)</label>
                <input id="taxAmount" type="text" inputMode="decimal" className={inputClassName} {...register('taxAmount')} />
                {errors.taxAmount && <p className="text-xs text-red-400">{errors.taxAmount.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-[#8EA5C0]" htmlFor="deliveryFee">Delivery Fee (₹)</label>
                <input id="deliveryFee" type="text" inputMode="decimal" className={inputClassName} {...register('deliveryFee')} />
                {errors.deliveryFee && <p className="text-xs text-red-400">{errors.deliveryFee.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-[#8EA5C0]">Total Amount</label>
                <div className="flex items-center h-10 rounded-xl bg-[#3B7FC1]/10 border border-[#3B7FC1]/20 px-4 text-sm font-bold text-[#60A5FA]">₹{totalAmount}</div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-[#8EA5C0]" htmlFor="validUntil">Quote Valid Until</label>
                <input id="validUntil" type="date" className={inputClassName} {...register('validUntil')} />
                {errors.validUntil && <p className="text-xs text-red-400">{errors.validUntil.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[#8EA5C0]" htmlFor="notes">Notes (optional)</label>
              <textarea
                id="notes"
                rows={3}
                className={`${inputClassName} h-auto py-3`}
                placeholder="Lead time, brand notes, exclusions, etc."
                {...register('notes')}
              />
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={isFormDisabled}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm bg-[#3B7FC1] hover:bg-[#2B6FAF] text-white transition-all disabled:opacity-60"
          >
            {submitSuccess
              ? 'Quote Submitted'
              : submitQuoteMutation.isPending
              ? 'Submitting Quote…'
              : !isVendorApproved
              ? 'Approval Required'
              : 'Submit Quote'}
          </button>
        </form>
      </div>
      {/* Counter-offer panel */}
      {myQuoteQuery.data && myQuoteQuery.data.counterStatus === 'PENDING' && (
        <div className="bg-[#1E2A3A] border border-yellow-500/30 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-[22px] text-yellow-400">swap_horiz</span>
            <h2 className="text-lg font-semibold text-[#E2EAF4]">Buyer Counter-Offer</h2>
          </div>
          <div className="bg-[#111827] border border-[#253347] rounded-xl px-4 py-3 mb-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#8EA5C0]">Your quoted total</span>
              <span className="text-sm font-semibold text-[#E2EAF4]">{formatINR(myQuoteQuery.data.totalAmount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#8EA5C0]">Buyer proposed</span>
              <span className="text-lg font-bold text-yellow-400">{formatINR(myQuoteQuery.data.counterOfferPrice)}</span>
            </div>
            {myQuoteQuery.data.counterOfferNote && (
              <p className="text-xs text-[#8EA5C0] pt-1 border-t border-[#253347]">
                Note: {myQuoteQuery.data.counterOfferNote}
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              disabled={respondMutation.isPending}
              onClick={() => respondMutation.mutate({ quoteId: myQuoteQuery.data!.id, accept: true })}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-green-600 hover:bg-green-700 text-white transition-all disabled:opacity-60"
            >
              {respondMutation.isPending && respondMutation.variables?.accept ? (
                <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
              )}
              Accept Counter-Offer
            </button>
            <button
              type="button"
              disabled={respondMutation.isPending}
              onClick={() => respondMutation.mutate({ quoteId: myQuoteQuery.data!.id, accept: false })}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#253347] hover:bg-[#2D3E50] text-red-400 border border-red-500/20 transition-all disabled:opacity-60"
            >
              {respondMutation.isPending && respondMutation.variables?.accept === false ? (
                <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-[16px]">cancel</span>
              )}
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Show resolved counter-offer status */}
      {myQuoteQuery.data && myQuoteQuery.data.counterStatus && myQuoteQuery.data.counterStatus !== 'PENDING' && (
        <div className={`rounded-2xl px-5 py-4 flex items-center gap-3 border ${
          myQuoteQuery.data.counterStatus === 'ACCEPTED'
            ? 'bg-green-500/10 border-green-500/20 text-green-400'
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          <span className="material-symbols-outlined text-[20px]">
            {myQuoteQuery.data.counterStatus === 'ACCEPTED' ? 'check_circle' : 'cancel'}
          </span>
          <p className="text-sm font-medium">
            {myQuoteQuery.data.counterStatus === 'ACCEPTED'
              ? `You accepted the buyer's counter-offer of ${formatINR(myQuoteQuery.data.counterOfferPrice)}. The buyer can now place an order.`
              : `You rejected the buyer's counter-offer of ${formatINR(myQuoteQuery.data.counterOfferPrice)}.`
            }
          </p>
        </div>
      )}
    </div>
  );
}
