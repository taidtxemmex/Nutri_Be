import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  CreateDailyIntakeDto,
  DailyIntakeIngredientInputDto,
  DailyIntakeQueryDto,
} from '../../../src/modules/daily-intakes/dto';
import { I18nService } from '../../../src/core/i18n/i18n.service';

describe('DailyIntakes Module DTO Validation & i18n Dot-Notation Keys', () => {
  let i18nService: I18nService;

  beforeAll(() => {
    i18nService = new I18nService();
  });

  describe('CreateDailyIntakeDto', () => {
    it('ném lỗi validation.daily_intakes.patient_id_required khi thiếu patientId', async () => {
      const dto = plainToInstance(CreateDailyIntakeDto, {
        date: '2026-11-01',
        patientId: null,
      });
      const errors = await validate(dto);
      const patientError = errors.find((e) => e.property === 'patientId');
      expect(patientError).toBeDefined();
      const messages = Object.values(patientError?.constraints || {});
      expect(messages).toContain('validation.daily_intakes.patient_id_required');

      // Parity across locales
      expect(i18nService.translate('validation.daily_intakes.patient_id_required', 'vi')).toBe(
        'ID bệnh nhân không được để trống.',
      );
      expect(i18nService.translate('validation.daily_intakes.patient_id_required', 'en')).toBe(
        'Patient ID is required.',
      );
      expect(i18nService.translate('validation.daily_intakes.patient_id_required', 'zh')).toBe(
        '患者 ID 不能为空。',
      );
    });

    it('ném lỗi validation.daily_intakes.intake_date_required khi thiếu intakeDate / date', async () => {
      const dto = plainToInstance(CreateDailyIntakeDto, {
        patientId: 10,
        date: '',
        intakeDate: '',
      });
      const errors = await validate(dto);
      const dateError = errors.find((e) => e.property === 'intakeDate' || e.property === 'date');
      expect(dateError).toBeDefined();
      const messages = Object.values(dateError?.constraints || {});
      expect(messages).toContain('validation.daily_intakes.intake_date_required');
    });
  });

  describe('DailyIntakeIngredientInputDto', () => {
    it('ném lỗi validation.daily_intakes.weight_number khi khối lượng không phải số', async () => {
      const dto = plainToInstance(DailyIntakeIngredientInputDto, {
        ingredientId: 100,
        rawWeight: 'invalid-number',
      });
      const errors = await validate(dto as object);
      const weightError = errors.find((e) => e.property === 'rawWeight');
      expect(weightError).toBeDefined();
      const messages = Object.values(weightError?.constraints || {});
      expect(messages).toContain('validation.daily_intakes.weight_number');
    });

    it('ném lỗi validation.daily_intakes.weight_min_0 khi khối lượng âm', async () => {
      const dto = plainToInstance(DailyIntakeIngredientInputDto, {
        ingredientId: 100,
        rawWeight: -10,
      });
      const errors = await validate(dto as object);
      const weightError = errors.find((e) => e.property === 'rawWeight');
      expect(weightError).toBeDefined();
      const messages = Object.values(weightError?.constraints || {});
      expect(messages).toContain('validation.daily_intakes.weight_min_0');
    });
  });

  describe('DailyIntakeQueryDto', () => {
    it('ném lỗi validation.daily_intakes.page_min khi page < 1', async () => {
      const dto = plainToInstance(DailyIntakeQueryDto, {
        page: 0,
      });
      const errors = await validate(dto);
      const pageError = errors.find((e) => e.property === 'page');
      expect(pageError).toBeDefined();
      const messages = Object.values(pageError?.constraints || {});
      expect(messages).toContain('validation.daily_intakes.page_min');
    });
  });

  describe('DailyIntakeExportRequestDto', () => {
    it('ném lỗi validation khi thiếu templateType, fromDate, toDate', async () => {
      const { DailyIntakeExportRequestDto } =
        await import('../../../src/modules/daily-intakes/dto');
      const dto = plainToInstance(DailyIntakeExportRequestDto, {});
      const errors = await validate(dto);

      const templateError = errors.find((e) => e.property === 'templateType');
      expect(templateError).toBeDefined();
      expect(Object.values(templateError?.constraints || {})).toContain(
        'validation.daily_intakes.export_template_required',
      );

      const fromDateError = errors.find((e) => e.property === 'fromDate');
      expect(fromDateError).toBeDefined();
      expect(Object.values(fromDateError?.constraints || {})).toContain(
        'validation.daily_intakes.export_from_date_required',
      );

      const toDateError = errors.find((e) => e.property === 'toDate');
      expect(toDateError).toBeDefined();
      expect(Object.values(toDateError?.constraints || {})).toContain(
        'validation.daily_intakes.export_to_date_required',
      );

      // Verify i18n translations across locales
      expect(i18nService.translate('validation.daily_intakes.export_template_required', 'vi')).toBe(
        'Vui lòng chọn mẫu xuất báo cáo (1..4).',
      );
      expect(i18nService.translate('validation.daily_intakes.export_template_required', 'en')).toBe(
        'Please select an export report template (1..4).',
      );
      expect(i18nService.translate('validation.daily_intakes.export_template_required', 'zh')).toBe(
        '请选择导出报告模板 (1..4)。',
      );
    });

    it('ném lỗi format khi ngày không đúng định dạng YYYY-MM-DD', async () => {
      const { DailyIntakeExportRequestDto } =
        await import('../../../src/modules/daily-intakes/dto');
      const dto = plainToInstance(DailyIntakeExportRequestDto, {
        templateType: 1,
        fromDate: '01/10/2026',
        toDate: '2026-13-45',
      });
      const errors = await validate(dto);

      const fromDateError = errors.find((e) => e.property === 'fromDate');
      expect(fromDateError).toBeDefined();
      expect(Object.values(fromDateError?.constraints || {})).toContain(
        'validation.daily_intakes.export_from_date_format',
      );

      expect(i18nService.translate('validation.daily_intakes.export_from_date_format', 'vi')).toBe(
        'Định dạng ngày bắt đầu phải là YYYY-MM-DD.',
      );
      expect(i18nService.translate('validation.daily_intakes.export_from_date_format', 'en')).toBe(
        'Start date must follow YYYY-MM-DD format.',
      );
      expect(i18nService.translate('validation.daily_intakes.export_from_date_format', 'zh')).toBe(
        '开始日期格式必须为 YYYY-MM-DD。',
      );
    });
  });
});
