import { Module, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { Env, validateEnv } from './config/env';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { ActivityModule } from './modules/activity/activity.module';
import { SpaceModule } from './modules/space/space.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { RecurringAccountsModule } from './modules/recurring-accounts/recurring-accounts.module';
import { EmergencyFundModule } from './modules/emergency-fund/emergency-fund.module';
import { MonthClosingModule } from './modules/month-closing/month-closing.module';
import { IncomeModule } from './modules/income/income.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      envFilePath: ['.env.local', '.env'],
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        // pino-pretty é devDependency — só liga em dev local, nunca em
        // serverless/CI (onde não está instalado e derrubaria o processo)
        const pretty =
          config.get('NODE_ENV', { infer: true }) === 'development' &&
          !process.env.VERCEL &&
          !process.env.CI;
        return {
          exclude: [{ method: RequestMethod.ALL, path: 'health' }],
          pinoHttp: {
            level: config.get('LOG_LEVEL', { infer: true }),
            transport: pretty
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
            redact: ['req.headers.authorization', 'req.headers.cookie'],
          },
        };
      },
    }),
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 120 },
      { name: 'auth', ttl: 60_000, limit: 10 },
    ]),
    PrismaModule,
    RealtimeModule,
    ActivityModule,
    AuthModule,
    SpaceModule,
    AccountsModule,
    CategoriesModule,
    TransactionsModule,
    RecurringAccountsModule,
    EmergencyFundModule,
    MonthClosingModule,
    IncomeModule,
    DashboardModule,
    AttachmentsModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
