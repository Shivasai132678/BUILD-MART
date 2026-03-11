'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
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
  title: z.string().max(200, 'Title is too long').optional(),
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

const inputCls =
  'w-full h-10 rounded-xl border border-[#2A2520] bg-[#211E19] px-4 text-sm text-[#F5F0E8] placeholder:text-[#7A7067] outline-none transition-all focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/20';

export default function BuyerNewRfqPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const hasAppliedPrefill = useRef(false);
  const [showAddAddress, setShowAddAddress] = useState(false);

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
      title: '',
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

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const selectedAddressId = watch('addressId');
  const firstItemProductId = watch('items.0.productId');
  const addresses = addressesQuery.data?.items ?? [];
  const prefillProductId = searchParams.get('productId')?.trim() ?? '';
  const products = productsQuery.data?.items ?? [];
  const productMap = new Map(products.map((p) => [p.id, p]));

  useEffect(() => {
    if (selectedAddressId || addresses.length === 0) return;
    const defaultId = addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id;
    if (defaultId) setValue('addressId', defaultId, { shouldValidate: true });
  }, [addresses, selectedAddressId, setValue]);

  useEffect(() => {
    if (hasAppliedPrefill.current) return;
    if (!prefillProductId || !productsQuery.data?.items) return;
    if (firstItemProductId && firstItemProductId.length > 0) {
      hasAppliedPrefill.current = true;
      return;
    }
    const match = productsQuery.data.items.find((p) => p.id === prefillProductId);
    if (!match) return;
    setValue('items.0.productId', match.id, { shouldValidate: true });
    setValue('items.0.unit', match.unit, { shouldValidate: true });
    hasAppliedPrefill.current = true;
  }, [firstItemProductId, prefillProductId, productsQuery.data, setValue]);

  const createAddressMutation = useMutation({
    mutationFn: createAddress,
    onSuccess: async (address) => {
      await queryClient.invalidateQueries({ queryKey: ['buyer-addresses'] });
      setValue('addressId', address.id, { shouldValidate: true });
      resetAddressForm({ label: '', line1: '', city: 'Hyderabad', state: 'Telangana', pincode: '' });
      setShowAddAddress(false);
      toast.success('Address added!');
    },
    onError: (error) => {
      setAddressError('root', { type: 'server', message: getApiErrorMessage(error, 'Failed to create address.') });
    },
  });

  const createRfqMutation = useMutation({
    mutationFn: createRfq,
    onSuccess: (rfq) => {
      toast.success('RFQ created successfully!');
      router.push(`/buyer/rfq/${rfq.id}`);
    },
    onError: (error) => {
      setError('root', { type: 'server', message: getApiErrorMessage(error, 'Failed to create RFQ.') });
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
    const validUntil = Number.isNaN(validUntilDate.getTime()) ? values.validUntil : validUntilDate.toISOString();
    await createRfqMutation.mutateAsync({
      addressId: values.addressId,
      validUntil,
      ...(values.title?.trim() ? { title: values.title.trim() } : {}),
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
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#F5F0E8]">Create RFQ</h1>
        <p className="mt-1 text-sm text-[#A89F91]">Add products and request quotes from matching vendors.</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Form */}
          <div className="lg:col-span-2 space-y-6">

            {/* Delivery Address */}
            <section className="bg-[#1A1714] border border-[#2A2520] rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-[20px] text-[#D97706]">location_on</span>
                <h2 className="text-sm font-semibold text-[#F5F0E8]">Delivery Address</h2>
              </div>

              {addressesQuery.isLoading ? (
                <div className="flex items-center gap-3 text-sm text-[#A89F91]">
                  <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                  Loading addresses…
                </div>
              ) : addresses.length > 0 ? (
                <div className="space-y-2">
                  {addresses.map((addr) => (
                    <label
                      key={addr.id}
                      className={`flex items-start gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-all ${
                        selectedAddressId === addr.id
                          ? 'border-[#D97706] bg-[#D97706]/5'
                          : 'border-[#2A2520] hover:border-[#3A3027]'
                      }`}
                    >
                      <input
                        type="radio"
                        value={addr.id}
                        {...register('addressId')}
                        className="mt-1 accent-[#D97706]"
                      />
                      <div>
                        <p className="text-sm font-medium text-[#F5F0E8]">{addr.label || addr.line1}</p>
                        <p className="text-xs text-[#A89F91]">{addr.line1}, {addr.city}, {addr.state} – {addr.pincode}</p>
                      </div>
                    </label>
                  ))}
                </div>
              ) : null}

              {errors.addressId && (
                <p className="mt-2 text-xs text-red-400">{errors.addressId.message}</p>
              )}

              {!showAddAddress ? (
                <button
                  type="button"
                  onClick={() => setShowAddAddress(true)}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[#D97706] hover:text-[#F59E0B] transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">add_circle</span>
                  Add new address
                </button>
              ) : (
                <div className="mt-4 bg-[#211E19] border border-[#2A2520] rounded-xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-[#F5F0E8]">New Address</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1 sm:col-span-2">
                      <label className="block text-xs font-medium text-[#A89F91]" htmlFor="addr-label">Label (optional)</label>
                      <input id="addr-label" className={inputCls} placeholder="Home, Office…" {...registerAddress('label')} />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <label className="block text-xs font-medium text-[#A89F91]" htmlFor="addr-line1">Address Line</label>
                      <input id="addr-line1" className={inputCls} {...registerAddress('line1')} />
                      {addressErrors.line1 && <p className="text-xs text-red-400">{addressErrors.line1.message}</p>}
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-[#A89F91]" htmlFor="addr-city">City</label>
                      <input id="addr-city" className={inputCls} {...registerAddress('city')} />
                      {addressErrors.city && <p className="text-xs text-red-400">{addressErrors.city.message}</p>}
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-[#A89F91]" htmlFor="addr-state">State</label>
                      <input id="addr-state" className={inputCls} {...registerAddress('state')} />
                      {addressErrors.state && <p className="text-xs text-red-400">{addressErrors.state.message}</p>}
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-[#A89F91]" htmlFor="addr-pincode">Pincode</label>
                      <input id="addr-pincode" inputMode="numeric" className={inputCls} {...registerAddress('pincode')} />
                      {addressErrors.pincode && <p className="text-xs text-red-400">{addressErrors.pincode.message}</p>}
                    </div>
                  </div>
                  {addressErrors.root && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 text-xs text-red-400">
                      {addressErrors.root.message}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={createAddressMutation.isPending}
                      onClick={() => void onCreateAddress()}
                      className="px-4 py-2 rounded-xl text-sm font-semibold bg-[#D97706] hover:bg-[#B45309] text-white transition-all disabled:opacity-60"
                    >
                      {createAddressMutation.isPending ? 'Saving…' : 'Save Address'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddAddress(false)}
                      className="px-4 py-2 rounded-xl text-sm font-medium text-[#A89F91] hover:text-[#F5F0E8] border border-[#2A2520] hover:border-[#3A3027] transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* RFQ Items */}
            <section className="bg-[#1A1714] border border-[#2A2520] rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-[20px] text-[#D97706]">inventory_2</span>
                <h2 className="text-sm font-semibold text-[#F5F0E8]">Request Items</h2>
              </div>

              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="bg-[#211E19] border border-[#2A2520] rounded-xl p-4 relative">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-semibold text-[#F5F0E8]">Item {index + 1}</p>
                      {fields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="text-[#7A7067] hover:text-red-400 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1 sm:col-span-2">
                        <label className="block text-xs font-medium text-[#A89F91]">Product</label>
                        <div className="relative">
                          <select
                            className={`${inputCls} pr-8 appearance-none`}
                            {...register(`items.${index}.productId`, {
                              onChange: (e) => {
                                const p = productMap.get(e.target.value);
                                if (p) setValue(`items.${index}.unit`, p.unit, { shouldValidate: true });
                              },
                            })}
                          >
                            <option value="">Select a product…</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} (₹{p.basePrice}/{p.unit})
                              </option>
                            ))}
                          </select>
                          <span className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[18px] text-[#7A7067]">expand_more</span>
                        </div>
                        {errors.items?.[index]?.productId && (
                          <p className="text-xs text-red-400">{errors.items[index].productId?.message}</p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-[#A89F91]">Quantity</label>
                        <input
                          type="number"
                          min={1}
                          className={inputCls}
                          {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                        />
                        {errors.items?.[index]?.quantity && (
                          <p className="text-xs text-red-400">{errors.items[index].quantity?.message}</p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-[#A89F91]">Unit</label>
                        <input
                          className={`${inputCls} opacity-50 cursor-not-allowed`}
                          readOnly
                          {...register(`items.${index}.unit`)}
                        />
                      </div>

                      <div className="space-y-1 sm:col-span-2">
                        <label className="block text-xs font-medium text-[#A89F91]">Notes (optional)</label>
                        <input className={inputCls} placeholder="Brand preference, etc." {...register(`items.${index}.notes`)} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => append({ productId: '', quantity: 1, unit: '', notes: '' })}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#D97706] hover:text-[#F59E0B] transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                Add another item
              </button>

              {errors.items?.root && (
                <p className="mt-2 text-xs text-red-400">{errors.items.root.message}</p>
              )}
            </section>

            {/* RFQ Details */}
            <section className="bg-[#1A1714] border border-[#2A2520] rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-[20px] text-[#D97706]">description</span>
                <h2 className="text-sm font-semibold text-[#F5F0E8]">RFQ Details</h2>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <label className="block text-xs font-medium text-[#A89F91]" htmlFor="rfq-title">Title (optional)</label>
                  <input
                    id="rfq-title"
                    type="text"
                    className={inputCls}
                    placeholder="e.g. Phase 2 cement & steel"
                    maxLength={200}
                    {...register('title')}
                  />
                  {errors.title && (
                    <p className="text-xs text-red-400">{errors.title.message}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-[#A89F91]" htmlFor="rfq-valid-until">Valid Until</label>
                  <input
                    id="rfq-valid-until"
                    type="date"
                    className={inputCls}
                    {...register('validUntil')}
                  />
                  {errors.validUntil && (
                    <p className="text-xs text-red-400">{errors.validUntil.message}</p>
                  )}
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="block text-xs font-medium text-[#A89F91]" htmlFor="rfq-notes">Notes (optional)</label>
                  <textarea
                    id="rfq-notes"
                    rows={3}
                    className={`${inputCls} h-auto py-3`}
                    placeholder="Any special requirements…"
                    {...register('notes')}
                  />
                </div>
              </div>
            </section>
          </div>

          {/* Right: Summary */}
          <div className="lg:col-span-1">
            <div className="bg-[#1A1714] border border-[#2A2520] rounded-2xl p-6 sticky top-24 space-y-4">
              <h3 className="text-sm font-semibold text-[#F5F0E8]">RFQ Summary</h3>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#A89F91]">Items</span>
                  <span className="font-medium text-[#F5F0E8]">{fields.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#A89F91]">Address</span>
                  <span className="font-medium text-[#F5F0E8] truncate ml-4 max-w-[140px]">
                    {addresses.find((a) => a.id === selectedAddressId)?.label
                      || addresses.find((a) => a.id === selectedAddressId)?.city
                      || 'Not selected'}
                  </span>
                </div>
              </div>

              {errors.root && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 text-xs text-red-400">
                  {errors.root.message}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitDisabled}
                className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-semibold text-sm bg-[#D97706] hover:bg-[#B45309] text-white transition-all disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[18px]">send</span>
                {createRfqMutation.isPending ? 'Creating RFQ…' : 'Submit RFQ'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
