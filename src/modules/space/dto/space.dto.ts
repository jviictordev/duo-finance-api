import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class CreateSpaceDto extends createZodDto(
  z.object({
    name: z.string().min(2).max(80).optional(),
    sinceDate: z.coerce.date().optional(),
  }),
) {}

export class CreateInvitationDto extends createZodDto(
  z.object({
    email: z.string().email().toLowerCase(),
  }),
) {}

export class AcceptInvitationDto extends createZodDto(
  z.object({
    token: z.string().min(10),
  }),
) {}
