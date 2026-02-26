import { api, unwrapApiData } from '@/lib/api';

type PaginatedResponse<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

export type AdminMetrics = {
  totalUsers?: number;
  totalApprovedVendors?: number;
  totalRfqs?: number;
  totalOrders?: number;
  gmv?: string | number;
};

export type PendingVendorProfile = {
  id: string;
  businessName: string;
  gstNumber: string;
  city: string;
  isApproved: boolean;
  createdAt: string;
};

export type AdminUser = {
  id: string;
  phone: string;
  role: string;
  name?: string | null;
  createdAt?: string;
};

export async function getMetrics() {
  const response = await api.get('/api/v1/admin/metrics');
  return unwrapApiData<AdminMetrics>(response.data);
}

export async function getPendingVendors() {
  const response = await api.get('/api/v1/vendors', {
    params: {
      isApproved: false,
      limit: 50,
      offset: 0,
    },
  });

  return unwrapApiData<PaginatedResponse<PendingVendorProfile>>(response.data);
}

export async function approveVendor(id: string) {
  const response = await api.patch(`/api/v1/admin/vendors/${id}/approve`);
  return unwrapApiData<PendingVendorProfile>(response.data);
}

export async function getUsers(limit: number, offset: number) {
  const response = await api.get('/api/v1/admin/users', {
    params: { limit, offset },
  });

  return unwrapApiData<PaginatedResponse<AdminUser>>(response.data);
}
