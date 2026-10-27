import { CoefficientsController } from '../../src/modules/coefficients/controllers/coefficients.controller';
import { CoefficientsService } from '../../src/modules/coefficients/services/coefficients.service';

describe('CoefficientsController', () => {
  let controller: CoefficientsController;
  let service: CoefficientsService;

  beforeEach(() => {
    service = {
      create: jest.fn().mockResolvedValue({ id: '1', coefficient: 0.85 }),
      findAll: jest.fn().mockResolvedValue([{ id: '1', coefficient: 0.85 }]),
      findPublic: jest.fn().mockResolvedValue([{ id: '1', isPublic: true }]),
      findMy: jest.fn().mockResolvedValue([{ id: '2', isPublic: false }]),
      findById: jest.fn().mockResolvedValue({ id: '1', coefficient: 0.85 }),
      update: jest.fn().mockResolvedValue({ id: '1', coefficient: 0.9 }),
      delete: jest.fn().mockResolvedValue({ message: 'Xóa hệ số thành công' }),
    } as any;

    controller = new CoefficientsController(service);
  });

  it('should call create and return result', async () => {
    const res = await controller.create(
      { ingredientId: 1, processingMethod: 'Luộc', coefficient: 0.85 },
      { id: 'u1' },
    );
    expect(res).toEqual({ id: '1', coefficient: 0.85 });
    expect(service.create).toHaveBeenCalled();
  });

  it('should call getPublic and return public coefficients', async () => {
    const res = await controller.getPublic();
    expect(res).toEqual([{ id: '1', isPublic: true }]);
    expect(service.findPublic).toHaveBeenCalled();
  });

  it('should call getMy and return user coefficients', async () => {
    const res = await controller.getMy({ id: 'u1' });
    expect(res).toEqual([{ id: '2', isPublic: false }]);
    expect(service.findMy).toHaveBeenCalledWith({ id: 'u1' });
  });
});
