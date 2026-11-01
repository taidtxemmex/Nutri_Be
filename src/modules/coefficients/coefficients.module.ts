import { Module } from '@nestjs/common';
import { CoefficientsController } from './controllers/coefficients.controller';
import { CoefficientsService } from './services/coefficients.service';

@Module({
  controllers: [CoefficientsController],
  providers: [CoefficientsService],
  exports: [CoefficientsService],
})
export class CoefficientsModule {}
