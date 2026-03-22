import { UnauthorizedException } from '@nestjs/common';
import { AddressesController } from './addresses.controller';
import type { AddressesService } from './addresses.service';

describe('AddressesController', () => {
  const addressesService = {
    createAddress: jest.fn(),
    listAddresses: jest.fn(),
    getAddress: jest.fn(),
    updateAddress: jest.fn(),
    softDeleteAddress: jest.fn(),
  } as unknown as jest.Mocked<AddressesService>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates all address operations for authenticated user', async () => {
    const controller = new AddressesController(addressesService);
    const req = { user: { sub: 'buyer-1' } } as const;

    (addressesService.createAddress as jest.Mock).mockResolvedValue({ id: 'addr-1' });
    (addressesService.listAddresses as jest.Mock).mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });
    (addressesService.getAddress as jest.Mock).mockResolvedValue({ id: 'addr-1' });
    (addressesService.updateAddress as jest.Mock).mockResolvedValue({ id: 'addr-1' });
    (addressesService.softDeleteAddress as jest.Mock).mockResolvedValue({ id: 'addr-1' });

    await expect(
      controller.createAddress(req, {
        label: 'Site A',
        line1: 'Road 1',
        city: 'Hyderabad',
        state: 'TS',
        pincode: '500001',
      }),
    ).resolves.toEqual({ id: 'addr-1' });

    await expect(controller.listAddresses(req, 20, 0)).resolves.toEqual({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
    });
    await expect(controller.getAddress(req, 'addr-1')).resolves.toEqual({ id: 'addr-1' });
    await expect(controller.updateAddress(req, 'addr-1', { city: 'Secunderabad' })).resolves.toEqual({
      id: 'addr-1',
    });
    await expect(controller.softDeleteAddress(req, 'addr-1')).resolves.toEqual({ id: 'addr-1' });
  });

  it('throws UnauthorizedException when request user is missing', async () => {
    const controller = new AddressesController(addressesService);

    expect(() => controller.listAddresses({} as never, 20, 0)).toThrow(
      UnauthorizedException,
    );
  });
});
