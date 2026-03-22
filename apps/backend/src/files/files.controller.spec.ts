import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import type { CloudinaryAdapter } from './cloudinary.adapter';
import { FilesController } from './files.controller';

describe('FilesController', () => {
  const cloudinaryAdapter = {
    uploadFile: jest.fn(),
  } as unknown as jest.Mocked<CloudinaryAdapter>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uploads file to cloudinary and returns URL', async () => {
    const controller = new FilesController(cloudinaryAdapter);
    (cloudinaryAdapter.uploadFile as jest.Mock).mockResolvedValue('https://cdn.example.com/image.png');

    const result = await controller.uploadProductImage({
      path: '/tmp/image.png',
    } as Express.Multer.File);

    expect(result).toEqual({ url: 'https://cdn.example.com/image.png' });
    expect(cloudinaryAdapter.uploadFile).toHaveBeenCalledWith('/tmp/image.png', 'buildmart-products');
  });

  it('throws BadRequestException when file is missing', async () => {
    const controller = new FilesController(cloudinaryAdapter);

    await expect(controller.uploadProductImage(undefined as unknown as Express.Multer.File)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('throws UnprocessableEntityException when cloudinary upload fails', async () => {
    const controller = new FilesController(cloudinaryAdapter);
    (cloudinaryAdapter.uploadFile as jest.Mock).mockRejectedValue(new Error('upload failed'));

    await expect(
      controller.uploadProductImage({ path: '/tmp/fail.png' } as Express.Multer.File),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});
