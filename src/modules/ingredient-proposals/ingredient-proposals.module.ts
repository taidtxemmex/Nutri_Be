import { Module } from '@nestjs/common';
import { IngredientProposalsController } from './controllers/ingredient-proposals.controller';
import { IngredientProposalsService } from './services/ingredient-proposals.service';
import { PrismaModule } from '../../core/database/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [IngredientProposalsController],
  providers: [IngredientProposalsService],
  exports: [IngredientProposalsService],
})
export class IngredientProposalsModule {}
