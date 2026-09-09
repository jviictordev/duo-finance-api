import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { ZodValidationException } from 'nestjs-zod';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: Record<string, unknown> = {
      statusCode: status,
      error: 'Internal Server Error',
      message: 'Erro inesperado.',
    };

    if (exception instanceof ZodValidationException) {
      status = HttpStatus.UNPROCESSABLE_ENTITY;
      body = {
        statusCode: status,
        error: 'Unprocessable Entity',
        message: 'Dados inválidos.',
        issues: exception.getZodError().issues,
      };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      body =
        typeof res === 'string'
          ? { statusCode: status, message: res }
          : { statusCode: status, ...(res as object) };
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        body = { statusCode: status, error: 'Conflict', message: 'Registro duplicado.' };
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        body = { statusCode: status, error: 'Not Found', message: 'Registro não encontrado.' };
      }
    }

    if (status >= 500) {
      this.logger.error(exception);
    }

    httpAdapter.reply(ctx.getResponse(), body, status);
  }
}
