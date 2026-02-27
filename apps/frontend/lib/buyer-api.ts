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
  quantity: number | string;
  unit: string;
  notes?: string | null;
};

export type Rfq = {
  id: string;
  buyerId: string;
  addressId: string;
  city: string;
  status: 'OPEN' | 'QUOTED' | 'CLOSED' | 'EXPIRED';
  notes?: string | null;
  validUntil: string;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  items: RfqItem[];
};

export type Quote = {
  id: string;
  rfqId: string;
  vendorId: string;
  subtotal: string;
  taxAmount: string;
  deliveryFee: string;
  totalAmount: string;
  validUntil: string;
  notes?: string | null;
  isWithdrawn: boolean;
  createdAt: string;
  updatedAt: string;
  items: Array<{
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
  status: 'INITIATED' | 'SUCCESS' | 'FAILED';
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
  confirmedAt?: string | null;
  dispatchedAt?: string | null;
  deliveredAt?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OrderDetail = Order & {
  quote: Quote | null;
  rfq: Rfq | null;
  payment: Payment | null;
};

export type CreateRfqPayload = {
  addressId: string;
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

export async function fetchBuyerRfqs(limit = 20, offset = 0) {
  const response = await api.get('/api/v1/rfq', {
    params: { limit, offset },
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

export async function fetchQuotesForRfq(rfqId: string) {
  const response = await api.get(`/api/v1/quotes/rfq/${rfqId}`);
  return unwrapApiData<Quote[]>(response.data);
}

export async function createOrderFromQuote(quoteId: string) {
  const response = await api.post('/api/v1/orders', { quoteId });
  return unwrapApiData<Order>(response.data);
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
