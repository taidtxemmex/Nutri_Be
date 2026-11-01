import { MealsController } from '../../src/modules/meals/controllers/meals.controller';
import { MealsService } from '../../src/modules/meals/services/meals.service';

describe('MealsController', () => {
  let controller: MealsController;
  let service: MealsService;

  beforeEach(() => {
    service = {
      create: jest.fn().mockResolvedValue({ id: '1', mealName: 'Bữa sáng' }),
      findAll: jest.fn().mockResolvedValue([{ id: '1', mealName: 'Bữa sáng' }]),
      findById: jest.fn().mockResolvedValue({ id: '1', mealName: 'Bữa sáng' }),
      update: jest.fn().mockResolvedValue({ id: '1', mealName: 'Bữa sáng updated' }),
      delete: jest.fn().mockResolvedValue({ message: 'Xóa thành công' }),
    } as any;

    controller = new MealsController(service);
  });

  it('create should call service.create', async () => {
    const res = await controller.create({ time: '07:00' }, { id: 'u1' });
    expect(res).toEqual({ id: '1', mealName: 'Bữa sáng' });
    expect(service.create).toHaveBeenCalledWith({
      dto: { time: '07:00' },
      currentUser: { id: 'u1' },
    });
  });

  it('getAll should call service.findAll', async () => {
    const res = await controller.getAll({ id: 'u1' });
    expect(res).toHaveLength(1);
    expect(service.findAll).toHaveBeenCalledWith({ currentUser: { id: 'u1' } });
  });

  it('getById should call service.findById', async () => {
    const res = await controller.getById('1', { id: 'u1' });
    expect(res.id).toBe('1');
    expect(service.findById).toHaveBeenCalledWith({ id: '1', currentUser: { id: 'u1' } });
  });

  it('update should call service.update', async () => {
    const res = await controller.update('1', { time: '07:30' }, { id: 'u1' });
    expect(res.mealName).toBe('Bữa sáng updated');
    expect(service.update).toHaveBeenCalledWith({
      id: '1',
      dto: { time: '07:30' },
      currentUser: { id: 'u1' },
    });
  });

  it('delete should call service.delete', async () => {
    (service.delete as any).mockResolvedValueOnce({ message: 'Xóa bữa ăn thành công' });
    const res = await controller.delete('1', { id: 'u1' });
    expect(res.message).toBe('Xóa bữa ăn thành công');
    expect(service.delete).toHaveBeenCalledWith({ id: '1', currentUser: { id: 'u1' } });
  });
});
