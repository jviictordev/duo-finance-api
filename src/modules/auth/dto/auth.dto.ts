import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class RegisterDto extends createZodDto(
  z.object({
    name: z.string().min(2).max(120),
    email: z.string().email().toLowerCase(),
    password: z.string().min(8).max(128),
  }),
) {}

export class LoginDto extends createZodDto(
  z.object({
    email: z.string().email().toLowerCase(),
    password: z.string().min(1),
  }),
) {}

export class RefreshDto extends createZodDto(
  z.object({
    refreshToken: z.string().min(1),
  }),
) {}
