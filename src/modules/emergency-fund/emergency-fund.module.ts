import { Module } from '@nestjs/common';
import { EmergencyFundController } from './emergency-fund.controller';
import { EmergencyFundService } from './emergency-fund.service';

@Module({
  controllers: [EmergencyFundController],
  providers: [EmergencyFundService],
  exports: [EmergencyFundService],
})
export class EmergencyFundModule {}
