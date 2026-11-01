import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  CreateNutritionLimitSetDto,
  UpdateNutritionLimitSetDto,
} from '../../../src/modules/nutrition-limit-sets/dto';
import { I18nService } from '../../../src/core/i18n/i18n.service';

describe('NutritionLimitSets Module DTO Validation & i18n Dot-Notation Keys', () => {
  let i18nService: I18nService;

  beforeAll(() => {
    i18nService = new I18nService();
  });

  describe('CreateNutritionLimitSetDto', () => {
    it('ném lỗi validation.nutrition_limits.limits_required khi thiếu limits', async () => {
      const dto = plainToInstance(CreateNutritionLimitSetDto, {
        name: 'Giới hạn tiểu đường',
        limits: null,
      });
      const errors = await validate(dto);
      const limitsError = errors.find((e) => e.property === 'limits');
      expect(limitsError).toBeDefined();
      const messages = Object.values(limitsError?.constraints || {});
      expect(messages).toContain('validation.nutrition_limits.limits_required');

      // Parity across locales
      expect(i18nService.translate('validation.nutrition_limits.limits_required', 'vi')).toBe(
        'Bản đồ giới hạn vi chất không được để trống.',
      );
      expect(i18nService.translate('validation.nutrition_limits.limits_required', 'en')).toBe(
        'Nutrient limits map is required.',
      );
      expect(i18nService.translate('validation.nutrition_limits.limits_required', 'zh')).toBe(
        '营养素限制表不能为空。',
      );
    });

    it('ném lỗi validation.nutrition_limits.limits_object khi limits không phải object', async () => {
      const dto = plainToInstance(CreateNutritionLimitSetDto, {
        name: 'Giới hạn tiểu đường',
        limits: 'không phải object',
      });
      const errors = await validate(dto);
      const limitsError = errors.find((e) => e.property === 'limits');
      expect(limitsError).toBeDefined();
      const messages = Object.values(limitsError?.constraints || {});
      expect(messages).toContain('validation.nutrition_limits.limits_object');
    });

    it('ném lỗi validation.nutrition_limits.name_max khi tên vượt quá 255 ký tự', async () => {
      const dto = plainToInstance(CreateNutritionLimitSetDto, {
        name: 'a'.repeat(256),
        limits: { energy: 2000 },
      });
      const errors = await validate(dto);
      const nameError = errors.find((e) => e.property === 'name');
      expect(nameError).toBeDefined();
      const messages = Object.values(nameError?.constraints || {});
      expect(messages).toContain('validation.nutrition_limits.name_max');
    });

    it('ném lỗi validation.nutrition_limits.reusable_boolean khi isReusable không phải boolean', async () => {
      const dto = plainToInstance(CreateNutritionLimitSetDto, {
        name: 'Giới hạn tiểu đường',
        reusable: 'không phải boolean' as any,
        limits: { energy: 2000 },
      });
      const errors = await validate(dto as object);
      const reusableError = errors.find((e) => e.property === 'reusable');
      expect(reusableError).toBeDefined();
      const messages = Object.values(reusableError?.constraints || {});
      expect(messages).toContain('validation.nutrition_limits.reusable_boolean');
    });

    it('ném lỗi validation.nutrition_limits.warning_rule_enum khi warningRule không hợp lệ', async () => {
      const dto = plainToInstance(CreateNutritionLimitSetDto, {
        name: 'Giới hạn tiểu đường',
        warningRule: 'INVALID_ENUM' as any,
        limits: { energy: 2000 },
      });
      const errors = await validate(dto as object);
      const warnError = errors.find((e) => e.property === 'warningRule');
      expect(warnError).toBeDefined();
      const messages = Object.values(warnError?.constraints || {});
      expect(messages).toContain('validation.nutrition_limits.warning_rule_enum');
    });
  });

  describe('UpdateNutritionLimitSetDto', () => {
    it('chấp nhận DTO rỗng vì toàn bộ thuộc tính là optional', async () => {
      const dto = plainToInstance(UpdateNutritionLimitSetDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('ném lỗi validation.nutrition_limits.name_max nếu tên cập nhật dài quá 255 ký tự', async () => {
      const dto = plainToInstance(UpdateNutritionLimitSetDto, {
        name: 'b'.repeat(256),
      });
      const errors = await validate(dto);
      const nameError = errors.find((e) => e.property === 'name');
      expect(nameError).toBeDefined();
      const messages = Object.values(nameError?.constraints || {});
      expect(messages).toContain('validation.nutrition_limits.name_max');
    });
  });
});
