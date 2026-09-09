import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class CreateCategoryDto extends createZodDto(
  z.object({
    name: z.string().min(1).max(60),
    kind: z.enum(['INCOME', 'EXPENSE']).default('EXPENSE'),
    essential: z.boolean().default(true),
    icon: z.string().max(8).optional(),
    color: z.string().max(20).optional(),
  }),
) {}

export class UpdateCategoryDto extends createZodDto(
  z.object({
    name: z.string().min(1).max(60).optional(),
    essential: z.boolean().optional(),
    icon: z.string().max(8).nullable().optional(),
    color: z.string().max(20).nullable().optional(),
    archived: z.boolean().optional(),
  }),
) {}
