import { Module } from '@nestjs/common';
import { IncomeController } from './income.controller';
import { IncomeService } from './income.service';
import { TaxService } from './tax.service';

@Module({
  controllers: [IncomeController],
  providers: [IncomeService, TaxService],
  exports: [IncomeService, TaxService],
})
export class IncomeModule {}
