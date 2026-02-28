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
import { Plus, Trash2, MapPin, Package, FileText, Send, ChevronDown, Loader2 } from 'lucide-react';
import {
  createAddress,
  createRfq,
  fetchProducts,
  getAddresses,
} from '@/lib/buyer-api';
import { getApiErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { MotionContainer } from '@/components/ui/Motion';
import { cn } from '@/lib/utils';

const rfqItemSchema = z.object({
  productId: z.string().min(1, 'Select a product'),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unit: z.string().min(1, 'Unit is required'),
  notes: z.string().optional(),
});

const rfqFormSchema = z.object({
  addressId: z.string().min(1, 'Select an address'),
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

const inputClassName =
  'w-full h-10 rounded-xl border border-border bg-elevated px-4 text-sm text-text-primary placeholder:text-text-tertiary outline-none transition-all duration-200 focus:border-accent focus:ring-2 focus:ring-accent/20';

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
      <MotionContainer>
        <PageHeader
          title="Create RFQ"
          subtitle="Add products and request quotes from matching vendors."
        />
      </MotionContainer>

      <MotionContainer delay={0.1}>
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left: Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Delivery Address */}
              <section className="card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="h-4 w-4 text-accent" />
                  <h2 className="text-sm font-semibold text-text-primary">Delivery Address</h2>
                </div>

                {addressesQuery.isLoading ? (
                  <div className="flex items-center gap-3 text-sm text-text-secondary">
                    <Loader2 className="h-4 w-4 animate-spin text-accent" />
                    Loading addresses…
                  </div>
                ) : addresses.length > 0 ? (
                  <div className="space-y-2">
                    {addresses.map((addr) => (
                      <label
                        key={addr.id}
                        className={cn(
                          'flex items-start gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-all duration-200',
                          selectedAddressId === addr.id
                            ? 'border-accent bg-accent/5'
                            : 'border-border-subtle hover:border-border',
                        )}
                      >
                        <input
                          type="radio"
                          value={addr.id}
                          {...register('addressId')}
                          className="mt-1 accent-accent"
                        />
                        <div>
                          <p className="text-sm font-medium text-text-primary">
                            {addr.label || addr.line1}
                          </p>
                          <p className="text-xs text-text-secondary">
                            {addr.line1}, {addr.city}, {addr.state} – {addr.pincode}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                ) : null}

                {errors.addressId && (
                  <p className="mt-2 text-xs text-accent-danger">{errors.addressId.message}</p>
                )}

                {!showAddAddress ? (
                  <button
                    type="button"
                    onClick={() => setShowAddAddress(true)}
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-hover transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add new address
                  </button>
                ) : (
                  <div className="mt-4 rounded-xl border border-border-subtle bg-elevated p-4 space-y-3">
                    <p className="text-sm font-semibold text-text-primary">New Address</p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1 sm:col-span-2">
                        <label className="block text-xs font-medium text-text-primary" htmlFor="addr-label">Label (optional)</label>
                        <input id="addr-label" className={inputClassName} placeholder="Home, Office…" {...registerAddress('label')} />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <label className="block text-xs font-medium text-text-primary" htmlFor="addr-line1">Address Line</label>
                        <input id="addr-line1" className={inputClassName} {...registerAddress('line1')} />
                        {addressErrors.line1 && <p className="text-xs text-accent-danger">{addressErrors.line1.message}</p>}
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-text-primary" htmlFor="addr-city">City</label>
                        <input id="addr-city" className={inputClassName} {...registerAddress('city')} />
                        {addressErrors.city && <p className="text-xs text-accent-danger">{addressErrors.city.message}</p>}
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-text-primary" htmlFor="addr-state">State</label>
                        <input id="addr-state" className={inputClassName} {...registerAddress('state')} />
                        {addressErrors.state && <p className="text-xs text-accent-danger">{addressErrors.state.message}</p>}
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-text-primary" htmlFor="addr-pincode">Pincode</label>
                        <input id="addr-pincode" inputMode="numeric" className={inputClassName} {...registerAddress('pincode')} />
                        {addressErrors.pincode && <p className="text-xs text-accent-danger">{addressErrors.pincode.message}</p>}
                      </div>
                    </div>
                    {addressErrors.root && (
                      <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{addressErrors.root.message}</div>
                    )}
                    <div className="flex gap-2">
                      <Button type="button" size="sm" loading={createAddressMutation.isPending} onClick={() => void onCreateAddress()}>
                        Save Address
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddAddress(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </section>

              {/* RFQ Items */}
              <section className="card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Package className="h-4 w-4 text-accent" />
                  <h2 className="text-sm font-semibold text-text-primary">Request Items</h2>
                </div>

                <div className="space-y-4">
                  {fields.map((field, index) => (
                    <div key={field.id} className="rounded-xl border border-border-subtle bg-elevated p-4 relative">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold text-text-primary">Item {index + 1}</p>
                        {fields.length > 1 && (
                          <button type="button" onClick={() => remove(index)} className="text-text-tertiary hover:text-accent-danger transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1 sm:col-span-2">
                          <label className="block text-xs font-medium text-text-primary">Product</label>
                          <div className="relative">
                            <select
                              className={cn(inputClassName, 'pr-8 appearance-none')}
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
                            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
                          </div>
                          {errors.items?.[index]?.productId && (
                            <p className="text-xs text-accent-danger">{errors.items[index].productId?.message}</p>
                          )}
                        </div>

                        <div className="space-y-1">
                          <label className="block text-xs font-medium text-text-primary">Quantity</label>
                          <input
                            type="number"
                            min={1}
                            className={inputClassName}
                            {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                          />
                          {errors.items?.[index]?.quantity && (
                            <p className="text-xs text-accent-danger">{errors.items[index].quantity?.message}</p>
                          )}
                        </div>

                        <div className="space-y-1">
                          <label className="block text-xs font-medium text-text-primary">Unit</label>
                          <input
                            className={cn(inputClassName, 'bg-surface opacity-50')}
                            readOnly
                            {...register(`items.${index}.unit`)}
                          />
                        </div>

                        <div className="space-y-1 sm:col-span-2">
                          <label className="block text-xs font-medium text-text-primary">Notes (optional)</label>
                          <input className={inputClassName} placeholder="Brand preference, etc." {...register(`items.${index}.notes`)} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => append({ productId: '', quantity: 1, unit: '', notes: '' })}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-hover transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add another item
                </button>

                {errors.items?.root && (
                  <p className="mt-2 text-xs text-accent-danger">{errors.items.root.message}</p>
                )}
              </section>

              {/* RFQ Details */}
              <section className="card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="h-4 w-4 text-accent" />
                  <h2 className="text-sm font-semibold text-text-primary">RFQ Details</h2>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-text-primary" htmlFor="rfq-valid-until">
                      Valid Until
                    </label>
                    <input
                      id="rfq-valid-until"
                      type="date"
                      className={inputClassName}
                      {...register('validUntil')}
                    />
                    {errors.validUntil && (
                      <p className="text-xs text-accent-danger">{errors.validUntil.message}</p>
                    )}
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="block text-xs font-medium text-text-primary" htmlFor="rfq-notes">
                      Notes (optional)
                    </label>
                    <textarea
                      id="rfq-notes"
                      rows={3}
                      className={inputClassName}
                      placeholder="Any special requirements…"
                      {...register('notes')}
                    />
                  </div>
                </div>
              </section>
            </div>

            {/* Right: Summary */}
            <div className="lg:col-span-1">
              <div className="card p-5 sticky top-24 space-y-4">
                <h3 className="text-sm font-semibold text-text-primary">RFQ Summary</h3>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Items</span>
                    <span className="font-medium text-text-primary">{fields.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Address</span>
                    <span className="font-medium text-text-primary truncate ml-4 max-w-[150px]">
                      {addresses.find((a) => a.id === selectedAddressId)?.label
                        || addresses.find((a) => a.id === selectedAddressId)?.city
                        || 'Not selected'}
                    </span>
                  </div>
                </div>

                {errors.root && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {errors.root.message}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isSubmitDisabled}
                  loading={createRfqMutation.isPending}
                  className="w-full"
                >
                  <Send className="h-4 w-4" />
                  {createRfqMutation.isPending ? 'Creating RFQ…' : 'Submit RFQ'}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </MotionContainer>
    </div>
  );
}
