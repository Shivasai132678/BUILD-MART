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
  gmv?: string;
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
  totalAmount: string;
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

export async function forceCancelOrder(id: string) {
  const response = await api.post(`/api/v1/admin/orders/${id}/cancel`);
  return unwrapApiData<AdminOrder>(response.data);
}

export async function bulkApproveVendors(vendorIds: string[]) {
  const response = await api.post('/api/v1/admin/vendors/bulk-approve', { vendorIds });
  return unwrapApiData<{ approved: number }>(response.data);
}

export async function bulkSuspendVendors(vendorIds: string[]) {
  const response = await api.post('/api/v1/admin/vendors/bulk-suspend', { vendorIds });
  return unwrapApiData<{ suspended: number }>(response.data);
}

export type AdminDispute = {
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
  order?: { referenceCode: string | null; totalAmount: string } | null;
};

export async function getAdminDisputes(limit = 20, offset = 0, status?: string) {
  const response = await api.get('/api/v1/disputes/admin/all', {
    params: { limit, offset, ...(status ? { status } : {}) },
  });
  return unwrapApiData<PaginatedResponse<AdminDispute>>(response.data);
}

export async function resolveAdminDispute(id: string, payload: { adminNotes?: string; status: 'RESOLVED' | 'CLOSED' }) {
  const response = await api.patch(`/api/v1/disputes/admin/${id}/resolve`, payload);
  return unwrapApiData<AdminDispute>(response.data);
}

// ─── CATEGORIES ──────────────────────────────────────────────

export type AdminCategory = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  isActive: boolean;
  createdAt: string;
};

export async function listCategories(limit = 50, offset = 0) {
  const response = await api.get('/api/v1/categories', { params: { limit, offset } });
  return unwrapApiData<PaginatedResponse<AdminCategory>>(response.data);
}

export async function createCategory(payload: {
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  isActive?: boolean;
}) {
  const response = await api.post('/api/v1/categories', payload);
  return unwrapApiData<AdminCategory>(response.data);
}

export async function updateCategory(id: string, payload: {
  name?: string;
  slug?: string;
  description?: string;
  imageUrl?: string;
  isActive?: boolean;
}) {
  const response = await api.patch(`/api/v1/categories/${id}`, payload);
  return unwrapApiData<AdminCategory>(response.data);
}

export async function deleteCategory(id: string) {
  const response = await api.delete(`/api/v1/categories/${id}`);
  return unwrapApiData<{ deleted: boolean }>(response.data);
}

// ─── PRODUCTS ────────────────────────────────────────────────

export type AdminProduct = {
  id: string;
  categoryId: string;
  name: string;
  description?: string | null;
  unit: string;
  basePrice: string;
  imageUrl?: string | null;
  isActive: boolean;
  createdAt: string;
  category?: { id: string; name: string };
};

export async function listAdminProducts(limit = 50, offset = 0, categoryId?: string, search?: string) {
  const response = await api.get('/api/v1/products', {
    params: { limit, offset, ...(categoryId ? { categoryId } : {}), ...(search ? { search } : {}) },
  });
  return unwrapApiData<PaginatedResponse<AdminProduct>>(response.data);
}

export async function createProduct(payload: {
  categoryId: string;
  name: string;
  description?: string;
  unit: string;
  basePrice: string;
  imageUrl?: string;
  isActive?: boolean;
}) {
  const response = await api.post('/api/v1/products', payload);
  return unwrapApiData<AdminProduct>(response.data);
}

export async function updateProduct(id: string, payload: {
  categoryId?: string;
  name?: string;
  description?: string;
  unit?: string;
  basePrice?: string;
  imageUrl?: string;
  isActive?: boolean;
}) {
  const response = await api.patch(`/api/v1/products/${id}`, payload);
  return unwrapApiData<AdminProduct>(response.data);
}

export async function deleteProduct(id: string) {
  const response = await api.delete(`/api/v1/products/${id}`);
  return unwrapApiData<{ deleted: boolean }>(response.data);
}

// ─── FILE UPLOAD ─────────────────────────────────────────────

export async function uploadProductImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/api/v1/files/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  const data = unwrapApiData<{ url: string }>(response.data);
  return data.url;
}
