import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ProfileFilterDto, UpdateProfileDto } from '../../src/modules/profiles/dto';
import { I18nService } from '../../src/core/i18n/i18n.service';

describe('Profiles Module DTO Validation & i18n Dot-Notation Keys', () => {
  let i18nService: I18nService;

  beforeAll(() => {
    i18nService = new I18nService();
  });

  describe('ProfileFilterDto', () => {
    it('ném lỗi validation.profiles.page_min_0 khi page < 0', async () => {
      const dto = plainToInstance(ProfileFilterDto, { page: -1 });
      const errors = await validate(dto);
      const err = errors.find((e) => e.property === 'page');
      expect(err).toBeDefined();
      const messages = Object.values(err?.constraints || {});
      expect(messages).toContain('validation.profiles.page_min_0');
    });

    it('ném lỗi validation.profiles.page_int khi page là số thập phân', async () => {
      const dto = plainToInstance(ProfileFilterDto, { page: 1.5 });
      const errors = await validate(dto);
      const err = errors.find((e) => e.property === 'page');
      expect(err).toBeDefined();
      const messages = Object.values(err?.constraints || {});
      expect(messages).toContain('validation.profiles.page_int');
    });

    it('ném lỗi validation.profiles.keyword_max_255 khi từ khóa vượt quá 255 ký tự', async () => {
      const dto = plainToInstance(ProfileFilterDto, {
        keyword: 'a'.repeat(256),
      });
      const errors = await validate(dto);
      const err = errors.find((e) => e.property === 'keyword');
      expect(err).toBeDefined();
      const messages = Object.values(err?.constraints || {});
      expect(messages).toContain('validation.profiles.keyword_max_255');
    });
  });

  describe('UpdateProfileDto', () => {
    it('ném lỗi validation.profiles.fullname_max_255 khi họ tên vượt quá 255 ký tự', async () => {
      const dto = plainToInstance(UpdateProfileDto, {
        fullName: 'a'.repeat(256),
      });
      const errors = await validate(dto);
      const err = errors.find((e) => e.property === 'fullName');
      expect(err).toBeDefined();
      const messages = Object.values(err?.constraints || {});
      expect(messages).toContain('validation.profiles.fullname_max_255');
    });

    it('ném lỗi validation.profiles.phone_vietnam_format khi số điện thoại không hợp lệ', async () => {
      const dto = plainToInstance(UpdateProfileDto, {
        phone: '12345678',
      });
      const errors = await validate(dto);
      const err = errors.find((e) => e.property === 'phone');
      expect(err).toBeDefined();
      const messages = Object.values(err?.constraints || {});
      expect(messages).toContain('validation.profiles.phone_vietnam_format');
    });

    it('ném lỗi validation.profiles.gender_enum khi giới tính không hợp lệ', async () => {
      const dto = plainToInstance(UpdateProfileDto, {
        gender: 'UNKNOWN' as any,
      });
      const errors = await validate(dto);
      const err = errors.find((e) => e.property === 'gender');
      expect(err).toBeDefined();
      const messages = Object.values(err?.constraints || {});
      expect(messages).toContain('validation.profiles.gender_enum');
    });

    it('ném lỗi validation.profiles.dob_format khi ngày sinh không đúng định dạng YYYY-MM-DD', async () => {
      const dto = plainToInstance(UpdateProfileDto, {
        dob: '15/05/1990',
      });
      const errors = await validate(dto);
      const err = errors.find((e) => e.property === 'dob');
      expect(err).toBeDefined();
      const messages = Object.values(err?.constraints || {});
      expect(messages).toContain('validation.profiles.dob_format');
    });

    it('ném lỗi validation.profiles.avatar_url_max_500 khi avatarUrl > 500 ký tự', async () => {
      const dto = plainToInstance(UpdateProfileDto, {
        avatarUrl: '/uploads/' + 'a'.repeat(500),
      });
      const errors = await validate(dto);
      const err = errors.find((e) => e.property === 'avatarUrl');
      expect(err).toBeDefined();
      const messages = Object.values(err?.constraints || {});
      expect(messages).toContain('validation.profiles.avatar_url_max_500');
    });
  });

  describe('i18n Multi-lingual Parity for Profiles Keys', () => {
    const testKeys = [
      'validation.profiles.page_int',
      'validation.profiles.page_min_0',
      'validation.profiles.size_int',
      'validation.profiles.size_min_1',
      'validation.profiles.size_max_5000',
      'validation.profiles.keyword_string',
      'validation.profiles.keyword_max_255',
      'validation.profiles.role_string',
      'validation.profiles.gender_string',
      'validation.profiles.sort_by_string',
      'validation.profiles.sort_dir_string',
      'validation.profiles.fullname_string',
      'validation.profiles.fullname_max_255',
      'validation.profiles.phone_string',
      'validation.profiles.phone_max_20',
      'validation.profiles.phone_vietnam_format',
      'validation.profiles.address_string',
      'validation.profiles.address_max_255',
      'validation.profiles.gender_enum',
      'validation.profiles.dob_string',
      'validation.profiles.dob_format',
      'validation.profiles.dob_max_20',
      'validation.profiles.avatar_url_string',
      'validation.profiles.avatar_url_max_500',
    ];

    testKeys.forEach((key) => {
      it(`dịch key ${key} thành công trên cả 3 ngôn ngữ (vi, en, zh)`, () => {
        const viText = i18nService.translate(key, 'vi');
        const enText = i18nService.translate(key, 'en');
        const zhText = i18nService.translate(key, 'zh');

        expect(viText).toBeDefined();
        expect(viText).not.toBe(key);
        expect(enText).toBeDefined();
        expect(enText).not.toBe(key);
        expect(zhText).toBeDefined();
        expect(zhText).not.toBe(key);
      });
    });
  });
});
