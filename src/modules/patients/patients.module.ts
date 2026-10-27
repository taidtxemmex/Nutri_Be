import { Module } from '@nestjs/common';
import { PatientsController } from './controllers/patients.controller';
import { PatientsService } from './services/patients.service';
import { PatientExcelService } from './services/patient-excel.service';
import { PatientCodeAllocatorService } from './services/patient-code-allocator.service';
import { PrismaModule } from '../../core/database/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PatientsController],
  providers: [PatientsService, PatientExcelService, PatientCodeAllocatorService],
  exports: [PatientsService, PatientExcelService, PatientCodeAllocatorService],
})
export class PatientsModule {}
