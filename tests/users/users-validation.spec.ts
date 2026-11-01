import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  BatchUserIdsDto,
  BatchUpdateUserStatusDto,
  CreateUserItemDto,
  BatchCreateUsersDto,
  UpdateUserInfoReqDto,
  UpdateUserRoleDto,
  UserInfoRequestDto,
  QueryUsersDto,
} from '../../src/modules/users/dto';
import { I18nService } from '../../src/core/i18n/i18n.service';

describe('Users Module DTO Validation & i18n Dot-Notation Keys', () => {
  let i18nService: I18nService;

  beforeAll(() => {
    i18nService = new I18nService();
  });

  describe('BatchUserIdsDto', () => {
    it('ném lỗi validation.users.user_ids_array khi userIds không phải mảng', async () => {
      const dto = plainToInstance(BatchUserIdsDto, { userIds: 'not-an-array' });
      const errors = await validate(dto);
      const err = errors.find((e) => e.property === 'userIds');
      expect(err).toBeDefined();
      const messages = Object.values(err?.constraints || {});
      expect(messages).toContain('validation.users.user_ids_array');
    });

    it('ném lỗi validation.users.user_ids_min khi danh sách rỗng', async () => {
      const dto = plainToInstance(BatchUserIdsDto, { userIds: [] });
      const errors = await validate(dto);
      const err = errors.find((e) => e.property === 'userIds');
      expect(err).toBeDefined();
      const messages = Object.values(err?.constraints || {});
      expect(messages).toContain('validation.users.user_ids_min');
    });

    it('ném lỗi validation.users.user_id_invalid khi ID không đúng định dạng UUID', async () => {
      const dto = plainToInstance(BatchUserIdsDto, { userIds: ['invalid-uuid-format'] });
      const errors = await validate(dto);
      const err = errors.find((e) => e.property === 'userIds');
      expect(err).toBeDefined();
      const messages = Object.values(err?.constraints || {});
      expect(messages).toContain('validation.users.user_id_invalid');
    });
  });

  describe('BatchUpdateUserStatusDto', () => {
    it('ném lỗi validation.users.status_boolean khi isActive không phải boolean', async () => {
      const dto = plainToInstance(BatchUpdateUserStatusDto, {
        userIds: ['00000000-0000-0000-0000-000000000001'],
        isActive: 'not-a-boolean',
      });
      const errors = await validate(dto);
      const err = errors.find((e) => e.property === 'isActive');
      expect(err).toBeDefined();
      const messages = Object.values(err?.constraints || {});
      expect(messages).toContain('validation.users.status_boolean');
    });
  });

  describe('CreateUserItemDto', () => {
    it('ném lỗi validation.users.username_required khi để trống username', async () => {
      const dto = plainToInstance(CreateUserItemDto, {
        username: '',
        fullName: 'Nguyễn Văn Nam',
        email: 'nam@truenutri.vn',
      });
      const errors = await validate(dto);
      const err = errors.find((e) => e.property === 'username');
      expect(err).toBeDefined();
      const messages = Object.values(err?.constraints || {});
      expect(messages).toContain('validation.users.username_required');
    });

    it('ném lỗi validation.users.username_min_4 khi username < 4 ký tự', async () => {
      const dto = plainToInstance(CreateUserItemDto, {
        username: 'abc',
        fullName: 'Nguyễn Văn Nam',
        email: 'nam@truenutri.vn',
      });
      const errors = await validate(dto);
      const err = errors.find((e) => e.property === 'username');
      expect(err).toBeDefined();
      const messages = Object.values(err?.constraints || {});
      expect(messages).toContain('validation.users.username_min_4');
    });

    it('ném lỗi validation.users.email_invalid khi email sai định dạng', async () => {
      const dto = plainToInstance(CreateUserItemDto, {
        username: 'bacsi_nam',
        fullName: 'Nguyễn Văn Nam',
        email: 'invalid-email',
      });
      const errors = await validate(dto);
      const err = errors.find((e) => e.property === 'email');
      expect(err).toBeDefined();
      const messages = Object.values(err?.constraints || {});
      expect(messages).toContain('validation.users.email_invalid');
    });

    it('ném lỗi validation.users.phone_vietnam_format khi số điện thoại không hợp lệ', async () => {
      const dto = plainToInstance(CreateUserItemDto, {
        username: 'bacsi_nam',
        fullName: 'Nguyễn Văn Nam',
        email: 'nam@truenutri.vn',
        phone: '123456',
      });
      const errors = await validate(dto);
      const err = errors.find((e) => e.property === 'phone');
      expect(err).toBeDefined();
      const messages = Object.values(err?.constraints || {});
      expect(messages).toContain('validation.users.phone_vietnam_format');
    });

    it('ném lỗi validation.users.role_invalid khi role không tồn tại trong UserRole enum', async () => {
      const dto = plainToInstance(CreateUserItemDto, {
        username: 'bacsi_nam',
        fullName: 'Nguyễn Văn Nam',
        email: 'nam@truenutri.vn',
        role: 'NON_EXISTENT_ROLE' as any,
      });
      const errors = await validate(dto);
      const err = errors.find((e) => e.property === 'role');
      expect(err).toBeDefined();
      const messages = Object.values(err?.constraints || {});
      expect(messages).toContain('validation.users.role_invalid');
    });
  });

  describe('BatchCreateUsersDto', () => {
    it('ném lỗi validation.users.users_array và users_min khi danh sách rỗng', async () => {
      const dto = plainToInstance(BatchCreateUsersDto, { users: [] });
      const errors = await validate(dto);
      const err = errors.find((e) => e.property === 'users');
      expect(err).toBeDefined();
      const messages = Object.values(err?.constraints || {});
      expect(messages).toContain('validation.users.users_min');
    });
  });

  describe('UpdateUserInfoReqDto', () => {
    it('ném lỗi validation.users.gender_enum khi giới tính không hợp lệ', async () => {
      const dto = plainToInstance(UpdateUserInfoReqDto, {
        gender: 'OTHER' as any,
      });
      const errors = await validate(dto);
      const err = errors.find((e) => e.property === 'gender');
      expect(err).toBeDefined();
      const messages = Object.values(err?.constraints || {});
      expect(messages).toContain('validation.users.gender_enum');
    });

    it('ném lỗi validation.users.dob_format khi ngày sinh sai định dạng', async () => {
      const dto = plainToInstance(UpdateUserInfoReqDto, {
        dob: '15/05/1990',
      });
      const errors = await validate(dto);
      const err = errors.find((e) => e.property === 'dob');
      expect(err).toBeDefined();
      const messages = Object.values(err?.constraints || {});
      expect(messages).toContain('validation.users.dob_format');
    });
  });

  describe('UpdateUserRoleDto', () => {
    it('ném lỗi validation.users.new_role_required khi để trống newRole', async () => {
      const dto = plainToInstance(UpdateUserRoleDto, {});
      const errors = await validate(dto);
      const err = errors.find((e) => e.property === 'newRole');
      expect(err).toBeDefined();
      const messages = Object.values(err?.constraints || {});
      expect(messages).toContain('validation.users.new_role_required');
    });

    it('ném lỗi validation.users.role_invalid khi newRole không hợp lệ', async () => {
      const dto = plainToInstance(UpdateUserRoleDto, { newRole: 'INVALID_ROLE' as any });
      const errors = await validate(dto);
      const err = errors.find((e) => e.property === 'newRole');
      expect(err).toBeDefined();
      const messages = Object.values(err?.constraints || {});
      expect(messages).toContain('validation.users.role_invalid');
    });
  });

  describe('UserInfoRequestDto', () => {
    it('ném lỗi validation.users.user_id_required khi để trống userId', async () => {
      const dto = plainToInstance(UserInfoRequestDto, { userId: '' });
      const errors = await validate(dto);
      const err = errors.find((e) => e.property === 'userId');
      expect(err).toBeDefined();
      const messages = Object.values(err?.constraints || {});
      expect(messages).toContain('validation.users.user_id_required');
    });
  });

  describe('QueryUsersDto', () => {
    it('ném lỗi validation.users.role_invalid khi lọc theo role không hợp lệ', async () => {
      const dto = plainToInstance(QueryUsersDto, { role: 'INVALID' as any });
      const errors = await validate(dto);
      const err = errors.find((e) => e.property === 'role');
      expect(err).toBeDefined();
      const messages = Object.values(err?.constraints || {});
      expect(messages).toContain('validation.users.role_invalid');
    });
  });

  describe('i18n Multi-lingual Parity for Users Keys', () => {
    const testKeys = [
      'validation.users.user_ids_array',
      'validation.users.user_ids_min',
      'validation.users.user_id_invalid',
      'validation.users.user_id_required',
      'validation.users.user_id_string',
      'validation.users.user_id_max_50',
      'validation.users.status_boolean',
      'validation.users.username_required',
      'validation.users.username_string',
      'validation.users.username_min_4',
      'validation.users.role_invalid',
      'validation.users.fullname_required',
      'validation.users.fullname_string',
      'validation.users.fullname_min_2',
      'validation.users.fullname_max_255',
      'validation.users.email_required',
      'validation.users.email_invalid',
      'validation.users.phone_string',
      'validation.users.phone_max_20',
      'validation.users.phone_vietnam_format',
      'validation.users.password_string',
      'validation.users.password_min_8',
      'validation.users.users_array',
      'validation.users.users_min',
      'validation.users.users_max',
      'validation.users.new_role_required',
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
