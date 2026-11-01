import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  CreatePlanDto,
  UpdatePlanDto,
  SubscriptionApproveDto,
  SubscriptionRequestDto,
  PaymentDocRequestDto,
} from '../../src/modules/subscriptions/dto';
import { I18nService } from '../../src/core/i18n/i18n.service';

describe('Subscriptions Module DTO Validation & i18n Dot-Notation Keys', () => {
  let i18nService: I18nService;

  beforeAll(() => {
    i18nService = new I18nService();
  });

  describe('CreatePlanDto', () => {
    it('ném lỗi validation.subscriptions.plan_code_string khi ma_goi không phải string', async () => {
      const dto = plainToInstance(CreatePlanDto, {
        ma_goi: 12345,
      });
      const errors = await validate(dto);
      const codeError = errors.find((e) => e.property === 'ma_goi');
      expect(codeError).toBeDefined();
      const messages = Object.values(codeError?.constraints || {});
      expect(messages).toContain('validation.subscriptions.plan_code_string');

      // Parity across locales
      expect(i18nService.translate('validation.subscriptions.plan_code_string', 'vi')).toBe(
        'Mã gói cước phải là chuỗi ký tự',
      );
      expect(i18nService.translate('validation.subscriptions.plan_code_string', 'en')).toBe(
        'Package code must be a string',
      );
      expect(i18nService.translate('validation.subscriptions.plan_code_string', 'zh')).toBe(
        '套餐编码 必须是字符串',
      );
    });

    it('ném lỗi validation.subscriptions.plan_code_max_50 khi ma_goi vượt quá 50 ký tự', async () => {
      const dto = plainToInstance(CreatePlanDto, {
        ma_goi: 'A'.repeat(51),
      });
      const errors = await validate(dto);
      const codeError = errors.find((e) => e.property === 'ma_goi');
      expect(codeError).toBeDefined();
      const messages = Object.values(codeError?.constraints || {});
      expect(messages).toContain('validation.subscriptions.plan_code_max_50');
    });

    it('ném lỗi validation.subscriptions.plan_name_string khi ten_goi không phải string', async () => {
      const dto = plainToInstance(CreatePlanDto, {
        ten_goi: 12345,
      });
      const errors = await validate(dto);
      const nameError = errors.find((e) => e.property === 'ten_goi');
      expect(nameError).toBeDefined();
      const messages = Object.values(nameError?.constraints || {});
      expect(messages).toContain('validation.subscriptions.plan_name_string');
    });

    it('ném lỗi validation.subscriptions.duration_int khi so_ngay_su_dung không phải số nguyên', async () => {
      const dto = plainToInstance(CreatePlanDto, {
        so_ngay_su_dung: 12.5,
      });
      const errors = await validate(dto);
      const daysError = errors.find((e) => e.property === 'so_ngay_su_dung');
      expect(daysError).toBeDefined();
      const messages = Object.values(daysError?.constraints || {});
      expect(messages).toContain('validation.subscriptions.duration_int');
    });

    it('ném lỗi validation.subscriptions.duration_positive khi so_ngay_su_dung < 1', async () => {
      const dto = plainToInstance(CreatePlanDto, {
        so_ngay_su_dung: 0,
      });
      const errors = await validate(dto);
      const daysError = errors.find((e) => e.property === 'so_ngay_su_dung');
      expect(daysError).toBeDefined();
      const messages = Object.values(daysError?.constraints || {});
      expect(messages).toContain('validation.subscriptions.duration_positive');
    });

    it('ném lỗi validation.subscriptions.duration_max khi so_ngay_su_dung > 3650', async () => {
      const dto = plainToInstance(CreatePlanDto, {
        so_ngay_su_dung: 4000,
      });
      const errors = await validate(dto);
      const daysError = errors.find((e) => e.property === 'so_ngay_su_dung');
      expect(daysError).toBeDefined();
      const messages = Object.values(daysError?.constraints || {});
      expect(messages).toContain('validation.subscriptions.duration_max');
    });

    it('ném lỗi validation.subscriptions.price_min_0 khi giá tiền âm', async () => {
      const dto = plainToInstance(CreatePlanDto, {
        gia_tien: -500,
      });
      const errors = await validate(dto);
      const priceError = errors.find((e) => e.property === 'gia_tien');
      expect(priceError).toBeDefined();
      const messages = Object.values(priceError?.constraints || {});
      expect(messages).toContain('validation.subscriptions.price_min_0');
    });

    it('ném lỗi validation.subscriptions.price_max khi giá tiền vượt 1 tỷ VND', async () => {
      const dto = plainToInstance(CreatePlanDto, {
        gia_tien: 2000000000,
      });
      const errors = await validate(dto);
      const priceError = errors.find((e) => e.property === 'gia_tien');
      expect(priceError).toBeDefined();
      const messages = Object.values(priceError?.constraints || {});
      expect(messages).toContain('validation.subscriptions.price_max');
    });

    it('ném lỗi validation.subscriptions.desc_max khi mo_ta vượt 5000 ký tự', async () => {
      const dto = plainToInstance(CreatePlanDto, {
        mo_ta: 'X'.repeat(5001),
      });
      const errors = await validate(dto);
      const descError = errors.find((e) => e.property === 'mo_ta');
      expect(descError).toBeDefined();
      const messages = Object.values(descError?.constraints || {});
      expect(messages).toContain('validation.subscriptions.desc_max');
    });

    it('ném lỗi validation.subscriptions.status_string khi status không phải chuỗi', async () => {
      const dto = plainToInstance(CreatePlanDto, {
        status: 999,
      });
      const errors = await validate(dto);
      const statusError = errors.find((e) => e.property === 'status');
      expect(statusError).toBeDefined();
      const messages = Object.values(statusError?.constraints || {});
      expect(messages).toContain('validation.subscriptions.status_string');
    });
  });

  describe('UpdatePlanDto', () => {
    it('ném lỗi validation.subscriptions.plan_name_max_255 khi tên gói cước quá dài', async () => {
      const dto = plainToInstance(UpdatePlanDto, {
        name: 'T'.repeat(256),
      });
      const errors = await validate(dto);
      const nameError = errors.find((e) => e.property === 'name');
      expect(nameError).toBeDefined();
      const messages = Object.values(nameError?.constraints || {});
      expect(messages).toContain('validation.subscriptions.plan_name_max_255');
    });

    it('ném lỗi validation.subscriptions.status_max_50 khi trạng thái quá dài', async () => {
      const dto = plainToInstance(UpdatePlanDto, {
        trang_thai: 'S'.repeat(51),
      });
      const errors = await validate(dto);
      const statusError = errors.find((e) => e.property === 'trang_thai');
      expect(statusError).toBeDefined();
      const messages = Object.values(statusError?.constraints || {});
      expect(messages).toContain('validation.subscriptions.status_max_50');
    });
  });

  describe('SubscriptionApproveDto', () => {
    it('ném lỗi validation.subscriptions.note_max_500 khi ghi chú vượt quá 500 ký tự', async () => {
      const dto = plainToInstance(SubscriptionApproveDto, {
        note: 'N'.repeat(501),
      });
      const errors = await validate(dto);
      const noteError = errors.find((e) => e.property === 'note');
      expect(noteError).toBeDefined();
      const messages = Object.values(noteError?.constraints || {});
      expect(messages).toContain('validation.subscriptions.note_max_500');

      // Parity across locales
      expect(i18nService.translate('validation.subscriptions.note_max_500', 'vi')).toBe(
        'Ghi chú tối đa 500 ký tự',
      );
      expect(i18nService.translate('validation.subscriptions.note_max_500', 'en')).toBe(
        'Note must not exceed 500 characters',
      );
      expect(i18nService.translate('validation.subscriptions.note_max_500', 'zh')).toBe(
        '备注不能超过 500 个字符',
      );
    });

    it('ném lỗi validation.subscriptions.reject_reason_max_255 khi lý do từ chối quá dài', async () => {
      const dto = plainToInstance(SubscriptionApproveDto, {
        lyDoTuChoi: 'R'.repeat(256),
      });
      const errors = await validate(dto);
      const reasonError = errors.find((e) => e.property === 'lyDoTuChoi');
      expect(reasonError).toBeDefined();
      const messages = Object.values(reasonError?.constraints || {});
      expect(messages).toContain('validation.subscriptions.reject_reason_max_255');
    });
  });

  describe('PaymentDocRequestDto & SubscriptionRequestDto', () => {
    it('ném lỗi validation.subscriptions.external_link_safe_url khi URL không an toàn', async () => {
      const doc = plainToInstance(PaymentDocRequestDto, {
        externalLink: 'ftp://insecure.com/doc.pdf',
      });
      const errors = await validate(doc);
      const linkError = errors.find((e) => e.property === 'externalLink');
      expect(linkError).toBeDefined();
      const messages = Object.values(linkError?.constraints || {});
      expect(messages).toContain('validation.subscriptions.external_link_safe_url');

      // Parity across locales
      expect(i18nService.translate('validation.subscriptions.external_link_safe_url', 'vi')).toBe(
        'externalLink chỉ chấp nhận URL an toàn bắt đầu bằng http:// hoặc https://',
      );
      expect(i18nService.translate('validation.subscriptions.external_link_safe_url', 'en')).toBe(
        'externalLink only accepts secure URLs starting with http:// or https://',
      );
      expect(i18nService.translate('validation.subscriptions.external_link_safe_url', 'zh')).toBe(
        'externalLink 仅接受以 http:// 或 https:// 开头的安全网址',
      );
    });

    it('ném lỗi validation.subscriptions.documents_max_10 khi vượt quá 10 chứng từ', async () => {
      const docs = Array(11).fill({ objectKey: 'receipt.png' });
      const dto = plainToInstance(SubscriptionRequestDto, {
        packageCode: 'PRO_1M',
        documents: docs,
      });
      const errors = await validate(dto);
      const docsError = errors.find((e) => e.property === 'documents');
      expect(docsError).toBeDefined();
      const messages = Object.values(docsError?.constraints || {});
      expect(messages).toContain('validation.subscriptions.documents_max_10');
    });
  });
});
