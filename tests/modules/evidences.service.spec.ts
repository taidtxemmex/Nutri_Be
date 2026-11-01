import { HttpStatus } from '@nestjs/common';
import { EvidencesService } from '../../src/modules/evidences/services/evidences.service';
import { EvidenceStorageService } from '../../src/modules/evidences/services/evidence-storage.service';
import { UserRole } from '../../src/config/enums/role.enum';

describe('EvidencesService', () => {
  let service: EvidencesService;
  let mockPrisma: any;
  let mockStorageService: EvidenceStorageService;

  beforeEach(() => {
    mockPrisma = {
      minh_chung: {
        findUnique: jest.fn(),
      },
    };

    mockStorageService = {
      generatePreviewUrl: jest
        .fn()
        .mockImplementation(({ objectKey }) =>
          Promise.resolve(`http://localhost:8080/uploads/evidence/${objectKey}?token=mock`),
        ),
      generateDownloadUrl: jest
        .fn()
        .mockImplementation(({ objectKey }) =>
          Promise.resolve(
            `http://localhost:8080/uploads/evidence/${objectKey}?token=mock&download=1`,
          ),
        ),
    } as any;

    service = new EvidencesService(mockPrisma, mockStorageService);
  });

  describe('generatePreviewUrl', () => {
    it('should throw EVID_001 if evidence not found', async () => {
      mockPrisma.minh_chung.findUnique.mockResolvedValue(null);

      await expect(
        service.generatePreviewUrl({ id: 999, currentUser: { id: 'user-1' } }),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'EVID_001' }),
          status: HttpStatus.NOT_FOUND,
        }),
      );
    });

    it('should throw AUTH_002 if user is neither admin nor owner of evidence/proposal/payment', async () => {
      mockPrisma.minh_chung.findUnique.mockResolvedValue({
        id: BigInt(1),
        nguoi_upload_id: 'other-user',
        de_xuat_nguyen_lieu: { nguoi_tao_id: 'other-user' },
        yeu_cau_thanh_toan: null,
      });

      await expect(
        service.generatePreviewUrl({ id: 1, currentUser: { id: 'user-1', role: UserRole.USER } }),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'AUTH_002' }),
          status: HttpStatus.FORBIDDEN,
        }),
      );
    });

    it('should generate preview URL for owner', async () => {
      mockPrisma.minh_chung.findUnique.mockResolvedValue({
        id: BigInt(1),
        object_key: 'medical-doc-123.pdf',
        nguoi_upload_id: 'user-1',
        dung_luong: BigInt(500000),
      });

      const url = await service.generatePreviewUrl({
        id: 1,
        currentUser: { id: 'user-1', role: UserRole.USER },
      });
      expect(url).toContain('medical-doc-123.pdf');
      expect(mockStorageService.generatePreviewUrl).toHaveBeenCalledWith({
        objectKey: 'medical-doc-123.pdf',
      });
    });

    it('should return external link directly if available and no object_key', async () => {
      mockPrisma.minh_chung.findUnique.mockResolvedValue({
        id: BigInt(2),
        link_ngoai: 'https://cdn.example.com/certificate.pdf',
        object_key: null,
        nguoi_upload_id: 'user-1',
      });

      const url = await service.generatePreviewUrl({
        id: 2,
        currentUser: { id: 'user-1', role: UserRole.USER },
      });
      expect(url).toBe('https://cdn.example.com/certificate.pdf');
    });
  });

  describe('generateDownloadUrl', () => {
    it('should generate download URL for admin', async () => {
      mockPrisma.minh_chung.findUnique.mockResolvedValue({
        id: BigInt(1),
        object_key: 'medical-doc-123.pdf',
        ten_file_goc: 'giay_kham.pdf',
        nguoi_upload_id: 'someone-else',
      });

      const url = await service.generateDownloadUrl({
        id: 1,
        currentUser: { id: 'admin-1', role: UserRole.ADMIN },
      });
      expect(url).toContain('medical-doc-123.pdf');
      expect(mockStorageService.generateDownloadUrl).toHaveBeenCalledWith({
        objectKey: 'medical-doc-123.pdf',
        originalFileName: 'giay_kham.pdf',
      });
    });
  });
});
