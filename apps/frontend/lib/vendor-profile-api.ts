import { api, unwrapApiData } from '@/lib/api';

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

export type OnboardVendorPayload = {
  businessName: string;
  gstNumber: string;
  city: string;
  serviceableAreas: string[];
  gstDocumentUrl?: string;
  businessLicenseUrl?: string;
};

export type UpdateVendorProfilePayload = Partial<OnboardVendorPayload>;

export async function getVendorProfile() {
  const response = await api.get('/api/v1/vendors/profile');
  return unwrapApiData<VendorProfile>(response.data);
}

export async function onboardVendor(data: OnboardVendorPayload) {
  const response = await api.post('/api/v1/vendors/onboard', data);
  return unwrapApiData<VendorProfile>(response.data);
}

export async function updateVendorProfile(data: UpdateVendorProfilePayload) {
  const response = await api.patch('/api/v1/vendors/profile', data);
  return unwrapApiData<VendorProfile>(response.data);
}
