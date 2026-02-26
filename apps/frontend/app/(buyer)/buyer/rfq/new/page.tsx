'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { Spinner } from '@/components/ui/Spinner';
import { createRfq, fetchProducts } from '@/lib/buyer-api';
import { getApiErrorMessage } from '@/lib/api';

const rfqItemSchema = z.object({
  productId: z.string().min(1, 'Select a product'),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unit: z.string().min(1, 'Unit is required'),
  notes: z.string().optional(),
});

const rfqFormSchema = z.object({
  city: z.string().min(1, 'City is required'),
  validUntil: z.string().min(1, 'Valid until date is required'),
  notes: z.string().optional(),
  items: z.array(rfqItemSchema).min(1, 'Add at least one item'),
});

type RfqFormValues = z.infer<typeof rfqFormSchema>;

const TODO_ADDRESS_ID = 'TODO_ADDRESS_ID';

export default function BuyerNewRfqPage() {
  const router = useRouter();

  const productsQuery = useQuery({
    queryKey: ['products', 'rfq-form'],
    queryFn: () => fetchProducts(200, 0),
  });

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    setError,
    clearErrors,
  } = useForm<RfqFormValues>({
    resolver: zodResolver(rfqFormSchema),
    defaultValues: {
      city: 'Hyderabad',
      validUntil: '',
      notes: '',
      items: [{ productId: '', quantity: 1, unit: '', notes: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const createRfqMutation = useMutation({
    mutationFn: createRfq,
    onSuccess: (rfq) => {
      router.push(`/buyer/rfq/${rfq.id}`);
    },
    onError: (error) => {
      setError('root', {
        type: 'server',
        message: getApiErrorMessage(error, 'Failed to create RFQ. Please try again.'),
      });
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    clearErrors('root');

    const validUntilDate = new Date(values.validUntil);
    const validUntil = Number.isNaN(validUntilDate.getTime())
      ? values.validUntil
      : validUntilDate.toISOString();

    await createRfqMutation.mutateAsync({
      addressId: TODO_ADDRESS_ID,
      city: values.city,
      validUntil,
      ...(values.notes?.trim() ? { notes: values.notes.trim() } : {}),
      items: values.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unit: item.unit,
        ...(item.notes?.trim() ? { notes: item.notes.trim() } : {}),
      })),
    });
  });

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Create RFQ</h1>
        <p className="text-sm text-slate-600">
          Add one or more products and request quotes from matching vendors.
        </p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-medium">Address selection coming soon</p>
        <p className="mt-1">
          This form uses a temporary placeholder address ID for now:
          <span className="ml-1 rounded bg-amber-100 px-2 py-0.5 font-mono text-xs">
            {TODO_ADDRESS_ID}
          </span>
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700" htmlFor="city">
              City
            </label>
            <input
              id="city"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
              {...register('city')}
            />
            <ErrorMessage message={errors.city?.message} />
          </div>

          <div className="space-y-2">
            <label
              className="block text-sm font-medium text-slate-700"
              htmlFor="validUntil"
            >
              Valid Until
            </label>
            <input
              id="validUntil"
              type="date"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
              {...register('validUntil')}
            />
            <ErrorMessage message={errors.validUntil?.message} />
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700" htmlFor="notes">
            Notes (optional)
          </label>
          <textarea
            id="notes"
            rows={3}
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
            placeholder="Project details, preferred brands, delivery constraints..."
            {...register('notes')}
          />
          <ErrorMessage message={errors.notes?.message} />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">RFQ Items</h2>
            <button
              type="button"
              onClick={() => append({ productId: '', quantity: 1, unit: '', notes: '' })}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Add Item
            </button>
          </div>

          {fields.map((field, index) => (
            <div
              key={field.id}
              className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-800">Item {index + 1}</p>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  disabled={fields.length === 1}
                  className="text-sm font-medium text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Remove
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Product
                  </label>
                  <select
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                    {...register(`items.${index}.productId`, {
                      onChange: (event) => {
                        const selectedProduct = productsQuery.data?.items.find(
                          (product) => product.id === event.target.value,
                        );

                        if (selectedProduct) {
                          setValue(`items.${index}.unit`, selectedProduct.unit, {
                            shouldValidate: true,
                          });
                        }
                      },
                    })}
                  >
                    <option value="">Select a product</option>
                    {productsQuery.data?.items.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} ({product.unit}) - ₹{product.basePrice}
                      </option>
                    ))}
                  </select>
                  <ErrorMessage message={errors.items?.[index]?.productId?.message} />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Quantity
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                    {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                  />
                  <ErrorMessage message={errors.items?.[index]?.quantity?.message} />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Unit
                  </label>
                  <input
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                    placeholder="bag / kg / sqft"
                    {...register(`items.${index}.unit`)}
                  />
                  <ErrorMessage message={errors.items?.[index]?.unit?.message} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  Item Notes (optional)
                </label>
                <textarea
                  rows={2}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                  placeholder="Brand preference / grade / finish..."
                  {...register(`items.${index}.notes`)}
                />
                <ErrorMessage message={errors.items?.[index]?.notes?.message} />
              </div>
            </div>
          ))}

          <ErrorMessage
            message={typeof errors.items?.message === 'string' ? errors.items.message : null}
          />

          {productsQuery.isLoading ? (
            <div className="flex items-center gap-3 text-sm text-slate-700">
              <Spinner size="sm" />
              Loading products...
            </div>
          ) : null}

          <ErrorMessage
            message={
              productsQuery.isError
                ? getApiErrorMessage(
                    productsQuery.error,
                    'Failed to load products. Please refresh the page.',
                  )
                : null
            }
          />
        </div>

        <ErrorMessage message={errors.root?.message} />

        <button
          type="submit"
          disabled={createRfqMutation.isPending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {createRfqMutation.isPending ? <Spinner size="sm" className="border-white/30 border-t-white" /> : null}
          {createRfqMutation.isPending ? 'Creating RFQ...' : 'Submit RFQ'}
        </button>
      </form>
    </div>
  );
}
