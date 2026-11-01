import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UploadEvidenceDto } from '../../../src/modules/files/dto/upload-evidence.dto';
import { I18nService } from '../../../src/core/i18n/i18n.service';

describe('Files Module DTO Validation & i18n Dot-Notation Keys', () => {
  let i18nService: I18nService;

  beforeAll(() => {
    i18nService = new I18nService();
  });

  describe('UploadEvidenceDto', () => {
    it('chấp nhận DTO hợp lệ', async () => {
      const dto = plainToInstance(UploadEvidenceDto, {
        proposalId: 'prop-123',
        paymentRequestId: 'pay-456',
        note: 'Kết quả xét nghiệm máu',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('ném lỗi maxLength khi proposalId hoặc paymentRequestId > 50 ký tự', async () => {
      const dto = plainToInstance(UploadEvidenceDto, {
        proposalId: 'a'.repeat(51),
        paymentRequestId: 'b'.repeat(51),
      });
      const errors = await validate(dto);

      const propError = errors.find((e) => e.property === 'proposalId');
      expect(propError).toBeDefined();
      expect(Object.values(propError?.constraints || {})).toContain(
        'validation.files.proposal_id_max',
      );

      const payError = errors.find((e) => e.property === 'paymentRequestId');
      expect(payError).toBeDefined();
      expect(Object.values(payError?.constraints || {})).toContain(
        'validation.files.payment_request_id_max',
      );

      // Parity across locales
      expect(i18nService.translate('validation.files.proposal_id_max', 'vi')).toBe(
        'ID đề xuất nguyên liệu tối đa 50 ký tự.',
      );
      expect(i18nService.translate('validation.files.proposal_id_max', 'en')).toBe(
        'Proposal ID cannot exceed 50 characters.',
      );
      expect(i18nService.translate('validation.files.proposal_id_max', 'zh')).toBe(
        '原料提议 ID 最多 50 个字符。',
      );
    });

    it('ném lỗi maxLength khi note > 500 ký tự', async () => {
      const dto = plainToInstance(UploadEvidenceDto, {
        note: 'n'.repeat(501),
      });
      const errors = await validate(dto);

      const noteError = errors.find((e) => e.property === 'note');
      expect(noteError).toBeDefined();
      expect(Object.values(noteError?.constraints || {})).toContain('validation.files.note_max');

      expect(i18nService.translate('validation.files.note_max', 'vi')).toBe(
        'Ghi chú tối đa 500 ký tự.',
      );
      expect(i18nService.translate('validation.files.note_max', 'en')).toBe(
        'Note cannot exceed 500 characters.',
      );
      expect(i18nService.translate('validation.files.note_max', 'zh')).toBe(
        '备注最多 500 个字符。',
      );
    });
  });
});
