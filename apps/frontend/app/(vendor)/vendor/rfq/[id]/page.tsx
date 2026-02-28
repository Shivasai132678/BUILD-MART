'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { CheckCircle, FileText } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api';
import { formatIST } from '@/lib/utils/date';
import { getRfqById, submitQuote } from '@/lib/vendor-api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { MotionContainer } from '@/components/ui/Motion';

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
  'w-full h-10 rounded-xl border border-border bg-elevated px-4 text-sm text-text-primary placeholder:text-text-tertiary outline-none transition-all duration-200 focus:border-accent focus:ring-2 focus:ring-accent/20';

const readOnlyClassName =
  'w-full h-10 rounded-xl border border-border-subtle bg-elevated px-4 text-sm text-text-tertiary';

export default function VendorRfqDetailPage() {
  const params = useParams<{ id: string | string[] }>();
  const rfqId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const rfqQuery = useQuery({
    queryKey: ['vendor-rfq', rfqId],
    queryFn: () => getRfqById(rfqId),
    enabled: Boolean(rfqId),
  });

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
        productName: item.productId,
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

  if (!rfqId) return <EmptyState title="Invalid RFQ ID" />;

  if (rfqQuery.isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (rfqQuery.isError || !rfqQuery.data) {
    return <EmptyState title="Failed to load RFQ" subtitle={getApiErrorMessage(rfqQuery.error)} actionLabel="Back to RFQs" actionHref="/vendor/rfq" />;
  }

  const rfq = rfqQuery.data;
  const isFormDisabled = submitSuccess || submitQuoteMutation.isPending || rfq.status !== 'OPEN';

  return (
    <div className="space-y-6">
      {/* RFQ Info */}
      <MotionContainer>
        <div className="card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-text-tertiary font-mono">RFQ #{rfq.id.slice(0, 8)}</p>
              <h1 className="mt-1 text-2xl font-semibold text-text-primary">{rfq.city} request</h1>
              <p className="mt-2 text-sm text-text-secondary">
                Created {formatIST(rfq.createdAt)} · Valid until {formatIST(rfq.validUntil)}
              </p>
            </div>
            <Badge status={rfq.status} />
          </div>

          {rfq.notes && (
            <div className="mt-4 rounded-xl bg-elevated border border-border-subtle px-4 py-3 text-sm text-text-secondary">
              {rfq.notes}
            </div>
          )}

          <div className="mt-4 space-y-2">
            <h3 className="text-sm font-semibold text-text-primary">Requested Items</h3>
            {rfq.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-xl border border-border px-4 py-2.5 text-sm">
                <span className="text-text-primary font-medium font-mono text-xs">Product #{item.productId.slice(0, 8)}</span>
                <span className="text-text-secondary">{String(item.quantity)} {item.unit}</span>
              </div>
            ))}
          </div>
        </div>
      </MotionContainer>

      {/* Quote Form */}
      <MotionContainer delay={0.1}>
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-semibold text-text-primary">Submit Quote</h2>
          </div>
          <p className="text-sm text-text-secondary mb-4">
            Fill in pricing for each requested line item.
          </p>

          {submitSuccess && (
            <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Quote submitted successfully!
            </div>
          )}

          {rfq.status !== 'OPEN' && (
            <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
              This RFQ is currently {rfq.status}. Quote submission is only available while OPEN.
            </div>
          )}

          {submitError && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {submitError}
            </div>
          )}

          {errors.root && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errors.root.message}
            </div>
          )}

          <form onSubmit={handleQuoteSubmit} className="space-y-5">
            <fieldset disabled={isFormDisabled} className="space-y-5 disabled:opacity-70">
              {fields.map((field, index) => (
                <div key={field.id} className="rounded-xl border border-border-subtle bg-elevated p-4">
                  <p className="mb-3 text-sm font-semibold text-text-primary">Line Item {index + 1}</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="block text-sm font-medium text-text-primary">Product Name</label>
                      <input className={inputClassName} {...register(`items.${index}.productName`)} />
                      {errors.items?.[index]?.productName && <p className="text-xs text-accent-danger">{errors.items[index].productName?.message}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-text-primary">Quantity</label>
                      <input readOnly className={readOnlyClassName} {...register(`items.${index}.quantity`)} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-text-primary">Unit</label>
                      <input readOnly className={readOnlyClassName} {...register(`items.${index}.unit`)} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-text-primary">Unit Price (₹)</label>
                      <input type="number" inputMode="decimal" step="0.01" min="0" className={inputClassName} {...register(`items.${index}.unitPrice`)} />
                      {errors.items?.[index]?.unitPrice && <p className="text-xs text-accent-danger">{errors.items[index].unitPrice?.message}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-text-primary">Subtotal</label>
                      <div className="flex items-center h-[42px] rounded-xl bg-elevated border border-border-subtle px-4 text-sm font-semibold text-text-primary">
                        ₹{itemSubtotals[index] ?? '0.00'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-text-primary">Subtotal</label>
                  <div className="flex items-center h-[42px] rounded-xl bg-elevated border border-border-subtle px-4 text-sm font-bold text-text-primary">
                    ₹{quoteSubtotal}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-text-primary" htmlFor="taxAmount">Tax Amount (₹)</label>
                  <input id="taxAmount" type="number" inputMode="decimal" step="0.01" min="0" className={inputClassName} {...register('taxAmount')} />
                  {errors.taxAmount && <p className="text-xs text-accent-danger">{errors.taxAmount.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-text-primary" htmlFor="deliveryFee">Delivery Fee (₹)</label>
                  <input id="deliveryFee" type="number" inputMode="decimal" step="0.01" min="0" className={inputClassName} {...register('deliveryFee')} />
                  {errors.deliveryFee && <p className="text-xs text-accent-danger">{errors.deliveryFee.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-text-primary">Total Amount</label>
                  <div className="flex items-center h-[42px] rounded-xl bg-accent/5 border border-accent/20 px-4 text-sm font-bold text-accent">
                    ₹{totalAmount}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-text-primary" htmlFor="validUntil">Quote Valid Until</label>
                  <input id="validUntil" type="date" className={inputClassName} {...register('validUntil')} />
                  {errors.validUntil && <p className="text-xs text-accent-danger">{errors.validUntil.message}</p>}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-text-primary" htmlFor="notes">Notes (optional)</label>
                <textarea
                  id="notes"
                  rows={3}
                  className={inputClassName}
                  placeholder="Lead time, brand notes, exclusions, etc."
                  {...register('notes')}
                />
              </div>
            </fieldset>

            <Button type="submit" disabled={isFormDisabled} loading={submitQuoteMutation.isPending} className="w-full">
              {submitSuccess ? 'Quote Submitted' : submitQuoteMutation.isPending ? 'Submitting Quote…' : 'Submit Quote'}
            </Button>
          </form>
        </div>
      </MotionContainer>
    </div>
  );
}
