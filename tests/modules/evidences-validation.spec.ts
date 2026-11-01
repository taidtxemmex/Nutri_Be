import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  CreateEvidenceDto,
  GeneratePreviewObjectParamsDto,
  GenerateDownloadObjectParamsDto,
} from '../../src/modules/evidences/dto';
import { I18nService } from '../../src/core/i18n/i18n.service';

describe('Evidences Module DTO Validation & i18n Dot-Notation Keys', () => {
  let i18nService: I18nService;

  beforeAll(() => {
    i18nService = new I18nService();
  });

  describe('CreateEvidenceDto', () => {
    it('ném lỗi validation.evidences.title_string khi title không phải chuỗi', async () => {
      const dto = plainToInstance(CreateEvidenceDto, {
        title: 12345,
      });
      const errors = await validate(dto);
      const titleError = errors.find((e) => e.property === 'title');
      expect(titleError).toBeDefined();
      const messages = Object.values(titleError?.constraints || {});
      expect(messages).toContain('validation.evidences.title_string');

      // Parity across locales
      expect(i18nService.translate('validation.evidences.title_string', 'vi')).toBe(
        'Tiêu đề minh chứng phải là chuỗi',
      );
      expect(i18nService.translate('validation.evidences.title_string', 'en')).toBe(
        'Evidence title must be a string',
      );
      expect(i18nService.translate('validation.evidences.title_string', 'zh')).toBe(
        '证明标题 必须是字符串',
      );
    });

    it('ném lỗi validation.evidences.title_max_255 khi title vượt 255 ký tự', async () => {
      const dto = plainToInstance(CreateEvidenceDto, {
        title: 'T'.repeat(256),
      });
      const errors = await validate(dto);
      const titleError = errors.find((e) => e.property === 'title');
      expect(titleError).toBeDefined();
      const messages = Object.values(titleError?.constraints || {});
      expect(messages).toContain('validation.evidences.title_max_255');
    });

    it('ném lỗi validation.evidences.type_string khi evidenceType không phải chuỗi', async () => {
      const dto = plainToInstance(CreateEvidenceDto, {
        evidenceType: 999,
      });
      const errors = await validate(dto);
      const typeError = errors.find((e) => e.property === 'evidenceType');
      expect(typeError).toBeDefined();
      const messages = Object.values(typeError?.constraints || {});
      expect(messages).toContain('validation.evidences.type_string');
    });

    it('ném lỗi validation.evidences.type_max_100 khi evidenceType vượt 100 ký tự', async () => {
      const dto = plainToInstance(CreateEvidenceDto, {
        evidenceType: 'E'.repeat(101),
      });
      const errors = await validate(dto);
      const typeError = errors.find((e) => e.property === 'evidenceType');
      expect(typeError).toBeDefined();
      const messages = Object.values(typeError?.constraints || {});
      expect(messages).toContain('validation.evidences.type_max_100');
    });

    it('ném lỗi validation.evidences.note_max_5000 khi note vượt 5000 ký tự', async () => {
      const dto = plainToInstance(CreateEvidenceDto, {
        note: 'N'.repeat(5001),
      });
      const errors = await validate(dto);
      const noteError = errors.find((e) => e.property === 'note');
      expect(noteError).toBeDefined();
      const messages = Object.values(noteError?.constraints || {});
      expect(messages).toContain('validation.evidences.note_max_5000');

      // Parity across locales
      expect(i18nService.translate('validation.evidences.note_max_5000', 'vi')).toBe(
        'Ghi chú tối đa 5000 ký tự',
      );
      expect(i18nService.translate('validation.evidences.note_max_5000', 'en')).toBe(
        'Note must not exceed 5000 characters',
      );
      expect(i18nService.translate('validation.evidences.note_max_5000', 'zh')).toBe(
        '备注不能超过 5000 个字符',
      );
    });

    it('ném lỗi validation.evidences.external_link_max_2048 khi externalLink vượt 2048 ký tự', async () => {
      const dto = plainToInstance(CreateEvidenceDto, {
        externalLink: 'https://example.com/' + 'a'.repeat(2040),
      });
      const errors = await validate(dto);
      const linkError = errors.find((e) => e.property === 'externalLink');
      expect(linkError).toBeDefined();
      const messages = Object.values(linkError?.constraints || {});
      expect(messages).toContain('validation.evidences.external_link_max_2048');

      // Parity across locales
      expect(i18nService.translate('validation.evidences.external_link_max_2048', 'vi')).toBe(
        'Đường dẫn liên kết ngoài tối đa 2048 ký tự',
      );
      expect(i18nService.translate('validation.evidences.external_link_max_2048', 'en')).toBe(
        'External link must not exceed 2048 characters',
      );
      expect(i18nService.translate('validation.evidences.external_link_max_2048', 'zh')).toBe(
        '外部链接 不能超过 2048 个字符',
      );
    });
  });

  describe('GeneratePreviewObjectParamsDto & GenerateDownloadObjectParamsDto', () => {
    it('ném lỗi validation.evidences.object_key_required khi objectKey rỗng', async () => {
      const dto = plainToInstance(GeneratePreviewObjectParamsDto, {
        objectKey: '',
      });
      const errors = await validate(dto);
      const keyError = errors.find((e) => e.property === 'objectKey');
      expect(keyError).toBeDefined();
      const messages = Object.values(keyError?.constraints || {});
      expect(messages).toContain('validation.evidences.object_key_required');

      // Parity across locales
      expect(i18nService.translate('validation.evidences.object_key_required', 'vi')).toBe(
        'objectKey không được để trống',
      );
      expect(i18nService.translate('validation.evidences.object_key_required', 'en')).toBe(
        'Object key should not be empty',
      );
      expect(i18nService.translate('validation.evidences.object_key_required', 'zh')).toBe(
        '对象键 不能为空',
      );
    });

    it('ném lỗi validation.evidences.original_filename_prop_max_255 khi originalFileName vượt 255 ký tự', async () => {
      const dto = plainToInstance(GenerateDownloadObjectParamsDto, {
        objectKey: 'valid/key.pdf',
        originalFileName: 'F'.repeat(256),
      });
      const errors = await validate(dto);
      const fnError = errors.find((e) => e.property === 'originalFileName');
      expect(fnError).toBeDefined();
      const messages = Object.values(fnError?.constraints || {});
      expect(messages).toContain('validation.evidences.original_filename_prop_max_255');
    });
  });
});
