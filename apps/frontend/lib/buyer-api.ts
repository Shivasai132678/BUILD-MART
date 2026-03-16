import { api, unwrapApiData } from '@/lib/api';

export type PaginatedResponse<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

export type Product = {
  id: string;
  categoryId: string;
  name: string;
  unit: string;
  basePrice: string;
  createdAt: string;
};

export type Address = {
  id: string;
  userId: string;
  label?: string | null;
  line1: string;
  line2?: string | null;
  area: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RfqItem = {
  id: string;
  productId: string;
  product?: {
    name: string;
  } | null;
  quantity: number | string;
  unit: string;
  notes?: string | null;
};

export type Rfq = {
  id: string;
  buyerId: string;
  addressId: string;
  city: string;
  title?: string | null;
  status: 'OPEN' | 'QUOTED' | 'CLOSED' | 'EXPIRED';
  notes?: string | null;
  validUntil: string;
  closedAt?: string | null;
  referenceCode?: string | null;
  createdAt: string;
  updatedAt: string;
  items: RfqItem[];
};

export type Quote = {
  id: string;
  rfqId: string;
  vendorId: string;
  vendor?: { businessName: string } | null;
  subtotal: string;
  taxAmount: string;
  deliveryFee: string;
  totalAmount: string;
  validUntil: string;
  notes?: string | null;
  isWithdrawn: boolean;
  counterOfferPrice?: string | null;
  counterOfferNote?: string | null;
  counterStatus?: string | null; // null | 'PENDING' | 'ACCEPTED' | 'REJECTED'
  createdAt: string;
  updatedAt: string;
  items?: Array<{
    id: string;
    quoteId: string;
    productName: string;
    quantity: string;
    unit: string;
    unitPrice: string;
    subtotal: string;
  }>;
};

export type Payment = {
  id: string;
  orderId: string;
  status: 'INITIATED' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
  amount: string;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  failureReason?: string | null;
  webhookVerified?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Order = {
  id: string;
  rfqId: string;
  quoteId: string;
  buyerId: string;
  vendorId: string;
  totalAmount: string;
  status: 'CONFIRMED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';
  paymentMethod?: string;
  referenceCode?: string | null;
  confirmedAt?: string | null;
  dispatchedAt?: string | null;
  deliveredAt?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OrderReview = {
  id: string;
  rating: number;
  comment?: string | null;
};

export type OrderDetail = Order & {
  quote: Quote | null;
  rfq: Rfq | null;
  payment: Payment | null;
  review?: OrderReview | null;
  vendor?: { businessName: string } | null;
};

export type CreateRfqPayload = {
  addressId: string;
  title?: string;
  notes?: string;
  validUntil: string;
  items: Array<{
    productId: string;
    quantity: number;
    unit: string;
    notes?: string;
  }>;
};

export type CreateAddressPayload = {
  label?: string;
  line1: string;
  line2?: string;
  area?: string;
  city: string;
  state: string;
  pincode: string;
  isDefault?: boolean;
};

export async function fetchProducts(limit = 200, offset = 0) {
  const response = await api.get('/api/v1/products', {
    params: { limit, offset },
  });

  return unwrapApiData<PaginatedResponse<Product>>(response.data);
}

export async function getAddresses(limit = 20, offset = 0) {
  const response = await api.get('/api/v1/addresses', {
    params: { limit, offset },
  });

  return unwrapApiData<PaginatedResponse<Address>>(response.data);
}

export async function createAddress(payload: CreateAddressPayload) {
  const response = await api.post('/api/v1/addresses', payload);
  return unwrapApiData<Address>(response.data);
}

export async function fetchBuyerRfqs(limit = 20, offset = 0, status?: string) {
  const response = await api.get('/api/v1/rfq', {
    params: { limit, offset, ...(status ? { status } : {}) },
  });

  return unwrapApiData<PaginatedResponse<Rfq>>(response.data);
}

export async function fetchBuyerRfq(id: string) {
  const response = await api.get(`/api/v1/rfq/${id}`);
  return unwrapApiData<Rfq>(response.data);
}

export async function createRfq(payload: CreateRfqPayload) {
  const response = await api.post('/api/v1/rfq', payload);
  return unwrapApiData<Rfq>(response.data);
}

export type PaginatedQuotesResponse = {
  data: Quote[];
  total: number;
  limit?: number;
  offset?: number;
};

export async function fetchQuotesForRfq(rfqId: string) {
  const response = await api.get(`/api/v1/quotes/rfq/${rfqId}`);
  const raw = unwrapApiData<PaginatedQuotesResponse | Quote[]>(response.data);

  // Handle paginated {data, total} response
  if (raw && typeof raw === 'object' && 'data' in raw && Array.isArray((raw as PaginatedQuotesResponse).data)) {
    return (raw as PaginatedQuotesResponse).data;
  }

  // Fallback: if it's already an array
  if (Array.isArray(raw)) {
    return raw;
  }

  return [];
}

export async function createOrderFromQuote(quoteId: string) {
  const response = await api.post('/api/v1/orders', { quoteId });
  return unwrapApiData<Order>(response.data);
}

export async function sendCounterOffer(quoteId: string, counterOfferPrice: string, counterOfferNote?: string) {
  const response = await api.post(`/api/v1/quotes/${quoteId}/counter`, {
    counterOfferPrice,
    ...(counterOfferNote?.trim() ? { counterOfferNote: counterOfferNote.trim() } : {}),
  });
  return unwrapApiData<{ id: string; counterOfferPrice: string; counterOfferNote: string | null; counterStatus: string }>(response.data);
}

export async function fetchBuyerOrders(
  limit = 10,
  offset = 0,
  status?: Order['status'],
) {
  const response = await api.get('/api/v1/orders', {
    params: {
      limit,
      offset,
      ...(status ? { status } : {}),
    },
  });

  return unwrapApiData<PaginatedResponse<Order>>(response.data);
}

export async function fetchBuyerOrder(id: string) {
  const response = await api.get(`/api/v1/orders/${id}`);
  return unwrapApiData<OrderDetail>(response.data);
}

export async function cancelBuyerOrder(id: string, cancelReason?: string) {
  const response = await api.post(`/api/v1/orders/${id}/cancel`, {
    ...(cancelReason ? { cancelReason } : {}),
  });

  return unwrapApiData<Order>(response.data);
}

export type CreatePaymentOrderResponse = {
  razorpayOrderId: string;
  amount: number;
  currency: 'INR';
  key: string;
};

export async function createPaymentOrder(orderId: string) {
  const response = await api.post('/api/v1/payments/create-order', { orderId });
  return unwrapApiData<CreatePaymentOrderResponse>(response.data);
}

export type SubmitReviewPayload = {
  rating: number;
  comment?: string;
};

export async function submitReview(orderId: string, payload: SubmitReviewPayload) {
  const response = await api.post(`/api/v1/orders/${orderId}/review`, payload);
  return unwrapApiData(response.data);
}

// ─── Vendor discovery ─────────────────────────────────────────────────────

export type VendorDiscoveryItem = {
  id: string;
  businessName: string;
  city: string;
  serviceableAreas: string[];
  averageRating: string;
  totalReviews: number;
  approvedAt: string | null;
  _count: { products: number };
  user: { name: string | null };
};

export type VendorReview = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  buyer: { name: string | null };
};

export type VendorProfile = {
  id: string;
  businessName: string;
  city: string;
  serviceableAreas: string[];
  averageRating: string;
  totalReviews: number;
  approvedAt: string | null;
  _count: { products: number };
  user: { name: string | null };
  reviews: VendorReview[];
};

export type VendorProductItem = {
  vendorProductId: string;
  productId: string;
  name: string;
  unit: string;
  description: string | null;
  imageUrl: string | null;
  category: { id: string; name: string };
  price: string;
  stockAvailable: boolean;
};

export async function discoverVendors(params: {
  city?: string;
  categoryId?: string;
  minRating?: number;
  limit?: number;
  offset?: number;
}) {
  const response = await api.get('/api/v1/vendors/discover', { params });
  return unwrapApiData<PaginatedResponse<VendorDiscoveryItem>>(response.data);
}

export async function fetchVendorProfile(vendorId: string) {
  const response = await api.get(`/api/v1/vendors/${vendorId}`);
  return unwrapApiData<VendorProfile>(response.data);
}

export async function fetchVendorProducts(vendorId: string) {
  const response = await api.get(`/api/v1/vendors/${vendorId}/products`);
  return unwrapApiData<{ items: VendorProductItem[] }>(response.data);
}

export type CreateDirectOrderPayload = {
  vendorId: string;
  addressId: string;
  items: Array<{ productId: string; quantity: number }>;
};

export async function createDirectOrder(payload: CreateDirectOrderPayload) {
  const response = await api.post('/api/v1/orders/direct', payload);
  return unwrapApiData<Order>(response.data);
}

// ─── Disputes ──────────────────────────────────────────────────────────────

export type Dispute = {
  id: string;
  orderId: string;
  buyerId: string;
  vendorId: string;
  reason: string;
  description: string;
  status: 'OPEN' | 'RESOLVED' | 'CLOSED';
  adminNotes?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  order?: { referenceCode: string | null; totalAmount: string } | null;
};

export async function createDispute(payload: {
  orderId: string;
  reason: string;
  description: string;
}) {
  const response = await api.post('/api/v1/disputes', payload);
  return unwrapApiData<Dispute>(response.data);
}

export async function fetchMyDisputes(limit = 20, offset = 0, status?: string) {
  const response = await api.get('/api/v1/disputes/my', {
    params: { limit, offset, ...(status ? { status } : {}) },
  });
  return unwrapApiData<PaginatedResponse<Dispute>>(response.data);
}

// ─── Invoice download ─────────────────────────────────────────────────────

export async function downloadInvoice(orderId: string): Promise<Blob> {
  const response = await api.get(`/api/v1/orders/${orderId}/invoice`, {
    responseType: 'blob',
  });
  return response.data as Blob;
}
