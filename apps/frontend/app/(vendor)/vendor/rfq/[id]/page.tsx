'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { Spinner } from '@/components/ui/Spinner';
import { getApiErrorMessage } from '@/lib/api';
import { formatIST } from '@/lib/utils/date';
import { getRfqById, submitQuote } from '@/lib/vendor-api';

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
  deliveryFee: z
    .string()
    .regex(DECIMAL_STRING_REGEX, 'Delivery fee must be a decimal string'),
  validUntil: z.string().min(1, 'Valid until is required'),
  notes: z.string().optional(),
});

type QuoteFormValues = z.infer<typeof quoteFormSchema>;

function parseMoney(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toMoneyString(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

function getStatusBadgeClasses(status: 'OPEN' | 'QUOTED' | 'CLOSED' | 'EXPIRED') {
  if (status === 'OPEN') {
    return 'bg-emerald-100 text-emerald-800';
  }

  if (status === 'QUOTED') {
    return 'bg-amber-100 text-amber-800';
  }

  if (status === 'CLOSED') {
    return 'bg-slate-200 text-slate-800';
  }

  return 'bg-rose-100 text-rose-800';
}

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

  const { fields } = useFieldArray({
    control,
    name: 'items',
  });

  useEffect(() => {
    if (!rfqQuery.data) {
      return;
    }

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
    setSubmitSuccess(false);
    setSubmitError(null);
  }, [reset, rfqQuery.data]);

  const watchedItems = useWatch({ control, name: 'items' }) ?? [];
  const watchedTaxAmount = useWatch({ control, name: 'taxAmount' }) ?? '0.00';
  const watchedDeliveryFee = useWatch({ control, name: 'deliveryFee' }) ?? '0.00';

  const itemSubtotals = useMemo(
    () =>
      watchedItems.map((item) =>
        toMoneyString(parseMoney(item?.quantity) * parseMoney(item?.unitPrice)),
      ),
    [watchedItems],
  );

  const quoteSubtotal = useMemo(
    () =>
      toMoneyString(
        itemSubtotals.reduce((sum, subtotal) => sum + parseMoney(subtotal), 0),
      ),
    [itemSubtotals],
  );

  const totalAmount = useMemo(
    () =>
      toMoneyString(
        parseMoney(quoteSubtotal) + parseMoney(watchedTaxAmount) + parseMoney(watchedDeliveryFee),
      ),
    [quoteSubtotal, watchedTaxAmount, watchedDeliveryFee],
  );

  const submitQuoteMutation = useMutation({
    mutationFn: submitQuote,
    onSuccess: () => {
      setSubmitSuccess(true);
      setSubmitError(null);
    },
    onError: (error) => {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        setSubmitError('You have already submitted a quote for this RFQ');
        return;
      }

      setSubmitError(getApiErrorMessage(error, 'Failed to submit quote.'));
    },
  });

  const handleQuoteSubmit = handleSubmit(async (values) => {
    if (!rfqQuery.data) {
      return;
    }

    clearErrors('root');
    setSubmitError(null);

    if (rfqQuery.data.status !== 'OPEN') {
      setError('root', {
        type: 'server',
        message: 'This RFQ is no longer open for quote submission.',
      });
      return;
    }

    const validUntilDate = new Date(values.validUntil);
    const validUntil = Number.isNaN(validUntilDate.getTime())
      ? values.validUntil
      : validUntilDate.toISOString();

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

  if (!rfqId) {
    return <ErrorMessage message="Invalid RFQ ID" />;
  }

  if (rfqQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-700">
          <Spinner size="sm" />
          Loading RFQ...
        </div>
      </div>
    );
  }

  if (rfqQuery.isError || !rfqQuery.data) {
    return (
      <ErrorMessage message={getApiErrorMessage(rfqQuery.error, 'Failed to load RFQ.')} />
    );
  }

  const rfq = rfqQuery.data;
  const isFormDisabled = submitSuccess || submitQuoteMutation.isPending || rfq.status !== 'OPEN';

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">RFQ #{rfq.id.slice(0, 8)}</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">
              {rfq.city} request
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Created {formatIST(rfq.createdAt)} • Valid until {formatIST(rfq.validUntil)}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadgeClasses(
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
        <h2 className="text-lg font-semibold text-slate-900">RFQ Items</h2>
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
        <h2 className="text-lg font-semibold text-slate-900">Submit Quote</h2>
        <p className="mt-1 text-sm text-slate-600">
          Fill in pricing for each requested line item. Amounts are submitted as Decimal-safe
          strings.
        </p>

        {submitSuccess ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Quote submitted!
          </div>
        ) : null}

        {rfq.status !== 'OPEN' ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            This RFQ is currently {rfq.status}. Quote submission is available only while the RFQ
            is OPEN.
          </div>
        ) : null}

        <ErrorMessage message={submitError} className="mt-4" />
        <ErrorMessage message={errors.root?.message} className="mt-4" />

        <form onSubmit={handleQuoteSubmit} className="mt-4 space-y-5">
          <fieldset disabled={isFormDisabled} className="space-y-5 disabled:opacity-80">
            <div className="space-y-4">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <p className="mb-3 text-sm font-medium text-slate-800">
                    Line Item {index + 1}
                  </p>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <label className="block text-sm font-medium text-slate-700">
                        Product Name
                      </label>
                      <input
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                        {...register(`items.${index}.productName`)}
                      />
                      <ErrorMessage message={errors.items?.[index]?.productName?.message} />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-slate-700">
                        Quantity
                      </label>
                      <input
                        readOnly
                        className="w-full rounded-xl border border-slate-300 bg-slate-100 px-3 py-2.5 text-sm text-slate-700"
                        {...register(`items.${index}.quantity`)}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-slate-700">
                        Unit
                      </label>
                      <input
                        readOnly
                        className="w-full rounded-xl border border-slate-300 bg-slate-100 px-3 py-2.5 text-sm text-slate-700"
                        {...register(`items.${index}.unit`)}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-slate-700">
                        Unit Price
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                        {...register(`items.${index}.unitPrice`)}
                      />
                      <ErrorMessage message={errors.items?.[index]?.unitPrice?.message} />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-slate-700">
                        Subtotal (auto)
                      </label>
                      <div className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900">
                        ₹{itemSubtotals[index] ?? '0.00'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Quote Subtotal (auto)</label>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-900">
                  ₹{quoteSubtotal}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700" htmlFor="taxAmount">
                  Tax Amount
                </label>
                <input
                  id="taxAmount"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                  {...register('taxAmount')}
                />
                <ErrorMessage message={errors.taxAmount?.message} />
              </div>

              <div className="space-y-2">
                <label
                  className="block text-sm font-medium text-slate-700"
                  htmlFor="deliveryFee"
                >
                  Delivery Fee
                </label>
                <input
                  id="deliveryFee"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                  {...register('deliveryFee')}
                />
                <ErrorMessage message={errors.deliveryFee?.message} />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Total Amount (auto)</label>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-900">
                  ₹{totalAmount}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700" htmlFor="validUntil">
                  Quote Valid Until
                </label>
                <input
                  id="validUntil"
                  type="date"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                  {...register('validUntil')}
                />
                <ErrorMessage message={errors.validUntil?.message} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700" htmlFor="quoteNotes">
                Notes (optional)
              </label>
              <textarea
                id="quoteNotes"
                rows={3}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                placeholder="Lead time, brand notes, exclusions, etc."
                {...register('notes')}
              />
              <ErrorMessage message={errors.notes?.message} />
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={isFormDisabled}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitQuoteMutation.isPending ? (
              <Spinner size="sm" className="border-white/30 border-t-white" />
            ) : null}
            {submitSuccess
              ? 'Quote Submitted'
              : submitQuoteMutation.isPending
                ? 'Submitting Quote...'
                : 'Submit Quote'}
          </button>
        </form>
      </section>
    </div>
  );
}

