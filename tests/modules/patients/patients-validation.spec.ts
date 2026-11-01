import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  CreatePatientDto,
  CreateAnthropometryDto,
  CreateMedicalRecordDto,
  PatientQueryDto,
} from '../../../src/modules/patients/dto';
import { I18nService } from '../../../src/core/i18n/i18n.service';

describe('Patients Module DTO Validation & i18n Dot-Notation Keys', () => {
  let i18nService: I18nService;

  beforeAll(() => {
    i18nService = new I18nService();
  });

  describe('CreatePatientDto', () => {
    it('ném lỗi validation.patients.fullname_required khi để trống họ tên', async () => {
      const dto = plainToInstance(CreatePatientDto, {
        fullName: '',
        gender: 'NAM',
      });
      const errors = await validate(dto);
      const nameError = errors.find((e) => e.property === 'fullName');
      expect(nameError).toBeDefined();
      const messages = Object.values(nameError?.constraints || {});
      expect(messages).toContain('validation.patients.fullname_required');

      // Parity across locales
      expect(i18nService.translate('validation.patients.fullname_required', 'vi')).toBe(
        'Họ và tên bệnh nhân không được để trống.',
      );
      expect(i18nService.translate('validation.patients.fullname_required', 'en')).toBe(
        'Patient full name is required.',
      );
      expect(i18nService.translate('validation.patients.fullname_required', 'zh')).toBe(
        '患者姓名不能为空。',
      );
    });

    it('ném lỗi validation.patients.gender_required khi để trống giới tính', async () => {
      const dto = plainToInstance(CreatePatientDto, {
        fullName: 'Nguyễn Văn A',
        gender: '',
      });
      const errors = await validate(dto);
      const genderError = errors.find((e) => e.property === 'gender');
      expect(genderError).toBeDefined();
      const messages = Object.values(genderError?.constraints || {});
      expect(messages).toContain('validation.patients.gender_required');
    });

    it('ném lỗi validation.patients.weight_min khi cân nặng <= 0', async () => {
      const dto = plainToInstance(CreatePatientDto, {
        fullName: 'Nguyễn Văn A',
        gender: 'NAM',
        weight: -5,
      });
      const errors = await validate(dto);
      const weightError = errors.find((e) => e.property === 'weight');
      expect(weightError).toBeDefined();
      const messages = Object.values(weightError?.constraints || {});
      expect(messages).toContain('validation.patients.weight_min');
      expect(i18nService.translate('validation.patients.weight_min', 'vi')).toBe(
        'Cân nặng phải lớn hơn hoặc bằng 0.01 kg.',
      );
    });

    it('ném lỗi validation.patients.height_max khi chiều cao vượt quá 300cm', async () => {
      const dto = plainToInstance(CreatePatientDto, {
        fullName: 'Nguyễn Văn A',
        gender: 'NAM',
        height: 350,
      });
      const errors = await validate(dto);
      const heightError = errors.find((e) => e.property === 'height');
      expect(heightError).toBeDefined();
      const messages = Object.values(heightError?.constraints || {});
      expect(messages).toContain('validation.patients.height_max');
    });
  });

  describe('CreateAnthropometryDto', () => {
    it('ném lỗi validation.patients.weight_number khi cân nặng không phải số', async () => {
      const dto = plainToInstance(CreateAnthropometryDto, {
        weight: 'không phải số',
      });
      const errors = await validate(dto);
      const weightError = errors.find((e) => e.property === 'weight');
      expect(weightError).toBeDefined();
      const messages = Object.values(weightError?.constraints || {});
      expect(messages).toContain('validation.patients.weight_number');
    });

    it('ném lỗi validation.patients.systolic_bp_min khi huyết áp tâm thu < 30', async () => {
      const dto = plainToInstance(CreateAnthropometryDto, {
        weight: 60,
        height: 170,
        systolicBloodPressure: 20,
      });
      const errors = await validate(dto);
      const bpError = errors.find((e) => e.property === 'systolicBloodPressure');
      expect(bpError).toBeDefined();
      const messages = Object.values(bpError?.constraints || {});
      expect(messages).toContain('validation.patients.systolic_bp_min');
    });
  });

  describe('CreateMedicalRecordDto', () => {
    it('ném lỗi validation.patients.primary_diagnosis_required khi thiếu chẩn đoán chính', async () => {
      const dto = plainToInstance(CreateMedicalRecordDto, {
        primaryDiagnosis: '',
      });
      const errors = await validate(dto);
      const diagError = errors.find((e) => e.property === 'primaryDiagnosis');
      expect(diagError).toBeDefined();
      const messages = Object.values(diagError?.constraints || {});
      expect(messages).toContain('validation.patients.primary_diagnosis_required');
    });
  });

  describe('PatientQueryDto', () => {
    it('ném lỗi validation.patients.page_min khi page < 1', async () => {
      const dto = plainToInstance(PatientQueryDto, {
        page: 0,
      });
      const errors = await validate(dto);
      const pageError = errors.find((e) => e.property === 'page');
      expect(pageError).toBeDefined();
      const messages = Object.values(pageError?.constraints || {});
      expect(messages).toContain('validation.patients.page_min');
    });

    it('ném lỗi validation.patients.limit_max khi limit > 1000', async () => {
      const dto = plainToInstance(PatientQueryDto, {
        limit: 1500,
      });
      const errors = await validate(dto);
      const limitError = errors.find((e) => e.property === 'limit');
      expect(limitError).toBeDefined();
      const messages = Object.values(limitError?.constraints || {});
      expect(messages).toContain('validation.patients.limit_max');
    });
  });
});
