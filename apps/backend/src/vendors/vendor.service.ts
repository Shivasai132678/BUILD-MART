import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Prisma, VendorProfile } from '@prisma/client';
import { CloudinaryAdapter } from '../files/cloudinary.adapter';
import { PrismaService } from '../prisma/prisma.service';
import { OnboardVendorDto } from './dto/onboard-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';

@Injectable()
export class VendorService {
  private readonly logger = new Logger(VendorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryAdapter: CloudinaryAdapter,
  ) { }

  async onboard(userId: string, dto: OnboardVendorDto): Promise<VendorProfile> {
    const existingProfile = await this.prisma.vendorProfile.findUnique({
      where: { userId },
    });

    if (existingProfile) {
      throw new ConflictException('Vendor profile already exists for this user');
    }

    const [vendorProfile, _user] = await this.prisma.$transaction([
      this.prisma.vendorProfile.create({
        data: await this.buildCreateData(userId, dto),
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { role: UserRole.VENDOR },
      }),
    ]);

    this.logger.log(`Vendor profile created and role upgraded to VENDOR for userId=${userId}`);

    return vendorProfile;
  }

  async getProfile(userId: string): Promise<VendorProfile> {
    const profile = await this.prisma.vendorProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Vendor profile not found');
    }

    return profile;
  }

  async updateProfile(
    userId: string,
    dto: UpdateVendorDto,
  ): Promise<VendorProfile> {
    const existingProfile = await this.prisma.vendorProfile.findUnique({
      where: { userId },
    });

    if (!existingProfile) {
      throw new NotFoundException('Vendor profile not found');
    }

    const updatedProfile = await this.prisma.vendorProfile.update({
      where: { userId },
      data: this.buildUpdateData(dto),
    });

    this.logger.log(`Vendor profile updated for userId=${userId}`);

    return updatedProfile;
  }

  async approveVendor(vendorId: string, adminUserId?: string): Promise<VendorProfile> {
    const existingProfile = await this.prisma.vendorProfile.findUnique({
      where: { id: vendorId },
    });

    if (!existingProfile) {
      throw new NotFoundException('Vendor profile not found');
    }

    const approvedAt = new Date();

    const approvedProfile = await this.prisma.vendorProfile.update({
      where: { id: vendorId },
      data: {
        isApproved: true,
        approvedAt,
      },
    });

    await this.recordVendorApprovalAudit(vendorId, adminUserId, approvedAt);

    this.logger.log(`Vendor profile approved id=${vendorId}`);

    return approvedProfile;
  }

  private async buildCreateData(
    userId: string,
    dto: OnboardVendorDto,
  ): Promise<Prisma.VendorProfileCreateInput> {
    const gstDocumentUrl = await this.resolveDocumentUrl(dto.gstDocumentUrl);
    const businessLicenseUrl = await this.resolveDocumentUrl(
      dto.businessLicenseUrl,
    );

    const data: Prisma.VendorProfileCreateInput = {
      user: {
        connect: { id: userId },
      },
      businessName: dto.businessName,
      gstNumber: dto.gstNumber,
      serviceableAreas: dto.serviceableAreas,
    };

    if (dto.city !== undefined) {
      data.city = dto.city;
    }
    if (gstDocumentUrl !== undefined) {
      data.gstDocumentUrl = gstDocumentUrl;
    }
    if (businessLicenseUrl !== undefined) {
      data.businessLicenseUrl = businessLicenseUrl;
    }

    return data;
  }

  private buildUpdateData(dto: UpdateVendorDto): Prisma.VendorProfileUpdateInput {
    const data: Prisma.VendorProfileUpdateInput = {};

    if (dto.businessName !== undefined) {
      data.businessName = dto.businessName;
    }
    if (dto.gstNumber !== undefined) {
      data.gstNumber = dto.gstNumber;
    }
    if (dto.city !== undefined) {
      data.city = dto.city;
    }
    if (dto.serviceableAreas !== undefined) {
      data.serviceableAreas = dto.serviceableAreas;
    }
    if (dto.gstDocumentUrl !== undefined) {
      data.gstDocumentUrl = dto.gstDocumentUrl;
    }
    if (dto.businessLicenseUrl !== undefined) {
      data.businessLicenseUrl = dto.businessLicenseUrl;
    }

    return data;
  }

  private async resolveDocumentUrl(documentUrl?: string): Promise<string | undefined> {
    if (!documentUrl) {
      return undefined;
    }

    this.validateDocumentUrl(documentUrl);

    if (
      documentUrl.startsWith('http://') ||
      documentUrl.startsWith('https://')
    ) {
      // TODO: file upload via multipart/form-data is a Phase 2 frontend task.
      return documentUrl;
    }

    if (documentUrl.startsWith('file://')) {
      return this.cloudinaryAdapter.uploadFile(
        documentUrl.replace('file://', ''),
        this.cloudinaryAdapter.getPrivateFolder(),
      );
    }

    return this.cloudinaryAdapter.uploadFile(
      documentUrl,
      this.cloudinaryAdapter.getPrivateFolder(),
    );
  }

  private validateDocumentUrl(url: string): void {
    if (!url) return;
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException('Invalid document URL format');
    }
    // Only allow HTTPS URLs (no file://, data://, localhost)
    if (parsed.protocol !== 'https:') {
      throw new BadRequestException('Document URL must use HTTPS');
    }
    // Block localhost/private IPs (SSRF prevention)
    const blocked = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
    if (blocked.some(b => parsed.hostname.includes(b))) {
      throw new BadRequestException('Document URL hostname is not allowed');
    }
    // Allow only common document file extensions
    const allowedExt = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
    const hasAllowedExt = allowedExt.some(ext =>
      parsed.pathname.toLowerCase().endsWith(ext),
    );
    if (!hasAllowedExt) {
      throw new BadRequestException(
        'Document URL must point to a PDF or image file',
      );
    }
  }

  private async recordVendorApprovalAudit(
    vendorId: string,
    adminUserId: string | undefined,
    approvedAt: Date,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: adminUserId ?? null,
          action: 'VENDOR_APPROVED',
          entityType: 'VendorProfile',
          entityId: vendorId,
          newValue: { approvedAt: approvedAt.toISOString() },
        },
      });

      this.logger.log(
        `Audit log created for vendor approval vendorId=${vendorId} by userId=${adminUserId ?? 'unknown'}`,
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown audit log error';
      this.logger.error(
        `Failed to create vendor approval audit log for vendorId=${vendorId}: ${message}`,
      );
    }
  }
}
