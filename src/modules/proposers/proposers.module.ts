import { Module } from '@nestjs/common';
import { ProposersController } from './controllers/proposers.controller';
import { ProposersService } from './services/proposers.service';

@Module({
  controllers: [ProposersController],
  providers: [ProposersService],
  exports: [ProposersService],
})
export class ProposersModule {}
