import { Module } from '@nestjs/common';
import { TransactionsModule } from '../transactions/transactions.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [TransactionsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
