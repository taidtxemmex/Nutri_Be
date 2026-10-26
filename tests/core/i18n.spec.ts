import { I18nService } from '../../src/core/i18n/i18n.service';

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
});
