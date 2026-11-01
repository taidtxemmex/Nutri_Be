import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateNutritionGuideDto } from '../../../src/modules/nutrition-guides/dto';
import { I18nService } from '../../../src/core/i18n/i18n.service';

describe('NutritionGuides Module DTO Validation & i18n Dot-Notation Keys', () => {
  let i18nService: I18nService;

  beforeAll(() => {
    i18nService = new I18nService();
  });

  describe('CreateNutritionGuideDto', () => {
    it('ném lỗi required khi thiếu diseaseName và code', async () => {
      const dto = plainToInstance(CreateNutritionGuideDto, {});
      const errors = await validate(dto);

      const diseaseError = errors.find((e) => e.property === 'diseaseName');
      expect(diseaseError).toBeDefined();
      expect(Object.values(diseaseError?.constraints || {})).toContain(
        'validation.nutrition_guides.disease_name_required',
      );

      const codeError = errors.find((e) => e.property === 'code');
      expect(codeError).toBeDefined();
      expect(Object.values(codeError?.constraints || {})).toContain(
        'validation.nutrition_guides.code_required',
      );

      // Parity across locales
      expect(i18nService.translate('validation.nutrition_guides.disease_name_required', 'vi')).toBe(
        'Tên bệnh không được để trống.',
      );
      expect(i18nService.translate('validation.nutrition_guides.disease_name_required', 'en')).toBe(
        'Disease name is required.',
      );
      expect(i18nService.translate('validation.nutrition_guides.disease_name_required', 'zh')).toBe(
        '疾病名称不能为空。',
      );
    });

    it('ném lỗi maxLength khi diseaseName, code hoặc title vượt quá 255 ký tự', async () => {
      const dto = plainToInstance(CreateNutritionGuideDto, {
        diseaseName: 'a'.repeat(256),
        code: 'b'.repeat(256),
        title: 'c'.repeat(256),
      });
      const errors = await validate(dto);

      const diseaseError = errors.find((e) => e.property === 'diseaseName');
      expect(diseaseError).toBeDefined();
      expect(Object.values(diseaseError?.constraints || {})).toContain(
        'validation.nutrition_guides.disease_name_max_255',
      );

      const codeError = errors.find((e) => e.property === 'code');
      expect(codeError).toBeDefined();
      expect(Object.values(codeError?.constraints || {})).toContain(
        'validation.nutrition_guides.code_max_255',
      );

      const titleError = errors.find((e) => e.property === 'title');
      expect(titleError).toBeDefined();
      expect(Object.values(titleError?.constraints || {})).toContain(
        'validation.nutrition_guides.title_max_255',
      );
    });

    it('ném lỗi maxLength khi nutritionPrinciple vượt quá 65000 ký tự', async () => {
      const dto = plainToInstance(CreateNutritionGuideDto, {
        diseaseName: 'Đái tháo đường',
        code: 'HD-DTD-01',
        nutritionPrinciple: 'p'.repeat(65001),
      });
      const errors = await validate(dto);

      const principleError = errors.find((e) => e.property === 'nutritionPrinciple');
      expect(principleError).toBeDefined();
      expect(Object.values(principleError?.constraints || {})).toContain(
        'validation.nutrition_guides.principles_max_65000',
      );

      expect(i18nService.translate('validation.nutrition_guides.principles_max_65000', 'vi')).toBe(
        'Nguyên tắc dinh dưỡng tối đa 65000 ký tự.',
      );
      expect(i18nService.translate('validation.nutrition_guides.principles_max_65000', 'en')).toBe(
        'Nutrition principles cannot exceed 65000 characters.',
      );
      expect(i18nService.translate('validation.nutrition_guides.principles_max_65000', 'zh')).toBe(
        '营养原则最多 65000 个字符。',
      );
    });
  });
});
