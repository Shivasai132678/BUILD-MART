import { api, unwrapApiData } from '@/lib/api';

type PaginatedResponse<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

type PendingVendorsResponse<T> = {
  data: T[];
  total: number;
  limit: number;
  offset: number;
};

export type AdminMetrics = {
  totalUsers?: number;
  totalVendors?: number;
  pendingVendors?: number;
  totalRfqs?: number;
  totalOrders?: number;
  gmv?: string | number;
};

export type PendingVendorProfile = {
  id: string;
  businessName: string;
  gstNumber: string;
  city: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  createdAt: string;
  user?: {
    name?: string | null;
    phone?: string | null;
    email?: string | null;
  };
};

export type AdminUser = {
  id: string;
  phone: string;
  role: string;
  name?: string | null;
  createdAt?: string;
};

export type AdminVendorProfile = {
  id: string;
  businessName: string;
  gstNumber: string;
  city: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  createdAt: string;
  user?: {
    name?: string | null;
    phone?: string | null;
    email?: string | null;
  };
};

export type AdminOrder = {
  id: string;
  status: string;
  totalAmount: string | number;
  createdAt: string;
  buyerId?: string;
  vendorProfileId?: string;
};

export type AdminRfq = {
  id: string;
  status: string;
  createdAt: string;
  buyerId?: string;
  city?: string;
};

export async function getMetrics() {
  const response = await api.get('/api/v1/admin/metrics');
  return unwrapApiData<AdminMetrics>(response.data);
}

export async function getPendingVendors() {
  const response = await api.get('/api/v1/admin/vendors/pending', {
    params: {
      limit: 50,
      offset: 0,
    },
  });

  return unwrapApiData<PendingVendorsResponse<PendingVendorProfile>>(response.data);
}

export async function approveVendor(id: string) {
  const response = await api.patch(`/api/v1/admin/vendors/${id}/approve`);
  return unwrapApiData<PendingVendorProfile>(response.data);
}

export async function rejectVendor(id: string, rejectionReason?: string) {
  const response = await api.patch(`/api/v1/admin/vendors/${id}/reject`, {
    ...(rejectionReason ? { rejectionReason } : {}),
  });
  return unwrapApiData<PendingVendorProfile>(response.data);
}

export async function getUsers(limit: number, offset: number) {
  const response = await api.get('/api/v1/admin/users', {
    params: { limit, offset },
  });

  return unwrapApiData<PaginatedResponse<AdminUser>>(response.data);
}

export async function getAllVendors(limit: number, offset: number, status?: string) {
  const response = await api.get('/api/v1/admin/vendors', {
    params: { limit, offset, ...(status ? { status } : {}) },
  });
  return unwrapApiData<PaginatedResponse<AdminVendorProfile>>(response.data);
}

export async function getAllRfqs(limit: number, offset: number) {
  const response = await api.get('/api/v1/admin/rfqs', {
    params: { limit, offset },
  });
  return unwrapApiData<PaginatedResponse<AdminRfq>>(response.data);
}

export async function getAllOrders(limit: number, offset: number, status?: string) {
  const response = await api.get('/api/v1/admin/orders', {
    params: { limit, offset, ...(status ? { status } : {}) },
  });
  return unwrapApiData<PaginatedResponse<AdminOrder>>(response.data);
}

export type VendorStatusValue = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export async function updateVendorStatus(id: string, status: VendorStatusValue) {
  const response = await api.patch(`/api/v1/admin/vendors/${id}/status`, { status });
  return unwrapApiData<AdminVendorProfile>(response.data);
}
