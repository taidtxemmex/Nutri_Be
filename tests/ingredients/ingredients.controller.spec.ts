import { HttpStatus, HttpException } from '@nestjs/common';
import { IngredientsController } from '../../src/modules/ingredients/controllers/ingredients.controller';
import { UserRole } from '../../src/config/enums/role.enum';

describe('IngredientsController', () => {
  let controller: IngredientsController;
  let mockIngredientsService: any;
  let mockExcelService: any;

  beforeEach(() => {
    mockIngredientsService = {
      findAll: jest.fn().mockResolvedValue({
        items: [{ id: '1', ten_nguyen_lieu: 'Gạo tẻ', material: 'Gạo tẻ' }],
        total: 1,
        page: 1,
        limit: 20,
      }),
      findSummary: jest
        .fn()
        .mockResolvedValue([{ id: '1', ten_nguyen_lieu: 'Gạo tẻ', material: 'Gạo tẻ' }]),
      findAllUnpaginated: jest
        .fn()
        .mockResolvedValue([{ id: '1', ten_nguyen_lieu: 'Gạo tẻ', material: 'Gạo tẻ' }]),
      findById: jest.fn().mockResolvedValue({
        id: '1',
        ten_nguyen_lieu: 'Gạo tẻ',
        material: 'Gạo tẻ',
      }),
      create: jest.fn().mockResolvedValue({
        id: '1',
        ten_nguyen_lieu: 'Gạo tẻ',
        trang_thai: 'CHO_DUYET',
      }),
      update: jest.fn().mockResolvedValue({
        id: '1',
        ten_nguyen_lieu: 'Gạo tẻ',
        trang_thai: 'DA_DUYET',
      }),
      delete: jest.fn().mockResolvedValue({
        message: 'Đã xóa nguyên liệu thành công (ID: 1)',
      }),
      approve: jest.fn().mockResolvedValue({
        id: '1',
        trang_thai: 'DA_DUYET',
      }),
    };

    mockExcelService = {
      generateTemplate: jest.fn().mockResolvedValue(Buffer.from('fake-template')),
      exportIngredients: jest.fn().mockResolvedValue(Buffer.from('fake-export')),
      importExcel: jest.fn().mockResolvedValue({
        success: true,
        totalImported: 5,
        message: 'Import thành công',
      }),
    };

    controller = new IngredientsController(mockIngredientsService, mockExcelService);
  });

  describe('findSummary', () => {
    it('should return summary items directly', async () => {
      const result = await controller.findSummary();
      expect(result).toHaveLength(1);
      expect(mockIngredientsService.findSummary).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should pass query params to service', async () => {
      const query = { page: 1, limit: 10, keyword: 'gạo' };
      const result = await controller.findAll(query);
      expect(result.items).toHaveLength(1);
      expect(mockIngredientsService.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('findAllUnpaginated', () => {
    it('should return full unpaginated list', async () => {
      const result = await controller.findAllUnpaginated();
      expect(result).toHaveLength(1);
      expect(mockIngredientsService.findAllUnpaginated).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should return ingredient detail by id', async () => {
      const result = await controller.findById('1');
      expect(result.id).toBe('1');
      expect(mockIngredientsService.findById).toHaveBeenCalledWith('1');
    });
  });

  describe('create', () => {
    it('should pass DTO and current user to service', async () => {
      const dto = { material: 'Gạo nếp' };
      const user = { id: 'u1', role: UserRole.USER };
      const result = await controller.create(dto, user);
      expect(result.trang_thai).toBe('CHO_DUYET');
      expect(mockIngredientsService.create).toHaveBeenCalledWith(dto, user);
    });
  });

  describe('update', () => {
    it('should pass id, DTO, and current user to service', async () => {
      const dto = { material: 'Gạo tẻ thơm' };
      const user = { id: 'u1', role: UserRole.ADMIN };
      const result = await controller.update('1', dto, user);
      expect(result.trang_thai).toBe('DA_DUYET');
      expect(mockIngredientsService.update).toHaveBeenCalledWith('1', dto, user);
    });
  });

  describe('delete', () => {
    it('should call delete on service', async () => {
      const result = await controller.delete('1');
      expect(result.message).toContain('Đã xóa nguyên liệu thành công');
      expect(mockIngredientsService.delete).toHaveBeenCalledWith('1');
    });
  });

  describe('approvePending', () => {
    it('should call approve on service', async () => {
      const result = await controller.approvePending('1');
      expect(result.trang_thai).toBe('DA_DUYET');
      expect(mockIngredientsService.approve).toHaveBeenCalledWith('1');
    });
  });

  describe('downloadTemplate', () => {
    it('should set headers and stream template buffer to response', async () => {
      const res: any = {
        setHeader: jest.fn(),
        end: jest.fn(),
      };
      await controller.downloadTemplate(undefined, res);
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="ingredient_template.xlsx"',
      );
      expect(res.end).toHaveBeenCalledWith(Buffer.from('fake-template'));
    });
  });

  describe('exportIngredients', () => {
    it('should set headers and stream export buffer to response', async () => {
      const res: any = {
        setHeader: jest.fn(),
        end: jest.fn(),
      };
      await controller.exportIngredients({}, res);
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="danh_sach_nguyen_lieu.xlsx"',
      );
      expect(res.end).toHaveBeenCalledWith(Buffer.from('fake-export'));
    });
  });

  describe('importExcel', () => {
    it('should throw FILE_REQUIRED if no file provided', async () => {
      const res: any = {};
      try {
        await controller.importExcel(null as any, { id: 'admin-1' }, res);
        fail('Should have thrown FILE_REQUIRED');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        expect(err.getResponse().code).toBe('FILE_REQUIRED');
      }
    });

    it('should stream error Excel file if import had row errors', async () => {
      mockExcelService.importExcel.mockResolvedValue({
        success: false,
        errorFileName: 'errors.xlsx',
        errorFileBuffer: Buffer.from('fake-error-file'),
      });

      const res: any = {
        setHeader: jest.fn(),
        end: jest.fn(),
      };
      const file: any = { buffer: Buffer.from('upload') };

      await controller.importExcel(file, { id: 'admin-1' }, res);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="errors.xlsx"',
      );
      expect(res.end).toHaveBeenCalledWith(Buffer.from('fake-error-file'));
    });

    it('should return JSON response if import succeeded', async () => {
      mockExcelService.importExcel.mockResolvedValue({
        success: true,
        totalImported: 10,
        message: 'Import thành công 10 nguyên liệu',
      });

      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const file: any = { buffer: Buffer.from('upload') };

      await controller.importExcel(file, { id: 'admin-1' }, res);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 200,
          message: 'Import thành công 10 nguyên liệu',
        }),
      );
    });
  });

  describe('POST /calculate-summary', () => {
    it('should delegate to ingredientsService.calculateSummary and return result', async () => {
      const dto = {
        items: [{ ingredientId: 1, weight: 100, isNetWeight: true, coefficient: 1 }],
      };
      const mockSummary = {
        totalGrossWeight: 100,
        totalEdibleWeight: 100,
        totalCookedWeight: 100,
        nutrients: { energy: 350, protein: 8, carbohydrate: 76 },
        items: [
          {
            ingredientId: 1,
            name: 'Gạo tẻ',
            ten_nguyen_lieu: 'Gạo tẻ',
            grossWeight: 100,
            edibleWeight: 100,
            cookedWeight: 100,
            coefficient: 1,
            isNetWeight: true,
            nutrients: { energy: 350, protein: 8, carbohydrate: 76 },
          },
        ],
      };
      mockIngredientsService.calculateSummary = jest.fn().mockResolvedValue(mockSummary);

      const result = await controller.calculateSummary(dto as any);

      expect(mockIngredientsService.calculateSummary).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockSummary);
    });
  });
});
