import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateIngredientProposalDto } from '../../src/modules/ingredient-proposals/dto/create-ingredient-proposal.dto';
import { RejectIngredientProposalDto } from '../../src/modules/ingredient-proposals/dto/reject-ingredient-proposal.dto';
import {
  ExportProposalExcelDto,
  RejectProposalDto,
  MenuProposalQueryDto,
} from '../../src/modules/menu-proposals/dto/menu-proposal.dto';
import { CreateProposerDto } from '../../src/modules/proposers/dto/create-proposer.dto';
import { UpdateProposerDto } from '../../src/modules/proposers/dto/update-proposer.dto';
import { I18nService } from '../../src/core/i18n/i18n.service';

describe('Proposals & Proposers DTO i18n Validation Tests', () => {
  let i18nService: I18nService;

  beforeAll(() => {
    i18nService = new I18nService();
  });

  describe('CreateIngredientProposalDto validation keys', () => {
    it('should fail with validation.ingredient_proposals.ingredient_name_required when name is empty', async () => {
      const dto = plainToInstance(CreateIngredientProposalDto, {
        ingredientName: '',
        categoryId: 1,
      });
      const errors = await validate(dto);
      const nameError = errors.find((e) => e.property === 'ingredientName');
      expect(nameError).toBeDefined();
      expect(nameError?.constraints?.isNotEmpty).toBe(
        'validation.ingredient_proposals.ingredient_name_required',
      );

      // Verify i18n translations
      expect(i18nService.hasKey('validation.ingredient_proposals.ingredient_name_required')).toBe(
        true,
      );
      expect(
        i18nService.translate('validation.ingredient_proposals.ingredient_name_required', 'vi'),
      ).toBe('Tên nguyên liệu không được để trống.');
      expect(
        i18nService.translate('validation.ingredient_proposals.ingredient_name_required', 'en'),
      ).toBe('Ingredient name cannot be empty.');
      expect(
        i18nService.translate('validation.ingredient_proposals.ingredient_name_required', 'zh'),
      ).toBe('原料名称不能为空。');
    });

    it('should fail with validation.proposals.note_max when note exceeds 2000 chars', async () => {
      const dto = plainToInstance(CreateIngredientProposalDto, {
        ingredientName: 'Sữa ngũ cốc yến mạch',
        categoryId: 1,
        note: 'x'.repeat(2500),
      });
      const errors = await validate(dto);
      const noteError = errors.find((e) => e.property === 'note');
      expect(noteError).toBeDefined();
      expect(noteError?.constraints?.maxLength).toBe('validation.proposals.note_max');
      expect(i18nService.hasKey('validation.proposals.note_max')).toBe(true);
      expect(i18nService.translate('validation.proposals.note_max', 'vi')).toBe(
        'Ghi chú tối đa 2000 ký tự.',
      );
      expect(i18nService.translate('validation.proposals.note_max', 'en')).toBe(
        'Note cannot exceed 2000 characters.',
      );
      expect(i18nService.translate('validation.proposals.note_max', 'zh')).toBe(
        '备注最多 2000 个字符。',
      );
    });

    it('should fail with validation.ingredient_proposals.category_id_min when categoryId is 0', async () => {
      const dto = plainToInstance(CreateIngredientProposalDto, {
        ingredientName: 'Đậu phụ non',
        categoryId: 0,
      });
      const errors = await validate(dto);
      const catError = errors.find((e) => e.property === 'categoryId');
      expect(catError).toBeDefined();
      expect(catError?.constraints?.min).toBe('validation.ingredient_proposals.category_id_min');
      expect(i18nService.hasKey('validation.ingredient_proposals.category_id_min')).toBe(true);
    });
  });

  describe('RejectIngredientProposalDto & RejectProposalDto validation keys', () => {
    it('should fail with validation.ingredient_proposals.reject_reason_max when reason exceeds 500 chars', async () => {
      const dto = plainToInstance(RejectIngredientProposalDto, {
        reason: 'r'.repeat(600),
      });
      const errors = await validate(dto);
      const reasonError = errors.find((e) => e.property === 'reason');
      expect(reasonError).toBeDefined();
      expect(reasonError?.constraints?.maxLength).toBe(
        'validation.ingredient_proposals.reject_reason_max',
      );
      expect(i18nService.hasKey('validation.ingredient_proposals.reject_reason_max')).toBe(true);
    });

    it('should fail with validation.menu_proposals.reject_reason_max when rejectReason exceeds 500 chars', async () => {
      const dto = plainToInstance(RejectProposalDto, {
        rejectReason: 'k'.repeat(700),
      });
      const errors = await validate(dto);
      const reasonError = errors.find((e) => e.property === 'rejectReason');
      expect(reasonError).toBeDefined();
      expect(reasonError?.constraints?.maxLength).toBe(
        'validation.menu_proposals.reject_reason_max',
      );
      expect(i18nService.hasKey('validation.menu_proposals.reject_reason_max')).toBe(true);
    });
  });

  describe('ExportProposalExcelDto & MenuProposalQueryDto validation keys', () => {
    it('should fail with validation.menu_proposals.nutrient_codes_max when columns exceed 100', async () => {
      const dto = plainToInstance(ExportProposalExcelDto, {
        columns: Array.from({ length: 110 }, (_, i) => `nut_${i}`),
      });
      const errors = await validate(dto);
      const colError = errors.find((e) => e.property === 'columns');
      expect(colError).toBeDefined();
      expect(colError?.constraints?.arrayMaxSize).toBe(
        'validation.menu_proposals.nutrient_codes_max',
      );
      expect(i18nService.hasKey('validation.menu_proposals.nutrient_codes_max')).toBe(true);
    });

    it('should fail with validation.menu_proposals.statuses_max when statuses exceed 100 chars', async () => {
      const dto = plainToInstance(MenuProposalQueryDto, {
        statuses: 's'.repeat(120),
      });
      const errors = await validate(dto);
      const statusError = errors.find((e) => e.property === 'statuses');
      expect(statusError).toBeDefined();
      expect(statusError?.constraints?.maxLength).toBe('validation.menu_proposals.statuses_max');
      expect(i18nService.hasKey('validation.menu_proposals.statuses_max')).toBe(true);
    });
  });

  describe('CreateProposerDto & UpdateProposerDto validation keys', () => {
    it('should fail with validation.proposers.education_level_max when education exceeds 100 chars', async () => {
      const dto = plainToInstance(CreateProposerDto, {
        education: 'e'.repeat(120),
      });
      const errors = await validate(dto);
      const eduError = errors.find((e) => e.property === 'education');
      expect(eduError).toBeDefined();
      expect(eduError?.constraints?.maxLength).toBe('validation.proposers.education_level_max');
      expect(i18nService.hasKey('validation.proposers.education_level_max')).toBe(true);
    });

    it('should fail with validation.proposers.workplace_max when workplace exceeds 255 chars', async () => {
      const dto = plainToInstance(UpdateProposerDto, {
        unit: 'u'.repeat(300),
      });
      const errors = await validate(dto);
      const unitError = errors.find((e) => e.property === 'unit');
      expect(unitError).toBeDefined();
      expect(unitError?.constraints?.maxLength).toBe('validation.proposers.workplace_max');
      expect(i18nService.hasKey('validation.proposers.workplace_max')).toBe(true);
    });
  });
});
