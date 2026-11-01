import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  CreateMenuDto,
  ExportMenuDto,
  ExportMarketPlanDto,
  MenuQueryDto,
} from '../../../src/modules/menus/dto';
import { I18nService } from '../../../src/core/i18n/i18n.service';
import { MenuType, TargetType } from '../../../src/config/enums/domain.enum';

describe('Menus Module DTO Validation & i18n Dot-Notation Keys', () => {
  let i18nService: I18nService;

  beforeAll(() => {
    i18nService = new I18nService();
  });

  describe('CreateMenuDto', () => {
    it('ném lỗi validation.menus.name_required khi tên thực đơn trống', async () => {
      const dto = plainToInstance(CreateMenuDto, {
        menuName: '',
        menuType: MenuType.NGAY,
        targetType: TargetType.BENH_NHAN,
      });
      const errors = await validate(dto);
      const nameError = errors.find((e) => e.property === 'menuName');
      expect(nameError).toBeDefined();
      const messages = Object.values(nameError?.constraints || {});
      expect(messages).toContain('validation.menus.name_required');

      // Parity across locales
      expect(i18nService.translate('validation.menus.name_required', 'vi')).toBe(
        'Tên thực đơn không được để trống.',
      );
      expect(i18nService.translate('validation.menus.name_required', 'en')).toBe(
        'Menu name is required.',
      );
      expect(i18nService.translate('validation.menus.name_required', 'zh')).toBe(
        '食谱名称不能为空。',
      );
    });

    it('ném lỗi validation.menus.menu_type_required khi thiếu menuType', async () => {
      const dto = plainToInstance(CreateMenuDto, {
        menuName: 'Thực đơn mẫu tuần 1',
        targetType: TargetType.BENH_NHAN,
      });
      const errors = await validate(dto);
      const typeError = errors.find((e) => e.property === 'menuType');
      expect(typeError).toBeDefined();
      const messages = Object.values(typeError?.constraints || {});
      expect(messages).toContain('validation.menus.menu_type_required');
    });

    it('ném lỗi validation.menus.target_type_required khi thiếu targetType', async () => {
      const dto = plainToInstance(CreateMenuDto, {
        menuName: 'Thực đơn mẫu tuần 1',
        menuType: MenuType.NGAY,
      });
      const errors = await validate(dto);
      const targetError = errors.find((e) => e.property === 'targetType');
      expect(targetError).toBeDefined();
      const messages = Object.values(targetError?.constraints || {});
      expect(messages).toContain('validation.menus.target_type_required');
    });
  });

  describe('ExportMenuDto', () => {
    it('ném lỗi validation.menus.servings_min khi số suất ăn < 1', async () => {
      const dto = plainToInstance(ExportMenuDto, {
        servings: 0,
      });
      const errors = await validate(dto);
      const servingError = errors.find((e) => e.property === 'servings');
      expect(servingError).toBeDefined();
      const messages = Object.values(servingError?.constraints || {});
      expect(messages).toContain('validation.menus.servings_min');
      expect(i18nService.translate('validation.menus.servings_min', 'vi')).toBe(
        'Số suất ăn phải lớn hơn hoặc bằng 1.',
      );
      expect(i18nService.translate('validation.menus.servings_min', 'en')).toBe(
        'Servings must be at least 1.',
      );
      expect(i18nService.translate('validation.menus.servings_min', 'zh')).toBe(
        '份数必须大于或等于 1。',
      );
    });
  });

  describe('ExportMarketPlanDto', () => {
    it('ném lỗi validation.menus.servings_max_10k khi số suất ăn đi chợ > 10,000', async () => {
      const dto = plainToInstance(ExportMarketPlanDto, {
        servings: 15000,
      });
      const errors = await validate(dto);
      const servingError = errors.find((e) => e.property === 'servings');
      expect(servingError).toBeDefined();
      const messages = Object.values(servingError?.constraints || {});
      expect(messages).toContain('validation.menus.servings_max_10k');
    });
  });

  describe('MenuQueryDto', () => {
    it('ném lỗi validation.menus.page_min khi page < 1', async () => {
      const dto = plainToInstance(MenuQueryDto, {
        page: 0,
      });
      const errors = await validate(dto);
      const pageError = errors.find((e) => e.property === 'page');
      expect(pageError).toBeDefined();
      const messages = Object.values(pageError?.constraints || {});
      expect(messages).toContain('validation.menus.page_min');
    });

    it('ném lỗi validation.menus.limit_max khi limit > 100', async () => {
      const dto = plainToInstance(MenuQueryDto, {
        limit: 150,
      });
      const errors = await validate(dto);
      const limitError = errors.find((e) => e.property === 'limit');
      expect(limitError).toBeDefined();
      const messages = Object.values(limitError?.constraints || {});
      expect(messages).toContain('validation.menus.limit_max');
    });
  });
});
