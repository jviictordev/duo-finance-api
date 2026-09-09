import { Module } from '@nestjs/common';
import { RecurringAccountsController } from './recurring-accounts.controller';
import { RecurringAccountsService } from './recurring-accounts.service';

@Module({
  controllers: [RecurringAccountsController],
  providers: [RecurringAccountsService],
  exports: [RecurringAccountsService],
})
export class RecurringAccountsModule {}
