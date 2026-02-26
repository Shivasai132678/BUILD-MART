import { api, unwrapApiData } from '@/lib/api';
import type { Order, OrderDetail, PaginatedResponse, Rfq } from '@/lib/buyer-api';

export type VendorProfile = {
  id: string;
  userId: string;
  businessName: string;
  gstNumber: string;
  gstDocumentUrl?: string | null;
  businessLicenseUrl?: string | null;
  city: string;
  serviceableAreas: string[];
  isApproved: boolean;
  approvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

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

export async function getVendorProfile() {
  const response = await api.get('/api/v1/vendors/profile');
  return unwrapApiData<VendorProfile>(response.data);
}

export async function getAvailableRfqs(limit: number, offset: number) {
  const response = await api.get('/api/v1/rfq/available', {
    params: { limit, offset },
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

