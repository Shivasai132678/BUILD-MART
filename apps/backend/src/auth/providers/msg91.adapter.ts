import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';

type Msg91OtpPayload = {
  mobile: string;
  otp: string;
  template_id: string;
};

@Injectable()
export class Msg91Adapter {
  private readonly logger = new Logger(Msg91Adapter.name);
  private readonly endpoint = 'https://control.msg91.com/api/v5/otp';

  constructor(private readonly configService: ConfigService) {}

  async sendOtp(phone: string, otp: string): Promise<void> {
    const authKey = this.configService.get<string>('MSG91_AUTH_KEY');
    const templateId = this.configService.get<string>('MSG91_TEMPLATE_ID');

    if (!authKey) {
      throw new Error('MSG91_AUTH_KEY is required');
    }

    if (!templateId) {
      throw new Error('MSG91_TEMPLATE_ID is required');
    }

    const payload: Msg91OtpPayload = {
      mobile: phone.replace('+', ''),
      otp,
      template_id: templateId,
    };

    try {
      await axios.post(this.endpoint, payload, {
        headers: {
          authkey: authKey,
        },
      });
    } catch (error: unknown) {
      const message = this.resolveErrorMessage(error);
      const safeMessage = this.sanitizeErrorMessage(message);
      this.logger.error(`MSG91 sendOtp failed: ${safeMessage}`);
      throw new Error('OTP provider unavailable');
    }
  }

  private sanitizeErrorMessage(message: string): string {
    return message
      .replace(/(?:\+?\d[\d\s-]{6,}\d)/g, '[redacted-phone]')
      .replace(/\b\d{4,6}\b/g, '[redacted-otp]');
  }

  private resolveErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
      return this.readAxiosError(error);
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Unknown MSG91 error';
  }

  private readAxiosError(error: AxiosError): string {
    const data = error.response?.data;

    if (typeof data === 'string') {
      return data;
    }

    if (data && typeof data === 'object') {
      const maybeMessage = (data as { message?: unknown }).message;
      if (typeof maybeMessage === 'string') {
        return maybeMessage;
      }
    }

    return error.message;
  }
}
