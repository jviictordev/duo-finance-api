import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const cents = z
  .union([z.string().regex(/^\d+$/), z.number().int().positive()])
  .transform((v) => BigInt(v));

export class CreateRecurringAccountDto extends createZodDto(
  z.object({
    label: z.string().min(1).max(80),
    kind: z.enum(['FIXED', 'INSTALLMENT']).default('FIXED'),
    amountCents: cents,
    dueDay: z.number().int().min(1).max(28),
    accountId: z.string().optional(),
    categoryId: z.string().optional(),
    installmentsCount: z.number().int().min(1).max(120).optional(),
    installmentsPaid: z.number().int().min(0).optional(),
    startDate: z.coerce.date().optional(),
  }),
) {}

export class UpdateRecurringAccountDto extends createZodDto(
  z.object({
    label: z.string().min(1).max(80).optional(),
    amountCents: cents.optional(),
    dueDay: z.number().int().min(1).max(28).optional(),
    accountId: z.string().nullable().optional(),
    categoryId: z.string().nullable().optional(),
    installmentsPaid: z.number().int().min(0).optional(),
    archived: z.boolean().optional(),
  }),
) {}

export class PayRecurringAccountDto extends createZodDto(
  z.object({
    amountCents: cents.optional(), // default = valor da conta
    occurredAt: z.coerce.date().default(() => new Date()),
    accountId: z.string().optional(), // default = conta vinculada
  }),
) {}
