import { DishesController } from '../../src/modules/dishes/controllers/dishes.controller';
import { DishesService } from '../../src/modules/dishes/services/dishes.service';
import { DishExcelService } from '../../src/modules/dishes/services/dish-excel.service';

describe('DishesController', () => {
  let controller: DishesController;
  let service: DishesService;
  let excelService: DishExcelService;

  beforeEach(() => {
    service = {
      create: jest.fn().mockResolvedValue({ id: '1', name: 'Món 1' }),
      getUserDishes: jest.fn().mockResolvedValue([{ id: '1', name: 'Món 1' }]),
      getPublicDishes: jest.fn().mockResolvedValue([{ id: '2', name: 'Món 2' }]),
      getAdminDishes: jest.fn().mockResolvedValue([{ id: '3', name: 'Món 3' }]),
      autocomplete: jest.fn().mockResolvedValue([{ id: '1', name: 'Thịt kho' }]),
      findById: jest.fn().mockResolvedValue({ id: '1', name: 'Món 1' }),
      update: jest.fn().mockResolvedValue({ id: '1', name: 'Món 1 updated' }),
      cloneDish: jest.fn().mockResolvedValue({ id: '4', originalDishId: '1', name: 'Món clone' }),
      proposeDish: jest.fn().mockResolvedValue({ message: 'Đã gửi đề xuất' }),
      approveDish: jest.fn().mockResolvedValue({ message: 'Đã duyệt' }),
      rejectDish: jest.fn().mockResolvedValue({ message: 'Đã từ chối đề xuất' }),
      delete: jest.fn().mockResolvedValue({ message: 'Xoá thành công món ăn' }),
    } as any;

    excelService = {
      generateTemplate: jest.fn().mockResolvedValue(Buffer.from('')),
      importExcel: jest.fn().mockResolvedValue({ success: true, importedCount: 1 }),
      exportDishes: jest.fn().mockResolvedValue(Buffer.from('')),
    } as any;

    controller = new DishesController(service, excelService);
  });

  it('create should call service.create', async () => {
    const res = await controller.create(
      { name: 'Món 1', details: [{ ingredientId: 1, netWeight: 100 }] },
      { id: 'u1' },
    );
    expect(res).toEqual({ id: '1', name: 'Món 1' });
    expect(service.create).toHaveBeenCalled();
  });

  it('getUserDishes should call service.getUserDishes', async () => {
    const res = await controller.getUserDishes('RIENG_TU', { id: 'u1' });
    expect(res).toHaveLength(1);
    expect(service.getUserDishes).toHaveBeenCalledWith('RIENG_TU', { id: 'u1' });
  });

  it('proposeDish should call service.proposeDish', async () => {
    const res = await controller.proposeDish('1', { id: 'u1' });
    expect(res.message).toBe('Đã gửi đề xuất');
    expect(service.proposeDish).toHaveBeenCalledWith('1', { id: 'u1' });
  });

  it('approveDish should call service.approveDish', async () => {
    const res = await controller.approveDish('1', { id: 'admin-1' });
    expect(res.message).toBe('Đã duyệt');
    expect(service.approveDish).toHaveBeenCalledWith('1', { id: 'admin-1' });
  });

  it('rejectDish should call service.rejectDish', async () => {
    const res = await controller.rejectDish('1', { reason: 'Lý do' }, { id: 'admin-1' });
    expect(res.message).toBe('Đã từ chối đề xuất');
    expect(service.rejectDish).toHaveBeenCalledWith('1', 'Lý do', { id: 'admin-1' });
  });

  it('cloneDish should call service.cloneDish', async () => {
    const res = await controller.cloneDish('1', { newName: 'Món clone' }, { id: 'u1' });
    expect(res.id).toBe('4');
    expect(service.cloneDish).toHaveBeenCalledWith('1', { newName: 'Món clone' }, { id: 'u1' });
  });

  it('delete should call service.delete', async () => {
    const res = await controller.delete('1', { id: 'u1' });
    expect(res.message).toBe('Xoá thành công món ăn');
    expect(service.delete).toHaveBeenCalledWith('1', { id: 'u1' });
  });
});
