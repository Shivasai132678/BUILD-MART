import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Address, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

// TODO: Address model lacks deletedAt — soft delete uses label prefix hack.
// Phase 2: add deletedAt DateTime? to Address model with migration.
const SOFT_DELETED_LABEL = '__SOFT_DELETED__';

type PaginatedAddressesResponse = {
  items: Address[];
  total: number;
  limit: number;
  offset: number;
};

@Injectable()
export class AddressesService {
  private readonly logger = new Logger(AddressesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createAddress(userId: string, dto: CreateAddressDto): Promise<Address> {
    const createData: Prisma.AddressCreateInput = {
      user: {
        connect: { id: userId },
      },
      line1: dto.line1,
      city: dto.city,
      state: dto.state,
      pincode: dto.pincode,
      area: dto.area?.trim() || dto.line1,
      ...(dto.label !== undefined ? { label: dto.label } : {}),
      ...(dto.line2 !== undefined ? { line2: dto.line2 } : {}),
      ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
    };

    if (dto.isDefault) {
      const [, address] = await this.prisma.$transaction([
        this.prisma.address.updateMany({
          where: this.visibleAddressWhere(userId),
          data: { isDefault: false },
        }),
        this.prisma.address.create({ data: createData }),
      ]);

      this.logger.log(`Created default address for userId=${userId}`);
      return address;
    }

    const address = await this.prisma.address.create({ data: createData });
    this.logger.log(`Created address id=${address.id} for userId=${userId}`);

    return address;
  }

  async listAddresses(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<PaginatedAddressesResponse> {
    const where = this.visibleAddressWhere(userId);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.address.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.address.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  async getAddress(userId: string, addressId: string): Promise<Address> {
    const address = await this.findVisibleAddressOrThrow(userId, addressId);
    return address;
  }

  async updateAddress(
    userId: string,
    addressId: string,
    dto: UpdateAddressDto,
  ): Promise<Address> {
    await this.findVisibleAddressOrThrow(userId, addressId);

    const updateData: Prisma.AddressUpdateInput = {};

    if (dto.label !== undefined) {
      updateData.label = dto.label;
    }
    if (dto.line1 !== undefined) {
      updateData.line1 = dto.line1;
      if (dto.area === undefined) {
        updateData.area = dto.line1;
      }
    }
    if (dto.line2 !== undefined) {
      updateData.line2 = dto.line2;
    }
    if (dto.area !== undefined) {
      updateData.area = dto.area;
    }
    if (dto.city !== undefined) {
      updateData.city = dto.city;
    }
    if (dto.state !== undefined) {
      updateData.state = dto.state;
    }
    if (dto.pincode !== undefined) {
      updateData.pincode = dto.pincode;
    }
    if (dto.isDefault !== undefined) {
      updateData.isDefault = dto.isDefault;
    }

    if (dto.isDefault) {
      const [, address] = await this.prisma.$transaction([
        this.prisma.address.updateMany({
          where: {
            ...this.visibleAddressWhere(userId),
            id: { not: addressId },
          },
          data: { isDefault: false },
        }),
        this.prisma.address.update({
          where: { id: addressId },
          data: updateData,
        }),
      ]);

      this.logger.log(`Updated default address id=${addressId} for userId=${userId}`);
      return address;
    }

    const address = await this.prisma.address.update({
      where: { id: addressId },
      data: updateData,
    });

    this.logger.log(`Updated address id=${addressId} for userId=${userId}`);

    return address;
  }

  async softDeleteAddress(userId: string, addressId: string): Promise<Address> {
    await this.findVisibleAddressOrThrow(userId, addressId);

    const address = await this.prisma.address.update({
      where: { id: addressId },
      data: {
        label: SOFT_DELETED_LABEL,
        isDefault: false,
      },
    });

    this.logger.log(`Soft-deleted address id=${addressId} for userId=${userId}`);

    return address;
  }

  private visibleAddressWhere(userId: string): Prisma.AddressWhereInput {
    return {
      userId,
      OR: [{ label: null }, { label: { not: SOFT_DELETED_LABEL } }],
    };
  }

  private async findVisibleAddressOrThrow(
    userId: string,
    addressId: string,
  ): Promise<Address> {
    const address = await this.prisma.address.findFirst({
      where: {
        id: addressId,
        ...this.visibleAddressWhere(userId),
      },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    return address;
  }
}
