'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  fetchVendorProfile,
  fetchVendorProducts,
  createDirectOrder,
  getAddresses,
  type VendorProfile,
  type VendorProductItem,
  type Address,
} from '@/lib/buyer-api';
import { getApiErrorMessage } from '@/lib/api';
import { formatIST } from '@/lib/utils/date';
import { formatINR } from '@/lib/utils/money';
import { PageTransition, StaggerContainer, StaggerItem } from '@/components/ui/Motion';

// ─── Star Rating ─────────────────────────────────────────────────────────────

function StarRating({ rating, size = 'sm' }: { rating: string | number; size?: 'sm' | 'lg' }) {
  const r = Math.round(Number(rating));
  const textSize = size === 'lg' ? 'text-base' : 'text-sm';
  const labelSize = size === 'lg' ? 'text-sm' : 'text-xs';
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} className={`${textSize} ${s <= r ? 'text-[#D97706]' : 'text-[#3A3027]'}`}>★</span>
      ))}
      <span className={`ml-1 ${labelSize} text-[#7A7067]`}>{Number(rating).toFixed(1)}</span>
    </span>
  );
}

// ─── Quantity Selector ────────────────────────────────────────────────────────

function QuantitySelector({
  value,
  onChange,
  min = 1,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-7 h-7 rounded-lg bg-[#2A2520] text-[#A89F91] hover:bg-[#3A3027] hover:text-[#F5F0E8] flex items-center justify-center transition-colors"
      >
        <span className="material-symbols-outlined text-[16px]">remove</span>
      </button>
      <span className="w-8 text-center text-sm font-medium text-[#F5F0E8]">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="w-7 h-7 rounded-lg bg-[#2A2520] text-[#A89F91] hover:bg-[#3A3027] hover:text-[#F5F0E8] flex items-center justify-center transition-colors"
      >
        <span className="material-symbols-outlined text-[16px]">add</span>
      </button>
    </div>
  );
}

// ─── Direct Order Modal ───────────────────────────────────────────────────────

type CartItem = { product: VendorProductItem; quantity: number };

function DirectOrderModal({
  vendorId,
  cart,
  addresses,
  onClose,
  onSuccess,
}: {
  vendorId: string;
  cart: CartItem[];
  addresses: Address[];
  onClose: () => void;
  onSuccess: (orderId: string) => void;
}) {
  const [selectedAddressId, setSelectedAddressId] = useState<string>(
    addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id ?? '',
  );

  const total = cart.reduce(
    (sum, { product, quantity }) => sum + parseFloat(product.price) * quantity,
    0,
  );

  const mutation = useMutation({
    mutationFn: () =>
      createDirectOrder({
        vendorId,
        addressId: selectedAddressId,
        items: cart.map(({ product, quantity }) => ({
          productId: product.productId,
          quantity,
        })),
      }),
    onSuccess: (order) => {
      toast.success('Order placed successfully!');
      onSuccess(order.id);
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="w-full max-w-lg bg-[#1A1714] border border-[#2A2520] rounded-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2A2520]">
          <h2 className="text-lg font-semibold text-[#F5F0E8]">Confirm Direct Order</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#7A7067] hover:text-[#F5F0E8] hover:bg-[#2A2520] transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Order items */}
        <div className="px-6 py-4 space-y-2 max-h-48 overflow-y-auto">
          {cart.map(({ product, quantity }) => (
            <div key={product.vendorProductId} className="flex items-center justify-between text-sm">
              <span className="text-[#A89F91] truncate flex-1 mr-3">
                {product.name} × {quantity} {product.unit}
              </span>
              <span className="text-[#F5F0E8] font-medium shrink-0">
                {formatINR((parseFloat(product.price) * quantity).toString())}
              </span>
            </div>
          ))}
        </div>

        <div className="px-6 pb-2">
          <div className="flex items-center justify-between py-3 border-t border-[#2A2520] text-sm font-semibold">
            <span className="text-[#A89F91]">Total</span>
            <span className="text-[#D97706] text-base">{formatINR(total.toString())}</span>
          </div>
        </div>

        {/* Address selector */}
        <div className="px-6 pb-4">
          <label className="block text-xs font-semibold text-[#7A7067] uppercase tracking-wide mb-1.5">
            Delivery Address
          </label>
          {addresses.length === 0 ? (
            <p className="text-sm text-red-400">
              No saved addresses.{' '}
              <Link href="/buyer/rfq/new" className="underline">
                Add one first.
              </Link>
            </p>
          ) : (
            <select
              value={selectedAddressId}
              onChange={(e) => setSelectedAddressId(e.target.value)}
              disabled={mutation.isPending}
              className="w-full rounded-xl border border-[#2A2520] bg-[#211E19] px-3 py-2 text-sm text-[#F5F0E8] outline-none focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/20 transition-all"
            >
              {addresses.map((addr) => (
                <option key={addr.id} value={addr.id}>
                  {addr.label ? `${addr.label} — ` : ''}{addr.line1}, {addr.area}, {addr.city} {addr.pincode}
                  {addr.isDefault ? ' (Default)' : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 pb-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
            className="flex-1 py-2.5 rounded-xl border border-[#2A2520] text-sm font-medium text-[#A89F91] hover:text-[#F5F0E8] hover:border-[#3A3027] transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !selectedAddressId || addresses.length === 0}
            className="flex-1 py-2.5 rounded-xl bg-[#D97706] hover:bg-[#B45309] text-white text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {mutation.isPending ? (
              <>
                <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                Placing…
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[16px]">shopping_bag</span>
                Place Order
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Product Card ─────────────────────────────────────────────────────────────

function ProductCard({
  product,
  quantity,
  onQuantityChange,
  inCart,
  onAddToCart,
  onRemoveFromCart,
}: {
  product: VendorProductItem;
  quantity: number;
  onQuantityChange: (q: number) => void;
  inCart: boolean;
  onAddToCart: () => void;
  onRemoveFromCart: () => void;
}) {
  return (
    <div className="bg-[#1A1714] border border-[#2A2520] rounded-2xl p-4 flex flex-col gap-3">
      {/* Name + category */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-[#F5F0E8] leading-snug">{product.name}</h3>
          {!product.stockAvailable && (
            <span className="shrink-0 px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 text-[10px] font-medium">
              Out of stock
            </span>
          )}
        </div>
        <p className="text-xs text-[#7A7067] mt-0.5">{product.category.name}</p>
      </div>

      {/* Price */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-lg font-bold text-[#D97706]">{formatINR(product.price)}</p>
          <p className="text-xs text-[#7A7067]">per {product.unit}</p>
        </div>

        {product.stockAvailable && (
          <div className="flex flex-col items-end gap-2">
            {inCart ? (
              <>
                <QuantitySelector value={quantity} onChange={onQuantityChange} />
                <button
                  type="button"
                  onClick={onRemoveFromCart}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Remove
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onAddToCart}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#D97706]/15 text-[#D97706] hover:bg-[#D97706]/25 text-xs font-semibold transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">add_shopping_cart</span>
                Add to Order
              </button>
            )}
          </div>
        )}
      </div>

      {/* RFQ link */}
      <div className="pt-1 border-t border-[#2A2520]">
        <Link
          href={`/buyer/rfq/new?productId=${product.productId}`}
          className="inline-flex items-center gap-1 text-xs text-[#A89F91] hover:text-[#F5F0E8] transition-colors"
        >
          <span className="material-symbols-outlined text-[13px]">request_quote</span>
          Request quote instead
        </Link>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VendorProfilePage() {
  const { id: vendorId } = useParams<{ id: string }>();
  const router = useRouter();

  // quantities keyed by vendorProductId
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  // set of vendorProductIds added to cart
  const [cartSet, setCartSet] = useState<Set<string>>(new Set());
  const [showOrderModal, setShowOrderModal] = useState(false);

  const profileQuery = useQuery({
    queryKey: ['vendor-profile', vendorId],
    queryFn: () => fetchVendorProfile(vendorId),
    enabled: !!vendorId,
  });

  const productsQuery = useQuery({
    queryKey: ['vendor-products', vendorId],
    queryFn: () => fetchVendorProducts(vendorId),
    enabled: !!vendorId,
  });

  const addressesQuery = useQuery({
    queryKey: ['addresses'],
    queryFn: () => getAddresses(50, 0),
  });

  const profile = profileQuery.data;
  const products = productsQuery.data?.items ?? [];
  const addresses = addressesQuery.data?.items ?? [];

  const cartItems: CartItem[] = products
    .filter((p) => cartSet.has(p.vendorProductId))
    .map((p) => ({ product: p, quantity: quantities[p.vendorProductId] ?? 1 }));

  function handleAddToCart(product: VendorProductItem) {
    setCartSet((prev) => new Set([...prev, product.vendorProductId]));
    setQuantities((prev) => ({ ...prev, [product.vendorProductId]: prev[product.vendorProductId] ?? 1 }));
  }

  function handleRemoveFromCart(vendorProductId: string) {
    setCartSet((prev) => {
      const next = new Set(prev);
      next.delete(vendorProductId);
      return next;
    });
  }

  function handleQuantityChange(vendorProductId: string, q: number) {
    setQuantities((prev) => ({ ...prev, [vendorProductId]: q }));
  }

  function handleOrderSuccess(orderId: string) {
    setShowOrderModal(false);
    router.push(`/buyer/orders/${orderId}`);
  }

  // ─── Loading ───────────────────────────────────────────────────────────────

  if (profileQuery.isLoading) {
    return (
      <PageTransition className="space-y-6">
        <div className="h-8 w-48 bg-[#1A1714] rounded-xl animate-pulse" />
        <div className="bg-[#1A1714] border border-[#2A2520] rounded-2xl h-40 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-[#1A1714] border border-[#2A2520] rounded-2xl h-36 animate-pulse" />
          ))}
        </div>
      </PageTransition>
    );
  }

  if (profileQuery.isError || !profile) {
    return (
      <PageTransition className="space-y-6">
        <Link
          href="/buyer/vendors"
          className="inline-flex items-center gap-1 text-sm text-[#A89F91] hover:text-[#F5F0E8] transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back to Vendors
        </Link>
        <div className="bg-[#1A1714] border border-[#2A2520] rounded-2xl p-12 text-center">
          <span className="material-symbols-outlined text-4xl text-[#7A7067]">store_off</span>
          <p className="mt-3 font-semibold text-[#F5F0E8]">Vendor not found</p>
          <p className="mt-1 text-sm text-[#A89F91]">This vendor may no longer be available.</p>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition className="space-y-6">
      {/* Back */}
      <Link
        href="/buyer/vendors"
        className="inline-flex items-center gap-1 text-sm text-[#A89F91] hover:text-[#F5F0E8] transition-colors"
      >
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
        Back to Vendors
      </Link>

      {/* Vendor header card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="bg-[#1A1714] border border-[#2A2520] rounded-2xl p-6"
      >
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#D97706]/15 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[#D97706] text-[28px]">storefront</span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-[#F5F0E8] truncate">{profile.businessName}</h1>
            <p className="text-sm text-[#A89F91] flex items-center gap-1 mt-0.5">
              <span className="material-symbols-outlined text-[14px]">location_on</span>
              {profile.city}
            </p>
            <div className="mt-2">
              <StarRating rating={profile.averageRating} size="lg" />
              <p className="text-xs text-[#7A7067] mt-0.5">{profile.totalReviews} review{profile.totalReviews !== 1 ? 's' : ''}</p>
            </div>
          </div>
          {profile.approvedAt && (
            <div className="text-right text-xs text-[#7A7067] shrink-0 hidden sm:block">
              <span className="material-symbols-outlined text-[#D97706] text-[14px] block mx-auto mb-0.5">verified</span>
              Approved since<br />
              {formatIST(profile.approvedAt)}
            </div>
          )}
        </div>

        {profile.serviceableAreas.length > 0 && (
          <div className="mt-4 pt-4 border-t border-[#2A2520]">
            <p className="text-xs font-semibold text-[#7A7067] uppercase tracking-wide mb-2">Serviceable Areas</p>
            <div className="flex flex-wrap gap-1.5">
              {profile.serviceableAreas.map((area) => (
                <span key={area} className="px-2.5 py-1 rounded-full bg-[#2A2520] text-xs text-[#A89F91]">{area}</span>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      {/* Products section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[#F5F0E8]">
            Products
            {products.length > 0 && (
              <span className="ml-2 text-sm font-normal text-[#7A7067]">({products.length})</span>
            )}
          </h2>

          {cartSet.size > 0 && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              type="button"
              onClick={() => setShowOrderModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#D97706] hover:bg-[#B45309] text-white text-sm font-semibold transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">shopping_bag</span>
              Order {cartSet.size} item{cartSet.size !== 1 ? 's' : ''}
            </motion.button>
          )}
        </div>

        {productsQuery.isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-[#1A1714] border border-[#2A2520] rounded-2xl h-36 animate-pulse" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="bg-[#1A1714] border border-dashed border-[#2A2520] rounded-2xl p-12 text-center">
            <span className="material-symbols-outlined text-4xl text-[#3A3027]">inventory_2</span>
            <p className="mt-3 font-semibold text-[#F5F0E8]">No products listed</p>
            <p className="mt-1 text-sm text-[#A89F91]">This vendor hasn&apos;t listed any products yet.</p>
          </div>
        ) : (
          <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((product) => (
              <StaggerItem key={product.vendorProductId}>
                <ProductCard
                  product={product}
                  quantity={quantities[product.vendorProductId] ?? 1}
                  onQuantityChange={(q) => handleQuantityChange(product.vendorProductId, q)}
                  inCart={cartSet.has(product.vendorProductId)}
                  onAddToCart={() => handleAddToCart(product)}
                  onRemoveFromCart={() => handleRemoveFromCart(product.vendorProductId)}
                />
              </StaggerItem>
            ))}
          </StaggerContainer>
        )}
      </div>

      {/* Reviews section */}
      {profile.reviews.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-[#F5F0E8] mb-4">Recent Reviews</h2>
          <div className="space-y-3">
            {profile.reviews.map((review) => (
              <motion.div
                key={review.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#1A1714] border border-[#2A2520] rounded-2xl p-4"
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-[#2A2520] flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[#7A7067] text-[14px]">person</span>
                    </div>
                    <span className="text-sm font-medium text-[#F5F0E8]">
                      {review.buyer.name ?? 'Anonymous'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#7A7067]">
                    <StarRating rating={review.rating} />
                    <span>·</span>
                    <span>{formatIST(review.createdAt)}</span>
                  </div>
                </div>
                {review.comment && (
                  <p className="text-sm text-[#A89F91] leading-relaxed">{review.comment}</p>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Direct order modal */}
      <AnimatePresence>
        {showOrderModal && (
          <DirectOrderModal
            vendorId={vendorId}
            cart={cartItems}
            addresses={addresses}
            onClose={() => setShowOrderModal(false)}
            onSuccess={handleOrderSuccess}
          />
        )}
      </AnimatePresence>
    </PageTransition>
  );
}
