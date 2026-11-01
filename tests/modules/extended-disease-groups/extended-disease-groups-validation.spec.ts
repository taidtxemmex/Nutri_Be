import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  CreateExtendedDiseaseGroupDto,
  ExtendedDiseaseGroupQueryDto,
  UpdateExtendedDiseaseGroupDto,
} from '../../../src/modules/extended-disease-groups/dto';
import { I18nService } from '../../../src/core/i18n/i18n.service';

describe('ExtendedDiseaseGroups Module DTO Validation & i18n Dot-Notation Keys', () => {
  let i18nService: I18nService;

  beforeAll(() => {
    i18nService = new I18nService();
  });

  describe('CreateExtendedDiseaseGroupDto', () => {
    it('ném lỗi required khi thiếu extendedCode, displayName, parentId', async () => {
      const dto = plainToInstance(CreateExtendedDiseaseGroupDto, {});
      const errors = await validate(dto);

      const codeError = errors.find((e) => e.property === 'extendedCode');
      expect(codeError).toBeDefined();
      expect(Object.values(codeError?.constraints || {})).toContain(
        'validation.extended_disease_groups.extended_code_required',
      );

      const nameError = errors.find((e) => e.property === 'displayName');
      expect(nameError).toBeDefined();
      expect(Object.values(nameError?.constraints || {})).toContain(
        'validation.extended_disease_groups.display_name_required',
      );

      const parentError = errors.find((e) => e.property === 'parentId');
      expect(parentError).toBeDefined();
      expect(Object.values(parentError?.constraints || {})).toContain(
        'validation.extended_disease_groups.parent_id_required',
      );

      // Parity across locales
      expect(
        i18nService.translate('validation.extended_disease_groups.extended_code_required', 'vi'),
      ).toBe('Mã nhóm mở rộng không được để trống.');
      expect(
        i18nService.translate('validation.extended_disease_groups.extended_code_required', 'en'),
      ).toBe('Extended group code is required.');
      expect(
        i18nService.translate('validation.extended_disease_groups.extended_code_required', 'zh'),
      ).toBe('扩展分组代码不能为空。');
    });

    it('ném lỗi maxLength khi extendedCode > 50 ký tự và displayName > 255 ký tự', async () => {
      const dto = plainToInstance(CreateExtendedDiseaseGroupDto, {
        extendedCode: 'a'.repeat(51),
        displayName: 'b'.repeat(256),
        parentId: 1,
      });
      const errors = await validate(dto);

      const codeError = errors.find((e) => e.property === 'extendedCode');
      expect(codeError).toBeDefined();
      expect(Object.values(codeError?.constraints || {})).toContain(
        'validation.extended_disease_groups.extended_code_max_50',
      );

      const nameError = errors.find((e) => e.property === 'displayName');
      expect(nameError).toBeDefined();
      expect(Object.values(nameError?.constraints || {})).toContain(
        'validation.extended_disease_groups.display_name_max_255',
      );
    });

    it('ném lỗi min khi parentId <= 0', async () => {
      const dto = plainToInstance(CreateExtendedDiseaseGroupDto, {
        extendedCode: '01',
        displayName: 'Nhóm bệnh A',
        parentId: 0,
      });
      const errors = await validate(dto);

      const parentError = errors.find((e) => e.property === 'parentId');
      expect(parentError).toBeDefined();
      expect(Object.values(parentError?.constraints || {})).toContain(
        'validation.extended_disease_groups.parent_id_min',
      );
    });
  });

  describe('ExtendedDiseaseGroupQueryDto', () => {
    it('ném lỗi min khi parentId < 1', async () => {
      const dto = plainToInstance(ExtendedDiseaseGroupQueryDto, {
        parentId: 0,
      });
      const errors = await validate(dto);

      const parentError = errors.find((e) => e.property === 'parentId');
      expect(parentError).toBeDefined();
      expect(Object.values(parentError?.constraints || {})).toContain(
        'validation.extended_disease_groups.parent_id_min',
      );
    });
  });

  describe('UpdateExtendedDiseaseGroupDto', () => {
    it('ném lỗi maxLength khi cập nhật với chuỗi quá dài', async () => {
      const dto = plainToInstance(UpdateExtendedDiseaseGroupDto, {
        extendedCode: 'c'.repeat(51),
        displayName: 'd'.repeat(256),
      });
      const errors = await validate(dto);

      const codeError = errors.find((e) => e.property === 'extendedCode');
      expect(codeError).toBeDefined();
      expect(Object.values(codeError?.constraints || {})).toContain(
        'validation.extended_disease_groups.extended_code_max_50',
      );

      const nameError = errors.find((e) => e.property === 'displayName');
      expect(nameError).toBeDefined();
      expect(Object.values(nameError?.constraints || {})).toContain(
        'validation.extended_disease_groups.display_name_max_255',
      );
    });
  });
});
