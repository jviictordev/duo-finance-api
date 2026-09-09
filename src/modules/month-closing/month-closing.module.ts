import { Module } from '@nestjs/common';
import { EmergencyFundModule } from '../emergency-fund/emergency-fund.module';
import { MonthClosingController } from './month-closing.controller';
import { MonthClosingService } from './month-closing.service';

@Module({
  imports: [EmergencyFundModule],
  controllers: [MonthClosingController],
  providers: [MonthClosingService],
})
export class MonthClosingModule {}
