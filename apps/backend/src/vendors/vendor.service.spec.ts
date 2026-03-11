import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { UserRole, VendorStatus } from '@prisma/client';
import { CloudinaryAdapter } from '../files/cloudinary.adapter';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { VendorService } from './vendor.service';

describe('VendorService', () => {
  let service: VendorService;

  const prisma = {
    vendorProfile: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    user: {
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  } as unknown as jest.Mocked<PrismaService>;

  const cloudinaryAdapter = {
    uploadFile: jest.fn(),
    getPrivateFolder: jest.fn().mockReturnValue('buildmart-vendor-docs'),
  } as unknown as CloudinaryAdapter;

  const notificationsService = {
    create: jest.fn().mockResolvedValue(undefined),
    createNotification: jest.fn().mockResolvedValue(undefined),
  } as unknown as NotificationsService;

  const baseDto = {
    businessName: 'Test Trading Co',
    gstNumber: '29ABCDE1234F1Z5',
    serviceableAreas: ['Hyderabad'],
    city: 'Hyderabad',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.auditLog.create as jest.Mock).mockResolvedValue({ id: 'audit-1' });
    (notificationsService.create as jest.Mock).mockResolvedValue(undefined);
    service = new VendorService(prisma, cloudinaryAdapter, notificationsService);
  });

  describe('onboard', () => {
    it('creates VendorProfile AND updates User.role to VENDOR in a single $transaction', async () => {
      prisma.vendorProfile.findUnique.mockResolvedValue(null);

      const mockProfile = {
        id: 'vp-1',
        userId: 'user-1',
        businessName: 'Test Trading Co',
        status: VendorStatus.PENDING,
      };

      // Mock the transaction to return the profile directly (new async function pattern)
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
        const mockTx = {
          vendorProfile: {
            create: jest.fn().mockResolvedValue(mockProfile),
          },
          vendorProduct: {
            createMany: jest.fn().mockResolvedValue({ count: 0 }),
          },
          user: {
            update: jest.fn().mockResolvedValue({ id: 'user-1', role: UserRole.VENDOR }),
          },
        };
        return await fn(mockTx);
      });

      const result = await service.onboard('user-1', baseDto);

      expect(result).toEqual(mockProfile);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('throws ConflictException if vendor profile already exists', async () => {
      prisma.vendorProfile.findUnique.mockResolvedValue({
        id: 'vp-existing',
        userId: 'user-1',
      });

      await expect(service.onboard('user-1', baseDto)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('calls validateDocumentUrl for gstDocumentUrl (SSRF protection)', async () => {
      prisma.vendorProfile.findUnique.mockResolvedValue(null);

      const dtoWithHttpUrl = {
        ...baseDto,
        gstDocumentUrl: 'http://evil.com/doc.pdf',
      };

      await expect(service.onboard('user-1', dtoWithHttpUrl)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException if documentUrl uses non-HTTPS protocol', async () => {
      prisma.vendorProfile.findUnique.mockResolvedValue(null);

      const dtoWithDataUrl = {
        ...baseDto,
        gstDocumentUrl: 'data:text/plain;base64,SGVsbG8=',
      };

      await expect(service.onboard('user-1', dtoWithDataUrl)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException if documentUrl points to localhost', async () => {
      prisma.vendorProfile.findUnique.mockResolvedValue(null);

      const dtoWithLocalhost = {
        ...baseDto,
        gstDocumentUrl: 'https://localhost/secret.pdf',
      };

      await expect(service.onboard('user-1', dtoWithLocalhost)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException if documentUrl points to 127.0.0.1', async () => {
      prisma.vendorProfile.findUnique.mockResolvedValue(null);

      const dtoWith127 = {
        ...baseDto,
        businessLicenseUrl: 'https://127.0.0.1/secret.pdf',
      };

      await expect(service.onboard('user-1', dtoWith127)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException if documentUrl has disallowed extension', async () => {
      prisma.vendorProfile.findUnique.mockResolvedValue(null);

      const dtoWithBadExt = {
        ...baseDto,
        gstDocumentUrl: 'https://example.com/malware.exe',
      };

      await expect(service.onboard('user-1', dtoWithBadExt)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('accepts valid HTTPS document URL with allowed extension', async () => {
      prisma.vendorProfile.findUnique.mockResolvedValue(null);

      const dtoWithValidUrl = {
        ...baseDto,
        gstDocumentUrl: 'https://storage.example.com/docs/gst-cert.pdf',
      };

      const mockProfile = {
        id: 'vp-2',
        userId: 'user-2',
        businessName: 'Test Trading Co',
      };

      (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
        const mockTx = {
          vendorProfile: {
            create: jest.fn().mockResolvedValue(mockProfile),
          },
          vendorProduct: {
            createMany: jest.fn().mockResolvedValue({ count: 0 }),
          },
          user: {
            update: jest.fn().mockResolvedValue({ id: 'user-2', role: UserRole.VENDOR }),
          },
        };
        return await fn(mockTx);
      });

      const result = await service.onboard('user-2', dtoWithValidUrl);
      expect(result).toEqual(mockProfile);
    });
  });

  describe('getProfile', () => {
    it('returns VendorProfile for the requesting user', async () => {
      const mockProfile = {
        id: 'vp-1',
        userId: 'user-1',
        businessName: 'Test Trading Co',
        status: VendorStatus.APPROVED,
      };

      prisma.vendorProfile.findUnique.mockResolvedValue(mockProfile);

      const result = await service.getProfile('user-1');

      expect(result).toEqual(mockProfile);
      expect(prisma.vendorProfile.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
    });

    it('throws NotFoundException if no profile exists', async () => {
      prisma.vendorProfile.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('user-nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateProfile', () => {
    it('updates allowed fields only', async () => {
      prisma.vendorProfile.findUnique.mockResolvedValue({
        id: 'vp-1',
        userId: 'user-1',
        businessName: 'Old Name',
      });

      const updatedProfile = {
        id: 'vp-1',
        userId: 'user-1',
        businessName: 'New Name',
        city: 'Secunderabad',
      };

      prisma.vendorProfile.update.mockResolvedValue(updatedProfile);

      const result = await service.updateProfile('user-1', {
        businessName: 'New Name',
        city: 'Secunderabad',
      });

      expect(result).toEqual(updatedProfile);
      expect(prisma.vendorProfile.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: {
          businessName: 'New Name',
          city: 'Secunderabad',
        },
      });
    });

    it('throws NotFoundException if profile does not exist', async () => {
      prisma.vendorProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.updateProfile('user-nonexistent', { businessName: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('does not include undefined fields in update data', async () => {
      prisma.vendorProfile.findUnique.mockResolvedValue({
        id: 'vp-1',
        userId: 'user-1',
      });

      prisma.vendorProfile.update.mockResolvedValue({ id: 'vp-1' });

      await service.updateProfile('user-1', { businessName: 'Updated' });

      const updateCall = (prisma.vendorProfile.update as jest.Mock).mock.calls[0][0];
      expect(updateCall.data).toEqual({ businessName: 'Updated' });
      expect(updateCall.data).not.toHaveProperty('status');
      expect(updateCall.data).not.toHaveProperty('userId');
    });
  });

  describe('approveVendor', () => {
    it('sets status to APPROVED on VendorProfile', async () => {
      prisma.vendorProfile.findUnique.mockResolvedValue({
        id: 'vp-1',
        status: VendorStatus.PENDING,
      });

      const approvedProfile = {
        id: 'vp-1',
        status: VendorStatus.APPROVED,
        approvedAt: expect.any(Date),
      };

      prisma.vendorProfile.update.mockResolvedValue(approvedProfile);

      const result = await service.approveVendor('vp-1', 'admin-1');

      expect(result.status).toBe(VendorStatus.APPROVED);
      expect(prisma.vendorProfile.update).toHaveBeenCalledWith({
        where: { id: 'vp-1' },
        data: {
          status: VendorStatus.APPROVED,
          approvedAt: expect.any(Date),
        },
      });
    });

    it('writes an AuditLog entry on approval', async () => {
      prisma.vendorProfile.findUnique.mockResolvedValue({
        id: 'vp-1',
        status: VendorStatus.PENDING,
      });
      prisma.vendorProfile.update.mockResolvedValue({
        id: 'vp-1',
        status: VendorStatus.APPROVED,
      });

      await service.approveVendor('vp-1', 'admin-1');

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: 'admin-1',
          action: 'VENDOR_APPROVED',
          entityType: 'VendorProfile',
          entityId: 'vp-1',
          newValue: { approvedAt: expect.any(String) },
        },
      });
    });

    it('throws NotFoundException if vendor does not exist', async () => {
      prisma.vendorProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.approveVendor('vp-nonexistent', 'admin-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('is idempotent — approving an already-approved vendor does not throw', async () => {
      prisma.vendorProfile.findUnique.mockResolvedValue({
        id: 'vp-1',
        status: VendorStatus.APPROVED,
        approvedAt: new Date('2026-01-01'),
      });

      prisma.vendorProfile.update.mockResolvedValue({
        id: 'vp-1',
        status: VendorStatus.APPROVED,
      });

      await expect(
        service.approveVendor('vp-1', 'admin-1'),
      ).resolves.toBeDefined();
    });

    it('does not throw if auditLog.create fails (non-blocking)', async () => {
      prisma.vendorProfile.findUnique.mockResolvedValue({
        id: 'vp-1',
        status: VendorStatus.PENDING,
      });
      prisma.vendorProfile.update.mockResolvedValue({
        id: 'vp-1',
        status: VendorStatus.APPROVED,
      });
      (prisma.auditLog.create as jest.Mock).mockRejectedValue(
        new Error('DB write failed'),
      );

      const result = await service.approveVendor('vp-1', 'admin-1');

      expect(result.status).toBe(VendorStatus.APPROVED);
    });
  });
});
