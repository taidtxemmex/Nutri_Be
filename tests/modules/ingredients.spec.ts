import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateIngredientDto } from '../../src/modules/ingredients/dto/create-ingredient.dto';
import {
  CalculateSummaryDto,
  CalculateSummaryItemDto,
} from '../../src/modules/ingredients/dto/calculate-summary.dto';
import { ExportIngredientDto } from '../../src/modules/ingredients/dto/export-ingredient.dto';
import { IngredientQueryDto } from '../../src/modules/ingredients/dto/ingredient-query.dto';
import { CreateCategoryDto } from '../../src/modules/categories/dto/create-category.dto';
import { UpdateCategoryDto } from '../../src/modules/categories/dto/update-category.dto';
import { CreateDiseaseGroupDto } from '../../src/modules/disease-groups/dto/create-disease-group.dto';
import { UpdateDiseaseGroupDto } from '../../src/modules/disease-groups/dto/update-disease-group.dto';
import { I18nService } from '../../src/core/i18n/i18n.service';

describe('Ingredients, Categories & Disease Groups DTO i18n Validation Tests', () => {
  let i18nService: I18nService;

  beforeAll(() => {
    i18nService = new I18nService();
  });

  describe('CreateIngredientDto validation keys', () => {
    it('should fail with validation.ingredients.name_required when material is empty', async () => {
      const dto = plainToInstance(CreateIngredientDto, {
        material: '',
        name: '',
      });
      const errors = await validate(dto);
      const materialError = errors.find((e) => e.property === 'material');
      expect(materialError).toBeDefined();
      expect(materialError?.constraints).toHaveProperty('isNotEmpty');
      expect(materialError?.constraints?.isNotEmpty).toBe('validation.ingredients.name_required');

      // Verify translation in all locales
      expect(i18nService.hasKey('validation.ingredients.name_required')).toBe(true);
      expect(i18nService.translate('validation.ingredients.name_required', 'vi')).toBe(
        'Tên nguyên liệu không được để trống.',
      );
      expect(i18nService.translate('validation.ingredients.name_required', 'en')).toBe(
        'Ingredient name cannot be empty.',
      );
      expect(i18nService.translate('validation.ingredients.name_required', 'zh')).toBe(
        '原料名称不能为空。',
      );
    });

    it('should fail with validation.ingredients.category_id_min when categoryId is less than 1', async () => {
      const dto = plainToInstance(CreateIngredientDto, {
        material: 'Gạo lứt',
        categoryId: 0,
      });
      const errors = await validate(dto);
      const catError = errors.find((e) => e.property === 'categoryId');
      expect(catError).toBeDefined();
      expect(catError?.constraints?.min).toBe('validation.ingredients.category_id_min');
      expect(i18nService.hasKey('validation.ingredients.category_id_min')).toBe(true);
    });

    it('should fail with validation.ingredients.edible_max when edible exceeds 100', async () => {
      const dto = plainToInstance(CreateIngredientDto, {
        material: 'Thịt bò phi lê',
        edible: 150,
      });
      const errors = await validate(dto);
      const edibleError = errors.find((e) => e.property === 'edible');
      expect(edibleError).toBeDefined();
      expect(edibleError?.constraints?.max).toBe('validation.ingredients.edible_max');
      expect(i18nService.hasKey('validation.ingredients.edible_max')).toBe(true);
    });
  });

  describe('CalculateSummaryDto & CalculateSummaryItemDto validation keys', () => {
    it('should fail with validation.ingredients.weight_max when weight exceeds 10000', async () => {
      const itemDto = plainToInstance(CalculateSummaryItemDto, {
        ingredientId: 1,
        weight: 15000,
      });
      const errors = await validate(itemDto);
      const weightError = errors.find((e) => e.property === 'weight');
      expect(weightError).toBeDefined();
      expect(weightError?.constraints?.max).toBe('validation.ingredients.weight_max');
      expect(i18nService.hasKey('validation.ingredients.weight_max')).toBe(true);
    });

    it('should fail with validation.ingredients.coefficient_max when coefficient exceeds 10', async () => {
      const itemDto = plainToInstance(CalculateSummaryItemDto, {
        ingredientId: 1,
        weight: 100,
        coefficient: 25,
      });
      const errors = await validate(itemDto);
      const coeffError = errors.find((e) => e.property === 'coefficient');
      expect(coeffError).toBeDefined();
      expect(coeffError?.constraints?.max).toBe('validation.ingredients.coefficient_max');
      expect(i18nService.hasKey('validation.ingredients.coefficient_max')).toBe(true);
    });

    it('should fail with validation.ingredients.items_min_size when items array is empty', async () => {
      const summaryDto = plainToInstance(CalculateSummaryDto, {
        items: [],
      });
      const errors = await validate(summaryDto);
      const itemsError = errors.find((e) => e.property === 'items');
      expect(itemsError).toBeDefined();
      expect(itemsError?.constraints?.arrayMinSize).toBe('validation.ingredients.items_min_size');
      expect(i18nService.hasKey('validation.ingredients.items_min_size')).toBe(true);
    });
  });

  describe('ExportIngredientDto & IngredientQueryDto validation keys', () => {
    it('should fail with validation.ingredients.search_max when search keyword exceeds 255 chars', async () => {
      const queryDto = plainToInstance(IngredientQueryDto, {
        keyword: 'a'.repeat(300),
      });
      const errors = await validate(queryDto);
      const searchError = errors.find((e) => e.property === 'keyword');
      expect(searchError).toBeDefined();
      expect(searchError?.constraints?.maxLength).toBe('validation.ingredients.search_max');
      expect(i18nService.hasKey('validation.ingredients.search_max')).toBe(true);
    });

    it('should fail with validation.ingredients.export_columns_max when columns exceed 100', async () => {
      const exportDto = plainToInstance(ExportIngredientDto, {
        columns: Array.from({ length: 105 }, (_, i) => `col_${i}`),
      });
      const errors = await validate(exportDto);
      const colError = errors.find((e) => e.property === 'columns');
      expect(colError).toBeDefined();
      expect(colError?.constraints?.arrayMaxSize).toBe('validation.ingredients.export_columns_max');
      expect(i18nService.hasKey('validation.ingredients.export_columns_max')).toBe(true);
    });
  });

  describe('CreateCategoryDto & UpdateCategoryDto validation keys', () => {
    it('should fail with validation.categories.code_max when categoryCode exceeds 50 chars', async () => {
      const dto = plainToInstance(CreateCategoryDto, {
        categoryCode: 'C'.repeat(60),
      });
      const errors = await validate(dto);
      const codeError = errors.find((e) => e.property === 'categoryCode');
      expect(codeError).toBeDefined();
      expect(codeError?.constraints?.maxLength).toBe('validation.categories.code_max');
      expect(i18nService.hasKey('validation.categories.code_max')).toBe(true);
      expect(i18nService.translate('validation.categories.code_max', 'vi')).toBe(
        'Mã danh mục tối đa 50 ký tự.',
      );
    });

    it('should fail with validation.categories.desc_max when description exceeds 5000 chars', async () => {
      const dto = plainToInstance(UpdateCategoryDto, {
        description: 'd'.repeat(5500),
      });
      const errors = await validate(dto);
      const descError = errors.find((e) => e.property === 'description');
      expect(descError).toBeDefined();
      expect(descError?.constraints?.maxLength).toBe('validation.categories.desc_max');
      expect(i18nService.hasKey('validation.categories.desc_max')).toBe(true);
    });
  });

  describe('CreateDiseaseGroupDto & UpdateDiseaseGroupDto validation keys', () => {
    it('should fail with validation.disease_groups.code_max_10 when code exceeds 10 chars', async () => {
      const dto = plainToInstance(CreateDiseaseGroupDto, {
        code: 'TOOLONGCODE123',
      });
      const errors = await validate(dto);
      const codeError = errors.find((e) => e.property === 'code');
      expect(codeError).toBeDefined();
      expect(codeError?.constraints?.maxLength).toBe('validation.disease_groups.code_max_10');
      expect(i18nService.hasKey('validation.disease_groups.code_max_10')).toBe(true);
    });

    it('should fail with validation.disease_groups.name_max when name exceeds 255 chars', async () => {
      const dto = plainToInstance(UpdateDiseaseGroupDto, {
        name: 'n'.repeat(300),
      });
      const errors = await validate(dto);
      const nameError = errors.find((e) => e.property === 'name');
      expect(nameError).toBeDefined();
      expect(nameError?.constraints?.maxLength).toBe('validation.disease_groups.name_max');
      expect(i18nService.hasKey('validation.disease_groups.name_max')).toBe(true);
    });
  });
});
