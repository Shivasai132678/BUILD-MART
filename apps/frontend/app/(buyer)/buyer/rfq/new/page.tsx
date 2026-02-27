'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { Spinner } from '@/components/ui/Spinner';
import {
  createAddress,
  createRfq,
  fetchProducts,
  getAddresses,
} from '@/lib/buyer-api';
import { getApiErrorMessage } from '@/lib/api';

const rfqItemSchema = z.object({
  productId: z.string().min(1, 'Select a product'),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unit: z.string().min(1, 'Unit is required'),
  notes: z.string().optional(),
});

const rfqFormSchema = z.object({
  addressId: z.string().min(1, 'Select an address'),
  city: z.string().min(1, 'City is required'),
  validUntil: z.string().min(1, 'Valid until date is required'),
  notes: z.string().optional(),
  items: z.array(rfqItemSchema).min(1, 'Add at least one item'),
});

const addressFormSchema = z.object({
  label: z.string().max(100, 'Label is too long').optional(),
  line1: z.string().min(1, 'Address line is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be a valid 6-digit code'),
});

type RfqFormValues = z.infer<typeof rfqFormSchema>;
type AddressFormValues = z.infer<typeof addressFormSchema>;

export default function BuyerNewRfqPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const productsQuery = useQuery({
    queryKey: ['products', 'rfq-form'],
    queryFn: () => fetchProducts(200, 0),
  });

  const addressesQuery = useQuery({
    queryKey: ['buyer-addresses'],
    queryFn: () => getAddresses(50, 0),
  });

  const {
    control,
    register,
    handleSubmit,
    watch,
    formState: { errors },
    setValue,
    setError,
    clearErrors,
  } = useForm<RfqFormValues>({
    resolver: zodResolver(rfqFormSchema),
    defaultValues: {
      addressId: '',
      city: 'Hyderabad',
      validUntil: '',
      notes: '',
      items: [{ productId: '', quantity: 1, unit: '', notes: '' }],
    },
  });

  const {
    register: registerAddress,
    handleSubmit: handleAddressSubmit,
    reset: resetAddressForm,
    formState: { errors: addressErrors },
    setError: setAddressError,
    clearErrors: clearAddressErrors,
  } = useForm<AddressFormValues>({
    resolver: zodResolver(addressFormSchema),
    defaultValues: {
      label: '',
      line1: '',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const selectedAddressId = watch('addressId');
  const addresses = addressesQuery.data?.items ?? [];

  useEffect(() => {
    if (selectedAddressId || addresses.length === 0) {
      return;
    }

    const defaultAddressId = addresses.find((address) => address.isDefault)?.id ?? addresses[0]?.id;

    if (defaultAddressId) {
      setValue('addressId', defaultAddressId, { shouldValidate: true });
    }
  }, [addresses, selectedAddressId, setValue]);

  const createAddressMutation = useMutation({
    mutationFn: createAddress,
    onSuccess: async (address) => {
      await queryClient.invalidateQueries({ queryKey: ['buyer-addresses'] });
      setValue('addressId', address.id, { shouldValidate: true });
      setValue('city', address.city, { shouldValidate: true });
      resetAddressForm({
        label: '',
        line1: '',
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '',
      });
    },
    onError: (error) => {
      setAddressError('root', {
        type: 'server',
        message: getApiErrorMessage(error, 'Failed to create address. Please try again.'),
      });
    },
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

  const onCreateAddress = handleAddressSubmit(async (values) => {
    clearAddressErrors('root');

    await createAddressMutation.mutateAsync({
      line1: values.line1.trim(),
      area: values.line1.trim(),
      city: values.city.trim(),
      state: values.state.trim(),
      pincode: values.pincode.trim(),
      ...(values.label?.trim() ? { label: values.label.trim() } : {}),
      isDefault: true,
    });
  });

  const onSubmit = handleSubmit(async (values) => {
    clearErrors('root');

    const validUntilDate = new Date(values.validUntil);
    const validUntil = Number.isNaN(validUntilDate.getTime())
      ? values.validUntil
      : validUntilDate.toISOString();

    await createRfqMutation.mutateAsync({
      addressId: values.addressId,
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

  const isSubmitDisabled =
    createRfqMutation.isPending ||
    createAddressMutation.isPending ||
    addressesQuery.isLoading ||
    !selectedAddressId;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Create RFQ</h1>
        <p className="text-sm text-slate-600">
          Add one or more products and request quotes from matching vendors.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <section className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Delivery Address</h2>
            <p className="mt-1 text-xs text-slate-600">
              Select a saved address before submitting your RFQ.
            </p>
          </div>

          {addressesQuery.isLoading ? (
            <div className="flex items-center gap-3 text-sm text-slate-700">
              <Spinner size="sm" />
              Loading addresses...
            </div>
          ) : null}

          <ErrorMessage
            message={
              addressesQuery.isError
                ? getApiErrorMessage(
                    addressesQuery.error,
                    'Failed to load addresses. Please refresh and try again.',
                  )
                : null
            }
          />

          {!addressesQuery.isLoading && !addressesQuery.isError && addresses.length > 0 ? (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700" htmlFor="addressId">
                Select Address
              </label>
              <select
                id="addressId"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                {...register('addressId')}
              >
                <option value="">Choose an address</option>
                {addresses.map((address) => (
                  <option key={address.id} value={address.id}>
                    {address.label?.trim()
                      ? `${address.label} — ${address.line1}, ${address.city} ${address.pincode}`
                      : `${address.line1}, ${address.city} ${address.pincode}`}
                  </option>
                ))}
              </select>
              <ErrorMessage message={errors.addressId?.message} />
            </div>
          ) : null}

          {!addressesQuery.isLoading && !addressesQuery.isError && addresses.length === 0 ? (
            <div className="space-y-4 rounded-xl border border-dashed border-slate-300 bg-white p-4">
              <p className="text-sm text-slate-700">
                No saved addresses found. Add one to continue.
              </p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700" htmlFor="addressLabel">
                    Label (optional)
                  </label>
                  <input
                    id="addressLabel"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                    placeholder="Home / Site Office"
                    {...registerAddress('label')}
                  />
                  <ErrorMessage message={addressErrors.label?.message} />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700" htmlFor="addressLine1">
                    Address Line
                  </label>
                  <input
                    id="addressLine1"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                    placeholder="House/Plot, Street"
                    {...registerAddress('line1')}
                  />
                  <ErrorMessage message={addressErrors.line1?.message} />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700" htmlFor="addressCity">
                    City
                  </label>
                  <input
                    id="addressCity"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                    {...registerAddress('city')}
                  />
                  <ErrorMessage message={addressErrors.city?.message} />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700" htmlFor="addressState">
                    State
                  </label>
                  <input
                    id="addressState"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                    {...registerAddress('state')}
                  />
                  <ErrorMessage message={addressErrors.state?.message} />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700" htmlFor="addressPincode">
                    Pincode
                  </label>
                  <input
                    id="addressPincode"
                    inputMode="numeric"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                    placeholder="500001"
                    {...registerAddress('pincode')}
                  />
                  <ErrorMessage message={addressErrors.pincode?.message} />
                </div>
              </div>

              <ErrorMessage message={addressErrors.root?.message} />

              <button
                type="button"
                onClick={() => void onCreateAddress()}
                disabled={createAddressMutation.isPending}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {createAddressMutation.isPending ? (
                  <Spinner size="sm" />
                ) : null}
                {createAddressMutation.isPending ? 'Saving address...' : 'Save Address'}
              </button>
            </div>
          ) : null}
        </section>

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
          disabled={isSubmitDisabled}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {createRfqMutation.isPending ? <Spinner size="sm" className="border-white/30 border-t-white" /> : null}
          {createRfqMutation.isPending ? 'Creating RFQ...' : 'Submit RFQ'}
        </button>
      </form>
    </div>
  );
}
