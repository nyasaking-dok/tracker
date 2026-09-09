import { Module } from '@nestjs/common';
import { IngestionController } from './ingestion.controller';
import { AlertEvaluationService } from './alert-evaluation.service';

@Module({
  controllers: [IngestionController],
  providers: [AlertEvaluationService],
  exports: [AlertEvaluationService],
})
export class IngestionModule {}
