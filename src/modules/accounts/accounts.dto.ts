import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const centsString = z
  .union([z.string().regex(/^-?\d+$/), z.number().int()])
  .transform((v) => BigInt(v));

export class CreateAccountDto extends createZodDto(
  z.object({
    name: z.string().min(1).max(80),
    kind: z
      .enum(['CASH', 'CHECKING', 'SAVINGS', 'CREDIT_CARD', 'WALLET'])
      .default('CHECKING'),
    openingBalanceCents: centsString.default('0'),
    color: z.string().max(20).optional(),
  }),
) {}

export class UpdateAccountDto extends createZodDto(
  z.object({
    name: z.string().min(1).max(80).optional(),
    kind: z
      .enum(['CASH', 'CHECKING', 'SAVINGS', 'CREDIT_CARD', 'WALLET'])
      .optional(),
    color: z.string().max(20).nullable().optional(),
    archived: z.boolean().optional(),
  }),
) {}
