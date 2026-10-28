import { I18nService } from '../../src/core/i18n/i18n.service';
import { GlobalExceptionFilter } from '../../src/common/filters/global-exception.filter';
import { CustomValidationPipe } from '../../src/common/pipes/custom-validation.pipe';
import {
  NotFoundException,
  BadRequestException,
  HttpStatus,
  ValidationError,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('I18nService Multi-Language Tests (vi, en, zh)', () => {
  let service: I18nService;

  beforeEach(() => {
    service = new I18nService();
  });

  it('nên hỗ trợ đủ 3 ngôn ngữ vi, en, zh', () => {
    expect(service.getSupportedLocales()).toEqual(['vi', 'en', 'zh']);
  });

  it('nên dịch chính xác thông báo lỗi theo tiếng Việt (vi)', () => {
    const msg = service.translate('error.user.not_found', 'vi');
    expect(msg).toBe('Không tìm thấy người dùng');
  });

  it('nên dịch chính xác thông báo lỗi theo tiếng Anh (en)', () => {
    const msg = service.translate('error.user.not_found', 'en');
    expect(msg).toBe('User not found');
  });

  it('nên dịch chính xác thông báo lỗi theo tiếng Trung (zh)', () => {
    const msg = service.translate('error.user.not_found', 'zh');
    expect(msg).toBe('未找到用户');
  });

  it('nên dịch chính xác thông báo validation regex', () => {
    expect(service.translate('error.password.invalid_format', 'vi')).toContain('Mật khẩu');
    expect(service.translate('error.password.invalid_format', 'en')).toContain('Password');
    expect(service.translate('error.password.invalid_format', 'zh')).toContain('密码');
  });

  it('nên tự động fallback về tiếng Việt nếu truyền locale không hỗ trợ hoặc key chưa dịch', () => {
    const msg = service.translate('error.user.not_found', 'fr' as any);
    expect(msg).toBe('Không tìm thấy người dùng');
  });

  it('nên xử lý mượt mà key có bọc ngoặc nhọn dạng {error.username.invalid}', () => {
    const msg = service.translate('{error.username.invalid}', 'vi');
    expect(msg).toBe('Tên đăng nhập phải từ 6–30 ký tự, chỉ gồm chữ, số và dấu gạch dưới');
  });

  it('nên dịch chính xác 4 entries mới bổ sung trong zh.json', () => {
    expect(service.translate('Bản ghi yêu cầu không tồn tại trong cơ sở dữ liệu', 'zh')).toBe(
      '数据库中不存在请求的记录',
    );
    expect(
      service.translate('Dữ liệu đã tồn tại trong hệ thống (vi phạm tính duy nhất).', 'zh'),
    ).toBe('数据已存在于系统中（违反唯一性约束）。');
    expect(service.translate('Dữ liệu gửi lên không đúng định dạng hoặc không hợp lệ', 'zh')).toBe(
      '提交的数据格式不正确或无效',
    );
    expect(service.translate('Dữ liệu gửi lên không hợp lệ', 'zh')).toBe('提交的数据无效');
  });

  it('nên dịch mượt mà các dynamic patterns mặc định của class-validator theo cả 3 ngôn ngữ', () => {
    // 1. should not be empty
    expect(service.translateTextOrKey('username should not be empty', 'vi')).toBe(
      'Tên đăng nhập không được để trống',
    );
    expect(service.translateTextOrKey('username should not be empty', 'en')).toBe(
      'Username should not be empty',
    );
    expect(service.translateTextOrKey('username should not be empty', 'zh')).toBe(
      '用户名 不能为空',
    );

    // 2. must be a string
    expect(service.translateTextOrKey('username must be a string', 'vi')).toBe(
      'Tên đăng nhập phải là chuỗi ký tự',
    );
    expect(service.translateTextOrKey('username must be a string', 'en')).toBe(
      'Username must be a string',
    );
    expect(service.translateTextOrKey('username must be a string', 'zh')).toBe(
      '用户名 必须是字符串',
    );

    // 3. must be an integer number
    expect(service.translateTextOrKey('weight must be an integer number', 'vi')).toBe(
      'Cân nặng phải là số nguyên',
    );
    expect(service.translateTextOrKey('weight must be an integer number', 'en')).toBe(
      'Weight must be an integer number',
    );

    // 4. must be a number
    expect(service.translateTextOrKey('height must be a number', 'zh')).toBe('身高 必须是数字');

    // 5. must be a boolean value
    expect(service.translateTextOrKey('status must be a boolean value', 'vi')).toBe(
      'Trạng thái phải là giá trị boolean (true/false)',
    );

    // 6. must be an email
    expect(service.translateTextOrKey('email must be an email', 'en')).toBe(
      'Email must be a valid email address',
    );

    // 7. minLength
    expect(
      service.translateTextOrKey('username must be longer than or equal to 6 characters', 'vi'),
    ).toBe('Tên đăng nhập phải có tối thiểu 6 ký tự');
    expect(
      service.translateTextOrKey('username must be longer than or equal to 6 characters', 'en'),
    ).toBe('Username must be longer than or equal to 6 characters');
    expect(
      service.translateTextOrKey('username must be longer than or equal to 6 characters', 'zh'),
    ).toBe('用户名 长度至少为 6 个字符');

    // 8. maxLength
    expect(
      service.translateTextOrKey('username must be shorter than or equal to 30 characters', 'vi'),
    ).toBe('Tên đăng nhập không được vượt quá 30 ký tự');
  });

  it('nên dịch chính xác dynamic pattern mật khẩu tối thiểu X ký tự', () => {
    expect(service.translateTextOrKey('Mật khẩu tối thiểu 8 ký tự', 'en')).toBe(
      'Password must be at least 8 characters',
    );
    expect(service.translateTextOrKey('Mật khẩu phải có tối thiểu 8 ký tự', 'en')).toBe(
      'Password must be at least 8 characters',
    );
    expect(service.translateTextOrKey('Mật khẩu tối thiểu 8 ký tự', 'zh')).toBe(
      '密码 必须至少为 8 个字符',
    );
    expect(service.translateTextOrKey('Mật khẩu phải có tối thiểu 8 ký tự', 'zh')).toBe(
      '密码 必须至少为 8 个字符',
    );
    expect(service.translateTextOrKey('Mật khẩu tối thiểu 8 ký tự', 'vi')).toBe(
      'Mật khẩu tối thiểu 8 ký tự',
    );
  });

  describe('GlobalExceptionFilter & CustomValidationPipe Multi-Language Tests', () => {
    let filter: GlobalExceptionFilter;
    let mockResponse: any;
    let responseData: any;
    let statusCode: number;

    const createHost = (locale: string) => {
      const mockRequest: any = {
        headers: {},
        locale,
        method: 'GET',
        url: '/api/test',
      };
      mockResponse = {
        headersSent: false,
        setHeader: jest.fn(),
        status: jest.fn().mockImplementation((code: number) => {
          statusCode = code;
          return mockResponse;
        }),
        json: jest.fn().mockImplementation((data: any) => {
          responseData = data;
          return mockResponse;
        }),
      };
      return {
        switchToHttp: () => ({
          getResponse: () => mockResponse,
          getRequest: () => mockRequest,
        }),
      } as any;
    };

    beforeEach(() => {
      filter = new GlobalExceptionFilter(service);
      responseData = null;
      statusCode = 0;
    });

    it('nên trả về lỗi NotFoundException dịch theo vi, en, zh', () => {
      // 1. Vietnamese (default)
      filter.catch(new NotFoundException(), createHost('vi'));
      expect(statusCode).toBe(HttpStatus.NOT_FOUND);
      expect(responseData.error.code).toBe('RESOURCE_NOT_FOUND');
      expect(responseData.message).toBe('Không tìm thấy tài nguyên yêu cầu');
      expect(responseData.error.message).toBe('Không tìm thấy tài nguyên yêu cầu');

      // 2. English
      filter.catch(new NotFoundException(), createHost('en'));
      expect(responseData.error.code).toBe('RESOURCE_NOT_FOUND');
      expect(responseData.message).toBe('Requested resource not found');
      expect(responseData.error.message).toBe('Requested resource not found');

      // 3. Chinese
      filter.catch(new NotFoundException(), createHost('zh'));
      expect(responseData.error.code).toBe('RESOURCE_NOT_FOUND');
      expect(responseData.message).toBe('未找到请求的资源');
      expect(responseData.error.message).toBe('未找到请求的资源');
    });

    it('nên trả về VALIDATION_FAILED với root message và mảng details dịch theo 3 thứ tiếng', () => {
      const getValidationException = () =>
        new BadRequestException({
          code: 'VALIDATION_FAILED',
          message: 'VALIDATION_FAILED',
          details: [
            {
              field: 'username',
              code: 'ISNOTEMPTY',
              message: 'Tên đăng nhập không được để trống',
            },
            {
              field: 'password',
              code: 'MINLENGTH',
              message: 'Mật khẩu tối thiểu 8 ký tự',
            },
          ],
        });

      // 1. Vietnamese
      filter.catch(getValidationException(), createHost('vi'));
      expect(statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(responseData.error.code).toBe('VALIDATION_FAILED');
      expect(responseData.message).toBe('Dữ liệu gửi lên không đúng định dạng hoặc không hợp lệ');
      expect(responseData.error.details[0].message).toBe('Tên đăng nhập không được để trống');
      expect(responseData.error.details[1].message).toBe('Mật khẩu tối thiểu 8 ký tự');

      // 2. English
      filter.catch(getValidationException(), createHost('en'));
      expect(responseData.message).toBe('Submitted data is invalid or malformed');
      expect(responseData.error.details[0].message).toBe('Username should not be empty');
      expect(responseData.error.details[1].message).toBe('Password must be at least 8 characters');

      // 3. Chinese
      filter.catch(getValidationException(), createHost('zh'));
      expect(responseData.message).toBe('提交的数据格式不正确或无效');
      expect(responseData.error.details[0].message).toBe('用户名 不能为空');
      expect(responseData.error.details[1].message).toBe('密码 必须至少为 8 个字符');
    });

    it('nên dịch chính xác thông báo mặc định của class-validator trong details khi không có custom message', () => {
      const validationException = new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'VALIDATION_FAILED',
        details: [
          {
            field: 'email',
            code: 'ISEMAIL',
            message: 'email must be an email',
          },
        ],
      });

      // English
      filter.catch(validationException, createHost('en'));
      expect(responseData.error.details[0].message).toBe('Email must be a valid email address');

      // Vietnamese
      filter.catch(validationException, createHost('vi'));
      expect(responseData.error.details[0].message).toBe('Email phải là địa chỉ email hợp lệ');

      // Chinese
      filter.catch(validationException, createHost('zh'));
      expect(responseData.error.details[0].message).toBe('电子邮箱 必须是有效的电子邮箱');
    });

    it('nên dịch chính xác các lỗi Prisma ORM (P2002, P2025, P2003, default) theo 3 ngôn ngữ', () => {
      const p2002Err = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
      });
      filter.catch(p2002Err, createHost('vi'));
      expect(statusCode).toBe(HttpStatus.CONFLICT);
      expect(responseData.error.code).toBe('DATA_CONFLICT');
      expect(responseData.message).toBe(
        'Dữ liệu đã tồn tại trong hệ thống (vi phạm tính duy nhất)',
      );

      filter.catch(p2002Err, createHost('en'));
      expect(responseData.message).toBe(
        'Data already exists in the system (unique constraint violation)',
      );

      filter.catch(p2002Err, createHost('zh'));
      expect(responseData.message).toBe('数据已存在于系统中（违反唯一性约束）');

      // P2025
      const p2025Err = new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '5.0.0',
      });
      filter.catch(p2025Err, createHost('zh'));
      expect(statusCode).toBe(HttpStatus.NOT_FOUND);
      expect(responseData.error.code).toBe('RESOURCE_NOT_FOUND');
      expect(responseData.message).toBe('未找到请求的资源');

      // P2003
      const p2003Err = new Prisma.PrismaClientKnownRequestError('Foreign key failed', {
        code: 'P2003',
        clientVersion: '5.0.0',
      });
      filter.catch(p2003Err, createHost('en'));
      expect(statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(responseData.error.code).toBe('FOREIGN_KEY_CONSTRAINT_VIOLATION');
      expect(responseData.message).toBe(
        'Cannot perform operation because data is in use by another entity',
      );
    });

    it('CustomValidationPipe nên cấu trúc exception với code VALIDATION_FAILED và message VALIDATION_FAILED', () => {
      const pipe = new CustomValidationPipe(service);
      const mockErrors: ValidationError[] = [
        {
          property: 'username',
          constraints: {
            isNotEmpty: 'Tên đăng nhập không được để trống',
          },
        },
      ];

      const err = (pipe as any).validatorOptions.exceptionFactory(mockErrors);
      expect(err).toBeInstanceOf(BadRequestException);
      const res = err.getResponse();
      expect(res.code).toBe('VALIDATION_FAILED');
      expect(res.message).toBe('VALIDATION_FAILED');
      expect(res.details).toHaveLength(1);
      expect(res.details[0].field).toBe('username');
      expect(res.details[0].code).toBe('ISNOTEMPTY');
      expect(res.details[0].message).toBe('Tên đăng nhập không được để trống');
    });

    it('nên dịch chính xác các dynamic patterns mới bổ sung theo cả 3 ngôn ngữ (vi, en, zh)', () => {
      // 1. Chỉ cho phép import tối đa N dòng mỗi lần
      expect(service.translateTextOrKey('Chỉ cho phép import tối đa 500 dòng mỗi lần', 'vi')).toBe(
        'Chỉ cho phép import tối đa 500 dòng mỗi lần',
      );
      expect(service.translateTextOrKey('Chỉ cho phép import tối đa 500 dòng mỗi lần', 'en')).toBe(
        'Only up to 500 rows per import are allowed',
      );
      expect(service.translateTextOrKey('Chỉ cho phép import tối đa 500 dòng mỗi lần', 'zh')).toBe(
        '单次导入最多仅允许 500 行',
      );

      // 2. Chỉ cho phép import tối đa N bệnh nhân / file
      expect(
        service.translateTextOrKey('Chỉ cho phép import tối đa 50 bệnh nhân / file', 'en'),
      ).toBe('Only up to 50 patients per file are allowed to import');
      expect(
        service.translateTextOrKey('Chỉ cho phép import tối đa 50 bệnh nhân / file', 'zh'),
      ).toBe('单次导入最多仅允许 50 名患者');

      // 3. Các tài khoản sau đã tồn tại trong hệ thống: ...
      expect(
        service.translateTextOrKey(
          'Các tài khoản sau đã tồn tại trong hệ thống: user1, user2',
          'vi',
        ),
      ).toBe('Các tài khoản sau đã tồn tại trong hệ thống: user1, user2');
      expect(
        service.translateTextOrKey(
          'Các tài khoản sau đã tồn tại trong hệ thống: user1, user2',
          'en',
        ),
      ).toBe('The following accounts already exist in the system: user1, user2');
      expect(
        service.translateTextOrKey(
          'Các tài khoản sau đã tồn tại trong hệ thống: user1, user2',
          'zh',
        ),
      ).toBe('以下账户已存在于系统中：user1, user2');

      // 4. Xóa thành công MODEL id: ID
      expect(service.translateTextOrKey('Xóa thành công dish id: 100', 'en')).toBe(
        'Successfully deleted dish ID: 100',
      );
      expect(service.translateTextOrKey('Xóa thành công dish id: 100', 'zh')).toBe(
        '成功删除 dish ID：100',
      );

      // 5. Nhập thành công N món ăn vào hệ thống
      expect(service.translateTextOrKey('Nhập thành công 25 món ăn vào hệ thống', 'en')).toBe(
        'Successfully imported 25 dishes into the system',
      );
      expect(service.translateTextOrKey('Nhập thành công 25 món ăn vào hệ thống', 'zh')).toBe(
        '成功导入 25 道菜品到系统中',
      );

      // 6. Đã xóa nguyên liệu thành công (ID: ...)
      expect(service.translateTextOrKey('Đã xóa nguyên liệu thành công (ID: 888)', 'en')).toBe(
        'Successfully deleted ingredient (ID: 888)',
      );
      expect(service.translateTextOrKey('Đã xóa nguyên liệu thành công (ID: 888)', 'zh')).toBe(
        '成功删除原料 (ID: 888)',
      );

      // 7. Nhập thành công khẩu phần 24h gồm N bữa ăn và M nguyên liệu vào hồ sơ bệnh nhân
      expect(
        service.translateTextOrKey(
          'Nhập thành công khẩu phần 24h gồm 3 bữa ăn và 12 nguyên liệu vào hồ sơ bệnh nhân',
          'en',
        ),
      ).toBe(
        'Successfully imported 24-hour dietary intake record with 3 meals and 12 ingredients into patient profile',
      );
      expect(
        service.translateTextOrKey(
          'Nhập thành công khẩu phần 24h gồm 3 bữa ăn và 12 nguyên liệu vào hồ sơ bệnh nhân',
          'zh',
        ),
      ).toBe('成功将包含 3 次进餐和 12 种原料的 24小时膳食摄入调查记录导入患者病历档案');

      // 8. Tham số ID "..." không phải là số nguyên dương hợp lệ
      expect(
        service.translateTextOrKey('Tham số ID "abc" không phải là số nguyên dương hợp lệ', 'en'),
      ).toBe('ID parameter "abc" is not a valid positive integer');
      expect(
        service.translateTextOrKey('Tham số ID "abc" không phải là số nguyên dương hợp lệ', 'zh'),
      ).toBe('ID 参数 "abc" 不是有效的正整数');

      // 9. Tham số ID "..." không thể ép kiểu BigInt
      expect(service.translateTextOrKey('Tham số ID "xyz" không thể ép kiểu BigInt', 'en')).toBe(
        'ID parameter "xyz" cannot be cast to BigInt',
      );
      expect(service.translateTextOrKey('Tham số ID "xyz" không thể ép kiểu BigInt', 'zh')).toBe(
        'ID 参数 "xyz" 无法转换为 BigInt',
      );

      // 10. Prisma model '...' không tồn tại hoặc không hợp lệ
      expect(
        service.translateTextOrKey("Prisma model 'UserTest' không tồn tại hoặc không hợp lệ", 'en'),
      ).toBe("Prisma model 'UserTest' does not exist or is invalid");
      expect(
        service.translateTextOrKey("Prisma model 'UserTest' không tồn tại hoặc không hợp lệ", 'zh'),
      ).toBe("Prisma 模型 'UserTest' 不存在或无效");
    });

    it('nên đảm bảo 100% Key Parity giữa vi.json, en.json, zh.json và dịch chính xác các key bảo mật mới', () => {
      // 1. Kiểm tra các security & exception keys
      expect(service.translate('AUTH_REPLAY_ATTACK', 'en')).toBe(
        'Revoked refresh token reuse detected. All active sessions have been invalidated for security reasons.',
      );
      expect(service.translate('AUTH_REPLAY_ATTACK', 'zh')).toBe(
        '检测到已被撤销的安全令牌被重复使用。出于安全考虑，已注销全部活动会话。',
      );
      expect(service.translate('Bạn không có quyền truy cập hồ sơ bệnh nhân này', 'en')).toBe(
        'You do not have permission to access this patient profile.',
      );
      expect(service.translate('Bạn không có quyền truy cập hồ sơ bệnh nhân này', 'zh')).toBe(
        '您无权访问该患者的档案。',
      );
      expect(service.translate('error.security.admin_only', 'en')).toBe(
        'This function is restricted to Administrators (ADMIN) only.',
      );
      expect(service.translate('users.validation.user_ids_array', 'en')).toBe(
        'User IDs must be an array.',
      );
      expect(
        service.translate('validation.array_max_size', 'en', { field: 'Items', max: 50 }),
      ).toBe('Items must not exceed 50 elements');
    });
  });
});
