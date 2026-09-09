import { Module } from '@nestjs/common';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

@Module({
  controllers: [TransactionsController, CommentsController],
  providers: [TransactionsService, CommentsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
