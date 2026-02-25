import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

type ErrorMessage = string | string[];

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const { message, error } = this.extractErrorDetails(exception);
    const path = request.url ?? '/';
    const method = request.method ?? 'UNKNOWN';

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${method} ${path} -> ${statusCode} ${error}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(`${method} ${path} -> ${statusCode} ${error}`);
    }

    response.status(statusCode).json({
      success: false,
      statusCode,
      error,
      message,
      timestamp: new Date().toISOString(),
      path,
    });
  }

  private extractErrorDetails(exception: unknown): {
    error: string;
    message: ErrorMessage;
  } {
    if (!(exception instanceof HttpException)) {
      return {
        error: 'InternalServerError',
        message:
          exception instanceof Error && exception.message.length > 0
            ? exception.message
            : 'Internal server error',
      };
    }

    const response = exception.getResponse();

    if (typeof response === 'string') {
      return {
        error: exception.name,
        message: response,
      };
    }

    if (this.isRecord(response)) {
      const message = this.readMessage(response.message);
      const error = typeof response.error === 'string' ? response.error : exception.name;

      return {
        error,
        message,
      };
    }

    return {
      error: exception.name,
      message: exception.message,
    };
  }

  private readMessage(value: unknown): ErrorMessage {
    if (typeof value === 'string') {
      return value;
    }

    if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
      return value;
    }

    return 'Unexpected error';
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
