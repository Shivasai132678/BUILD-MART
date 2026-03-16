import { api, unwrapApiData } from '@/lib/api';
import type { Order, OrderDetail, PaginatedResponse, Rfq } from '@/lib/buyer-api';

export type { VendorProfile } from '@/lib/vendor-profile-api';
export { getVendorProfile } from '@/lib/vendor-profile-api';

export type CreateQuoteItemPayload = {
  productName: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  subtotal: string;
};

export type SubmitQuotePayload = {
  rfqId: string;
  subtotal: string;
  taxAmount: string;
  deliveryFee: string;
  totalAmount: string;
  validUntil: string;
  notes?: string;
  items: CreateQuoteItemPayload[];
};

export type UpdateVendorOrderStatusBody = {
  status: 'OUT_FOR_DELIVERY' | 'DELIVERED';
};

export async function getAvailableRfqs(limit: number, offset: number) {
  const response = await api.get('/api/v1/rfq/available', {
    params: { limit, offset },
  });

  return unwrapApiData<PaginatedResponse<Rfq>>(response.data);
}

export async function browseAllRfqs(limit: number, offset: number, categoryId?: string) {
  const response = await api.get('/api/v1/rfq/browse', {
    params: {
      limit,
      offset,
      ...(categoryId ? { categoryId } : {}),
    },
  });

  return unwrapApiData<PaginatedResponse<Rfq>>(response.data);
}

export async function getRfqById(id: string) {
  const response = await api.get(`/api/v1/rfq/${id}`);
  return unwrapApiData<Rfq>(response.data);
}

export async function submitQuote(payload: SubmitQuotePayload) {
  const response = await api.post('/api/v1/quotes', payload);
  return unwrapApiData(response.data);
}

export async function getVendorOrders(
  limit: number,
  offset: number,
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

export async function getVendorOrderById(id: string) {
  const response = await api.get(`/api/v1/orders/${id}`);
  return unwrapApiData<OrderDetail>(response.data);
}

export async function updateOrderStatus(
  id: string,
  body: UpdateVendorOrderStatusBody,
) {
  const response = await api.patch(`/api/v1/orders/${id}/status`, body);
  return unwrapApiData<Order>(response.data);
}

export type VendorProduct = {
  id: string;
  productId: string;
  name: string;
  unit: string;
  category: { id: string; name: string };
  stockAvailable: boolean;
  customPrice: string | null;
};

export async function getVendorProducts() {
  const response = await api.get('/api/v1/vendors/products');
  return unwrapApiData<{ items: VendorProduct[] }>(response.data);
}

export async function addVendorProducts(productIds: string[]) {
  const response = await api.post('/api/v1/vendors/products', { productIds });
  return unwrapApiData<{ added: number }>(response.data);
}

export async function removeVendorProduct(productId: string) {
  const response = await api.delete(`/api/v1/vendors/products/${productId}`);
  return unwrapApiData<{ removed: boolean }>(response.data);
}

export type VendorStats = {
  totalOrders: number;
  pendingOrders: number;
  deliveredOrders: number;
  totalRevenue: string;
  averageRating: string | null;
  totalReviews: number;
  openRfqs: number;
  totalQuotes: number;
};

export async function getVendorStats() {
  const response = await api.get('/api/v1/vendors/stats');
  return unwrapApiData<VendorStats>(response.data);
}

export type VendorDispute = {
  id: string;
  orderId: string;
  reason: string;
  description: string;
  status: 'OPEN' | 'RESOLVED' | 'CLOSED';
  adminNotes?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  order?: { referenceCode: string | null; totalAmount: string } | null;
};

export async function getVendorDisputes(limit = 20, offset = 0, status?: string) {
  const response = await api.get('/api/v1/disputes/vendor', {
    params: { limit, offset, ...(status ? { status } : {}) },
  });
  return unwrapApiData<{ items: VendorDispute[]; total: number }>(response.data);
}

export type VendorQuote = {
  id: string;
  rfqId: string;
  subtotal: string;
  taxAmount: string;
  deliveryFee: string;
  totalAmount: string;
  validUntil: string;
  notes?: string | null;
  isWithdrawn: boolean;
  counterOfferPrice?: string | null;
  counterOfferNote?: string | null;
  counterStatus?: string | null;
  createdAt: string;
};

export async function getMyQuoteForRfq(rfqId: string): Promise<VendorQuote | null> {
  const response = await api.get(`/api/v1/quotes/my/${rfqId}`);
  return unwrapApiData<VendorQuote | null>(response.data);
}

export async function respondToCounterOffer(quoteId: string, accept: boolean) {
  const response = await api.post(`/api/v1/quotes/${quoteId}/counter/respond?accept=${accept}`);
  return unwrapApiData<{ id: string; counterStatus: string }>(response.data);
}

