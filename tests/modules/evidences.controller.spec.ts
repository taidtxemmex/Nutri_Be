import { EvidencesController } from '../../src/modules/evidences/controllers/evidences.controller';
import { EvidencesService } from '../../src/modules/evidences/services/evidences.service';

describe('EvidencesController', () => {
  let controller: EvidencesController;
  let service: EvidencesService;

  beforeEach(() => {
    service = {
      generatePreviewUrl: jest.fn().mockResolvedValue('http://preview.url'),
      generateDownloadUrl: jest.fn().mockResolvedValue('http://download.url'),
    } as any;

    controller = new EvidencesController(service);
  });

  it('preview should return preview url', async () => {
    const res = await controller.preview('1', { id: 'u1' });
    expect(res).toBe('http://preview.url');
    expect(service.generatePreviewUrl).toHaveBeenCalledWith('1', { id: 'u1' });
  });

  it('download should return download url', async () => {
    const res = await controller.download('1', { id: 'u1' });
    expect(res).toBe('http://download.url');
    expect(service.generateDownloadUrl).toHaveBeenCalledWith('1', { id: 'u1' });
  });
});
