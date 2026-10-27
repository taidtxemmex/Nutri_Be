import { Module } from '@nestjs/common';
import { PatientsController } from './controllers/patients.controller';
import { PatientsService } from './services/patients.service';
import { PatientExcelService } from './services/patient-excel.service';
import { PrismaModule } from '../../core/database/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PatientsController],
  providers: [PatientsService, PatientExcelService],
  exports: [PatientsService, PatientExcelService],
})
export class PatientsModule {}
