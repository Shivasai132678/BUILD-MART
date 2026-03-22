import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddressesService } from './addresses.service';

describe('AddressesService', () => {
  let service: AddressesService;

  const prisma = {
    address: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  } as unknown as jest.Mocked<PrismaService>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AddressesService(prisma);
  });

  describe('listAddresses', () => {
    it('returns only non-deleted addresses (deletedAt: null)', async () => {
      const visibleAddresses = [
        { id: 'addr-1', userId: 'user-1', label: 'Home', deletedAt: null },
        { id: 'addr-2', userId: 'user-1', label: 'Office', deletedAt: null },
      ];

      (prisma.$transaction as jest.Mock).mockResolvedValue([visibleAddresses, 2]);

      const result = await service.listAddresses('user-1', 20, 0);

      expect(result).toEqual({
        items: visibleAddresses,
        total: 2,
        limit: 20,
        offset: 0,
      });

      const txCallback = (prisma.$transaction as jest.Mock).mock.calls[0][0];
      expect(Array.isArray(txCallback)).toBe(true);
    });

    it('returns empty array when no visible addresses exist', async () => {
      (prisma.$transaction as jest.Mock).mockResolvedValue([[], 0]);

      const result = await service.listAddresses('user-1', 20, 0);

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('passes orderBy with default-first and newest-first', async () => {
      (prisma.$transaction as jest.Mock).mockResolvedValue([[], 0]);

      await service.listAddresses('user-1', 20, 0);

      const findManyCall = (prisma.address.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.orderBy).toEqual([
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ]);
    });
  });

  describe('createAddress', () => {
    it('creates non-default address without transaction', async () => {
      (prisma.address.create as jest.Mock).mockResolvedValue({ id: 'addr-1' });

      const result = await service.createAddress('user-1', {
        label: 'Home',
        line1: 'Line 1',
        city: 'Hyderabad',
        state: 'TS',
        pincode: '500001',
      });

      expect(result.id).toBe('addr-1');
      expect(prisma.address.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          line1: 'Line 1',
          city: 'Hyderabad',
          state: 'TS',
          pincode: '500001',
          area: 'Line 1',
        }),
      });
    });

    it('creates default address via transaction and clears previous defaults', async () => {
      (prisma.$transaction as jest.Mock).mockResolvedValue([
        { count: 1 },
        { id: 'addr-2', isDefault: true },
      ]);

      const result = await service.createAddress('user-1', {
        label: 'Office',
        line1: 'Line 2',
        city: 'Hyderabad',
        state: 'TS',
        pincode: '500002',
        isDefault: true,
      });

      expect(result.id).toBe('addr-2');
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.address.updateMany).toHaveBeenCalled();
    });
  });

  describe('softDeleteAddress', () => {
    it('sets deletedAt and isDefault=false on the address', async () => {
      (prisma.address.findFirst as jest.Mock).mockResolvedValueOnce({
        id: 'addr-1',
        userId: 'user-1',
        label: 'Home',
        deletedAt: null,
      });

      (prisma.address.update as jest.Mock).mockResolvedValueOnce({
        id: 'addr-1',
        userId: 'user-1',
        label: 'Home',
        deletedAt: new Date('2026-03-07T00:00:00.000Z'),
        isDefault: false,
      });

      const result = await service.softDeleteAddress('user-1', 'addr-1');

      expect(result.deletedAt).toBeTruthy();
      expect(result.isDefault).toBe(false);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.address.update).toHaveBeenCalledWith({
        where: { id: 'addr-1' },
        data: {
          deletedAt: expect.any(Date),
          isDefault: false,
        },
      });
    });

    it('throws NotFoundException if address does not exist', async () => {
      (prisma.address.findFirst as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        service.softDeleteAddress('user-1', 'addr-nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException if address belongs to another user', async () => {
      (prisma.address.findFirst as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        service.softDeleteAddress('user-2', 'addr-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAddress', () => {
    it('returns a non-deleted address', async () => {
      const mockAddress = {
        id: 'addr-1',
        userId: 'user-1',
        label: 'Home',
        deletedAt: null,
      };

      (prisma.address.findFirst as jest.Mock).mockResolvedValueOnce(mockAddress);

      const result = await service.getAddress('user-1', 'addr-1');

      expect(result).toEqual(mockAddress);
    });

    it('throws NotFoundException for a soft-deleted address', async () => {
      (prisma.address.findFirst as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        service.getAddress('user-1', 'addr-deleted'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateAddress', () => {
    it('updates regular fields and derives area from line1 when area omitted', async () => {
      (prisma.address.findFirst as jest.Mock).mockResolvedValue({
        id: 'addr-1',
        userId: 'user-1',
        deletedAt: null,
      });
      (prisma.address.update as jest.Mock).mockResolvedValue({
        id: 'addr-1',
        line1: 'New line',
        area: 'New line',
      });

      const result = await service.updateAddress('user-1', 'addr-1', {
        line1: 'New line',
      });

      expect(result.area).toBe('New line');
      expect(prisma.address.update).toHaveBeenCalledWith({
        where: { id: 'addr-1' },
        data: expect.objectContaining({ line1: 'New line', area: 'New line' }),
      });
    });

    it('updates default address in transaction and clears others', async () => {
      (prisma.address.findFirst as jest.Mock).mockResolvedValue({
        id: 'addr-1',
        userId: 'user-1',
        deletedAt: null,
      });
      (prisma.$transaction as jest.Mock).mockResolvedValue([
        { count: 2 },
        { id: 'addr-1', isDefault: true },
      ]);

      const result = await service.updateAddress('user-1', 'addr-1', {
        isDefault: true,
        label: 'Primary',
      });

      expect(result.isDefault).toBe(true);
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('throws not found for updating invisible address', async () => {
      (prisma.address.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.updateAddress('user-1', 'missing', { label: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('addresses with arbitrary labels', () => {
    it('address with unusual label is not affected by deletedAt filter', async () => {
      const address = {
        id: 'addr-3',
        userId: 'user-1',
        label: '__SOFT_DELETED__weird_label',
        deletedAt: null,
      };

      (prisma.address.findFirst as jest.Mock).mockResolvedValueOnce(address);

      const result = await service.getAddress('user-1', 'addr-3');

      expect(result.label).toBe('__SOFT_DELETED__weird_label');
      expect(result).toEqual(address);
    });
  });
});
