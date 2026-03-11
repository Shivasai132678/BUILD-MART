import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { UserRole, NotificationType, VendorStatus } from '@prisma/client';
import type { Prisma, VendorProfile } from '@prisma/client';
import { CloudinaryAdapter } from '../files/cloudinary.adapter';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { OnboardVendorDto } from './dto/onboard-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';

@Injectable()
export class VendorService {
  private readonly logger = new Logger(VendorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryAdapter: CloudinaryAdapter,
    private readonly notificationsService: NotificationsService,
  ) { }

  async onboard(userId: string, dto: OnboardVendorDto): Promise<VendorProfile> {
    const existingProfile = await this.prisma.vendorProfile.findUnique({
      where: { userId },
    });

    if (existingProfile) {
      throw new ConflictException('Vendor profile already exists for this user');
    }

    // Validate productIds if provided
    if (dto.productIds && dto.productIds.length > 0) {
      const existingProducts = await this.prisma.product.findMany({
        where: { id: { in: dto.productIds } },
        select: { id: true },
      });
      const existingIds = new Set(existingProducts.map(p => p.id));
      const invalidIds = dto.productIds.filter(id => !existingIds.has(id));
      if (invalidIds.length > 0) {
        throw new BadRequestException(`Invalid product IDs: ${invalidIds.join(', ')}`);
      }
    }

    // Resolve document URLs before the transaction to avoid external I/O inside a DB transaction
    const createData = await this.buildCreateData(userId, dto);

    const vendorProfile = await this.prisma.$transaction(async (tx) => {
      // Create vendor profile (data resolved outside transaction to avoid external I/O inside tx)
      const profile = await tx.vendorProfile.create({
        data: createData,
      });

      // Create vendor products if provided
      if (dto.productIds && dto.productIds.length > 0) {
        await tx.vendorProduct.createMany({
          data: dto.productIds.map(productId => ({
            vendorId: profile.id,
            productId,
            stockAvailable: true,
          })),
          skipDuplicates: true,
        });
        this.logger.log(`Created ${dto.productIds.length} vendor products for vendorId=${profile.id}`);
      }

      // Update user role
      await tx.user.update({
        where: { id: userId },
        data: { role: UserRole.VENDOR },
      });

      return profile;
    });

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
        status: VendorStatus.APPROVED,
        approvedAt,
      },
    });

    await this.recordVendorApprovalAudit(vendorId, adminUserId, approvedAt);

    this.logger.log(`Vendor profile approved id=${vendorId}`);

    await this.notificationsService.create({
      userId: existingProfile.userId,
      type: NotificationType.VENDOR_APPROVED,
      title: 'Vendor profile approved',
      message: 'Your vendor profile has been approved. You can now submit quotes.',
      metadata: { vendorProfileId: vendorId },
    }).catch((err: unknown) => {
      this.logger.error(`Failed to notify vendor approval userId=${existingProfile.userId}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    });

    return approvedProfile;
  }

  async rejectVendor(
    vendorId: string,
    rejectionReason?: string,
    adminUserId?: string,
  ): Promise<VendorProfile> {
    const existingProfile = await this.prisma.vendorProfile.findUnique({
      where: { id: vendorId },
    });

    if (!existingProfile) {
      throw new NotFoundException('Vendor profile not found');
    }

    if (existingProfile.status === VendorStatus.APPROVED) {
      throw new BadRequestException('Cannot reject an already approved vendor');
    }

    const rejectedAt = new Date();

    const rejectedProfile = await this.prisma.vendorProfile.update({
      where: { id: vendorId },
      data: {
        status: VendorStatus.REJECTED,
        rejectedAt,
        ...(rejectionReason !== undefined ? { rejectionReason } : {}),
      },
    });

    await this.recordVendorRejectionAudit(vendorId, adminUserId, rejectedAt, rejectionReason);

    this.logger.log(`Vendor profile rejected id=${vendorId}`);

    await this.notificationsService.create({
      userId: existingProfile.userId,
      type: NotificationType.VENDOR_REJECTED,
      title: 'Vendor profile requires changes',
      message: rejectionReason
        ? `Your vendor profile was not approved: ${rejectionReason}`
        : 'Your vendor profile was not approved. Please update and resubmit.',
      metadata: {
        vendorProfileId: vendorId,
        ...(rejectionReason !== undefined ? { rejectionReason } : {}),
      },
    }).catch((err: unknown) => {
      this.logger.error(`Failed to notify vendor rejection userId=${existingProfile.userId}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    });

    return rejectedProfile;
  }

  async getVendorProducts(userId: string) {
    const vendorProfile = await this.prisma.vendorProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!vendorProfile) {
      throw new NotFoundException('Vendor profile not found');
    }

    const vendorProducts = await this.prisma.vendorProduct.findMany({
      where: { vendorId: vendorProfile.id },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            unit: true,
            category: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      items: vendorProducts.map((vp) => ({
        id: vp.id,
        productId: vp.productId,
        name: vp.product.name,
        unit: vp.product.unit,
        category: vp.product.category,
        stockAvailable: vp.stockAvailable,
        customPrice: vp.customPrice?.toString() ?? null,
      })),
    };
  }

  async addVendorProducts(userId: string, productIds: string[]) {
    if (!productIds || productIds.length === 0) {
      throw new BadRequestException('No products to add');
    }

    const vendorProfile = await this.prisma.vendorProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!vendorProfile) {
      throw new NotFoundException('Vendor profile not found');
    }

    // Validate product IDs
    const existingProducts = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true },
    });
    const existingIds = new Set(existingProducts.map((p) => p.id));
    const invalidIds = productIds.filter((id) => !existingIds.has(id));
    if (invalidIds.length > 0) {
      throw new BadRequestException(
        `Invalid product IDs: ${invalidIds.join(', ')}`,
      );
    }

    // Create vendor products (skip duplicates)
    const created = await this.prisma.vendorProduct.createMany({
      data: productIds.map((productId) => ({
        vendorId: vendorProfile.id,
        productId,
        stockAvailable: true,
      })),
      skipDuplicates: true,
    });

    this.logger.log(
      `Added ${created.count} products to vendorId=${vendorProfile.id}`,
    );

    return { added: created.count };
  }

  async removeVendorProduct(userId: string, productId: string) {
    const vendorProfile = await this.prisma.vendorProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!vendorProfile) {
      throw new NotFoundException('Vendor profile not found');
    }

    // Atomically delete the vendor product entry to avoid the findFirst → delete race
    const result = await this.prisma.vendorProduct.deleteMany({
      where: {
        vendorId: vendorProfile.id,
        productId,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Product not found in vendor profile');
    }

    this.logger.log(
      `Removed product ${productId} from vendorId=${vendorProfile.id}`,
    );

    return { removed: true };
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

  private async recordVendorRejectionAudit(
    vendorId: string,
    adminUserId: string | undefined,
    rejectedAt: Date,
    rejectionReason: string | undefined,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: adminUserId ?? null,
          action: 'VENDOR_REJECTED',
          entityType: 'VendorProfile',
          entityId: vendorId,
          newValue: {
            rejectedAt: rejectedAt.toISOString(),
            ...(rejectionReason !== undefined ? { rejectionReason } : {}),
          },
        },
      });

      this.logger.log(
        `Audit log created for vendor rejection vendorId=${vendorId} by userId=${adminUserId ?? 'unknown'}`,
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown audit log error';
      this.logger.error(
        `Failed to create vendor rejection audit log for vendorId=${vendorId}: ${message}`,
      );
    }
  }
}
