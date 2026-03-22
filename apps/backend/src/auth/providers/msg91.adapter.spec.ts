/* eslint-disable @typescript-eslint/unbound-method */
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Msg91Adapter } from './msg91.adapter';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    isAxiosError: jest.fn(),
  },
}));

describe('Msg91Adapter', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.NODE_ENV;
    (axios.isAxiosError as unknown as jest.Mock).mockImplementation(
      (value: unknown) =>
        Boolean((value as { isAxiosError?: boolean })?.isAxiosError),
    );
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function createConfig(
    values: Record<string, string | undefined>,
  ): ConfigService {
    return {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;
  }

  it('fails closed when auth key is missing', async () => {
    const adapter = new Msg91Adapter(
      createConfig({ MSG91_TEMPLATE_ID: 'template-id' }),
    );

    await expect(adapter.sendOtp('+919000000001', '123456')).rejects.toThrow(
      'MSG91_AUTH_KEY is required',
    );

    expect(axios.post).not.toHaveBeenCalled();
  });

  it('fails closed when template id is missing', async () => {
    const adapter = new Msg91Adapter(
      createConfig({ MSG91_AUTH_KEY: 'auth-key' }),
    );

    await expect(adapter.sendOtp('+919000000003', '222222')).rejects.toThrow(
      'MSG91_TEMPLATE_ID is required',
    );

    expect(axios.post).not.toHaveBeenCalled();
  });

  it('posts OTP payload when config is complete', async () => {
    (axios.post as jest.Mock).mockResolvedValue({ status: 200 });
    const adapter = new Msg91Adapter(
      createConfig({
        MSG91_AUTH_KEY: 'auth-key',
        MSG91_TEMPLATE_ID: 'template-id',
      }),
    );

    await adapter.sendOtp('+919000000004', '333333');

    expect(axios.post).toHaveBeenCalledWith(
      'https://control.msg91.com/api/v5/otp',
      {
        mobile: '919000000004',
        otp: '333333',
        template_id: 'template-id',
      },
      {
        headers: {
          authkey: 'auth-key',
        },
      },
    );
  });

  it('throws and logs masked phone for axios string response error', async () => {
    (axios.post as jest.Mock).mockRejectedValue({
      isAxiosError: true,
      message: 'axios-fallback',
      response: { data: 'provider string error' },
    });
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    const adapter = new Msg91Adapter(
      createConfig({
        MSG91_AUTH_KEY: 'auth-key',
        MSG91_TEMPLATE_ID: 'template-id',
      }),
    );
    await expect(adapter.sendOtp('+919000000005', '444444')).rejects.toThrow(
      'OTP provider unavailable',
    );

    expect(errorSpy).toHaveBeenCalledWith(
      'MSG91 sendOtp failed: provider string error',
    );
  });

  it('throws and logs masked phone for axios object message errors', async () => {
    (axios.post as jest.Mock).mockRejectedValue({
      isAxiosError: true,
      message: 'axios-fallback',
      response: { data: { message: 'provider object error' } },
    });
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    const adapter = new Msg91Adapter(
      createConfig({
        MSG91_AUTH_KEY: 'auth-key',
        MSG91_TEMPLATE_ID: 'template-id',
      }),
    );
    await expect(adapter.sendOtp('+919000000006', '555555')).rejects.toThrow(
      'OTP provider unavailable',
    );

    expect(errorSpy).toHaveBeenCalledWith(
      'MSG91 sendOtp failed: provider object error',
    );
  });

  it('throws and falls back to axios error.message when object has no message field', async () => {
    (axios.post as jest.Mock).mockRejectedValue({
      isAxiosError: true,
      message: 'axios-message-only',
      response: { data: { foo: 'bar' } },
    });
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    const adapter = new Msg91Adapter(
      createConfig({
        MSG91_AUTH_KEY: 'auth-key',
        MSG91_TEMPLATE_ID: 'template-id',
      }),
    );
    await expect(adapter.sendOtp('+919000000007', '666666')).rejects.toThrow(
      'OTP provider unavailable',
    );

    expect(errorSpy).toHaveBeenCalledWith(
      'MSG91 sendOtp failed: axios-message-only',
    );
  });

  it('throws and logs standard Error messages for non-axios errors', async () => {
    (axios.post as jest.Mock).mockRejectedValue(new Error('network reset'));
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    const adapter = new Msg91Adapter(
      createConfig({
        MSG91_AUTH_KEY: 'auth-key',
        MSG91_TEMPLATE_ID: 'template-id',
      }),
    );
    await expect(adapter.sendOtp('+919000000008', '777777')).rejects.toThrow(
      'OTP provider unavailable',
    );

    expect(errorSpy).toHaveBeenCalledWith(
      'MSG91 sendOtp failed: network reset',
    );
  });

  it('throws and uses unknown-error fallback for non-Error thrown values', async () => {
    (axios.post as jest.Mock).mockRejectedValue(42);
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    const adapter = new Msg91Adapter(
      createConfig({
        MSG91_AUTH_KEY: 'auth-key',
        MSG91_TEMPLATE_ID: 'template-id',
      }),
    );
    await expect(adapter.sendOtp('+919000000009', '888888')).rejects.toThrow(
      'OTP provider unavailable',
    );

    expect(errorSpy).toHaveBeenCalledWith(
      'MSG91 sendOtp failed: Unknown MSG91 error',
    );
  });

  it('redacts long phone-like digits in provider error logs', async () => {
    (axios.post as jest.Mock).mockRejectedValue({
      isAxiosError: true,
      message: 'axios-fallback',
      response: {
        data: {
          message: 'delivery failed for +919876543210 due to provider issue',
        },
      },
    });
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    const adapter = new Msg91Adapter(
      createConfig({
        MSG91_AUTH_KEY: 'auth-key',
        MSG91_TEMPLATE_ID: 'template-id',
      }),
    );

    await expect(adapter.sendOtp('+919000000010', '999999')).rejects.toThrow(
      'OTP provider unavailable',
    );

    expect(errorSpy).toHaveBeenCalledWith(
      'MSG91 sendOtp failed: delivery failed for [redacted-phone] due to provider issue',
    );
  });

  it('redacts 4-6 digit OTP-like sequences in provider error logs', async () => {
    (axios.post as jest.Mock).mockRejectedValue({
      isAxiosError: true,
      message: 'axios-fallback',
      response: {
        data: {
          message: 'invalid otp 123456 for request',
        },
      },
    });

    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    const adapter = new Msg91Adapter(
      createConfig({
        MSG91_AUTH_KEY: 'auth-key',
        MSG91_TEMPLATE_ID: 'template-id',
      }),
    );

    await expect(adapter.sendOtp('+919000000010', '999999')).rejects.toThrow(
      'OTP provider unavailable',
    );

    expect(errorSpy).toHaveBeenCalledWith(
      'MSG91 sendOtp failed: invalid otp [redacted-otp] for request',
    );
  });
});
