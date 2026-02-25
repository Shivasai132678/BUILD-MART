import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, VendorProfile } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OnboardVendorDto } from './dto/onboard-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';

@Injectable()
export class VendorService {
  private readonly logger = new Logger(VendorService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onboard(userId: string, dto: OnboardVendorDto): Promise<VendorProfile> {
    const existingProfile = await this.prisma.vendorProfile.findUnique({
      where: { userId },
    });

    if (existingProfile) {
      throw new ConflictException('Vendor profile already exists for this user');
    }

    const createdProfile = await this.prisma.vendorProfile.create({
      data: this.buildCreateData(userId, dto),
    });

    this.logger.log(`Vendor profile created for userId=${userId}`);

    return createdProfile;
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

  async approveVendor(vendorId: string): Promise<VendorProfile> {
    const existingProfile = await this.prisma.vendorProfile.findUnique({
      where: { id: vendorId },
    });

    if (!existingProfile) {
      throw new NotFoundException('Vendor profile not found');
    }

    const approvedProfile = await this.prisma.vendorProfile.update({
      where: { id: vendorId },
      data: {
        isApproved: true,
        approvedAt: new Date(),
      },
    });

    this.logger.log(`Vendor profile approved id=${vendorId}`);

    return approvedProfile;
  }

  private buildCreateData(
    userId: string,
    dto: OnboardVendorDto,
  ): Prisma.VendorProfileCreateInput {
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
    if (dto.gstDocumentUrl !== undefined) {
      data.gstDocumentUrl = dto.gstDocumentUrl;
    }
    if (dto.businessLicenseUrl !== undefined) {
      data.businessLicenseUrl = dto.businessLicenseUrl;
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
}
