import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const centsPositive = z
  .union([z.string().regex(/^\d+$/), z.number().int().positive()])
  .transform((v) => BigInt(v))
  .refine((v) => v > 0n, 'Valor deve ser positivo');

export class CreateTransactionDto extends createZodDto(
  z.object({
    type: z.enum(['INCOME', 'EXPENSE']).default('EXPENSE'),
    amountCents: centsPositive,
    description: z.string().min(1).max(140),
    occurredAt: z.coerce.date().default(() => new Date()),
    accountId: z.string().min(1),
    categoryId: z.string().min(1).optional(),
    visibility: z.enum(['SHARED', 'PRIVATE']).default('SHARED'),
    paymentMethod: z
      .enum(['CASH', 'DEBIT', 'CREDIT', 'PIX', 'OTHER'])
      .default('DEBIT'),
    needsDetail: z.boolean().default(false),
    attachmentId: z.string().optional(),
    // parcelas: só faz sentido em CREDIT
    installmentsCount: z.number().int().min(1).max(48).default(1),
  }),
) {}

export class UpdateTransactionDto extends createZodDto(
  z.object({
    amountCents: centsPositive.optional(),
    description: z.string().min(1).max(140).optional(),
    occurredAt: z.coerce.date().optional(),
    accountId: z.string().min(1).optional(),
    categoryId: z.string().min(1).nullable().optional(),
    visibility: z.enum(['SHARED', 'PRIVATE']).optional(),
    paymentMethod: z
      .enum(['CASH', 'DEBIT', 'CREDIT', 'PIX', 'OTHER'])
      .optional(),
    needsDetail: z.boolean().optional(),
    attachmentId: z.string().nullable().optional(),
  }),
) {}

export class CreateTransferDto extends createZodDto(
  z.object({
    amountCents: centsPositive,
    description: z.string().min(1).max(140).default('Transferência'),
    occurredAt: z.coerce.date().default(() => new Date()),
    fromAccountId: z.string().min(1),
    toAccountId: z.string().min(1),
  }),
) {}

export class ListTransactionsQueryDto extends createZodDto(
  z.object({
    month: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    accountId: z.string().optional(),
    categoryId: z.string().optional(),
    cursor: z.string().optional(),
    take: z.coerce.number().int().min(1).max(100).default(50),
  }),
) {}
