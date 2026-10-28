import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { FileMagicBytePipe } from '../../src/modules/files/pipes/file-magic-byte.pipe';
import { LocalStorageService } from '../../src/modules/files/services/local-storage.service';
import { FilesController } from '../../src/modules/files/controllers/files.controller';
import { PrismaService } from '../../src/core/database/prisma.service';

describe('FileStorageSecurity & MIME Spoofing Defense (Task 7.3 - CWE-434, CWE-22, CWE-113)', () => {
  // Test sandbox directories
  const testUploadDir = path.resolve(process.cwd(), 'uploads_test_sandbox');
  let configService: ConfigService;
  let storageService: LocalStorageService;
  let filePipe: FileMagicBytePipe;
  let prismaService: Partial<PrismaService>;
  let filesController: FilesController;

  // Real Magic Bytes buffers for testing
  const validJpegBuffer = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  ]);
  const validPngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  ]);
  const validPdfBuffer = Buffer.from([
    0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xd0, 0xd4,
  ]);
  const validWebpBuffer = Buffer.from([
    0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
  ]);
  const validGifBuffer = Buffer.from([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
  ]);

  beforeAll(() => {
    if (!fs.existsSync(testUploadDir)) {
      fs.mkdirSync(testUploadDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(testUploadDir)) {
      fs.rmSync(testUploadDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string, defaultVal?: string) => {
        if (key === 'UPLOAD_DIR') return testUploadDir;
        if (key === 'JWT_SECRET') return 'test_jwt_secret_hmac_key_for_testing_32chars';
        if (key === 'APP_URL') return 'http://localhost:8080';
        return defaultVal;
      }),
    } as unknown as ConfigService;

    storageService = new LocalStorageService(configService);
    filePipe = new FileMagicBytePipe();

    prismaService = {
      nguoi_dung: {
        findFirst: jest.fn().mockResolvedValue({ id: 'mock-user-uuid-1' }),
      } as any,
      minh_chung: {
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: BigInt(99),
            ...data,
          }),
        ),
      } as any,
      yeu_cau_thanh_toan: {
        findUnique: jest.fn().mockResolvedValue({ id: BigInt(20) }),
      } as any,
      de_xuat_nguyen_lieu: {
        findUnique: jest.fn().mockResolvedValue({ id: BigInt(10) }),
      } as any,
    };

    filesController = new FilesController(storageService, prismaService as PrismaService);
  });

  // =========================================================================
  // SUITE 1: FileMagicBytePipe (MIME Spoofing, Magic Bytes & Polyglot Defense)
  // =========================================================================
  describe('1. FileMagicBytePipe (MIME Spoofing Defense)', () => {
    it('1.1 should successfully validate authentic JPEG files with correct Magic Bytes (FF D8 FF)', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'patient_avatar.jpg',
        encoding: '7bit',
        mimetype: 'application/octet-stream', // Client passed raw or incorrect header
        buffer: validJpegBuffer,
        size: validJpegBuffer.length,
      } as Express.Multer.File;

      const validated = (await filePipe.transform(mockFile)) as Express.Multer.File;

      expect(validated).toBeDefined();
      expect(validated.mimetype).toBe('image/jpeg'); // Overwritten by real detected MIME
      expect((validated as any).detectedMimeType).toBe('image/jpeg');
    });

    it('1.2 should successfully validate authentic PNG files with correct Magic Bytes (89 50 4E 47)', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'blood_test.png',
        encoding: '7bit',
        mimetype: 'image/png',
        buffer: validPngBuffer,
        size: validPngBuffer.length,
      } as Express.Multer.File;

      const validated = (await filePipe.transform(mockFile)) as Express.Multer.File;

      expect(validated).toBeDefined();
      expect(validated.mimetype).toBe('image/png');
    });

    it('1.3 should successfully validate authentic PDF documents (%PDF)', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'medical_report.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        buffer: validPdfBuffer,
        size: validPdfBuffer.length,
      } as Express.Multer.File;

      const validated = (await filePipe.transform(mockFile)) as Express.Multer.File;

      expect(validated).toBeDefined();
      expect(validated.mimetype).toBe('application/pdf');
    });

    it('1.4 should successfully validate authentic WebP and GIF files', async () => {
      const webpFile = {
        fieldname: 'file',
        originalname: 'food.webp',
        buffer: validWebpBuffer,
        size: validWebpBuffer.length,
      } as Express.Multer.File;

      const gifFile = {
        fieldname: 'file',
        originalname: 'exercise.gif',
        buffer: validGifBuffer,
        size: validGifBuffer.length,
      } as Express.Multer.File;

      const validatedWebp = (await filePipe.transform(webpFile)) as Express.Multer.File;
      const validatedGif = (await filePipe.transform(gifFile)) as Express.Multer.File;

      expect(validatedWebp.mimetype).toBe('image/webp');
      expect(validatedGif.mimetype).toBe('image/gif');
    });

    it('1.5 should REJECT PHP script disguised as JPG (MIME Spoofing) with 400 Bad Request', async () => {
      const maliciousPhp = Buffer.from('<?php system($_GET["cmd"]); ?>');
      const spoofedFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'innocent_avatar.jpg', // Renamed extension to bypass extension filter
        encoding: '7bit',
        mimetype: 'image/jpeg', // Fake client header
        buffer: maliciousPhp,
        size: maliciousPhp.length,
      } as Express.Multer.File;

      await expect(filePipe.transform(spoofedFile)).rejects.toThrow(BadRequestException);
    });

    it('1.6 should REJECT Bash/Shell script disguised as PNG with 400 Bad Request', async () => {
      const maliciousShell = Buffer.from('#!/bin/bash\ncat /etc/passwd\nrm -rf /');
      const spoofedFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'evidence.png',
        encoding: '7bit',
        mimetype: 'image/png',
        buffer: maliciousShell,
        size: maliciousShell.length,
      } as Express.Multer.File;

      await expect(filePipe.transform(spoofedFile)).rejects.toThrow(BadRequestException);
    });

    it('1.7 should REJECT HTML/XSS script disguised as JPG with 400 Bad Request', async () => {
      const maliciousHtml = Buffer.from('<html><script>alert(document.cookie)</script></html>');
      const spoofedFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test.jpg',
        buffer: maliciousHtml,
        size: maliciousHtml.length,
      } as Express.Multer.File;

      await expect(filePipe.transform(spoofedFile)).rejects.toThrow(BadRequestException);
    });

    it('1.8 should REJECT Polyglot image containing embedded PHP backdoor code with 400 Bad Request', async () => {
      // Starts with JPEG magic bytes, but embeds PHP code in image comment / body
      const polyglotBuffer = Buffer.concat([
        validJpegBuffer,
        Buffer.from('<?php eval($_POST["shell"]); ?>'),
      ]);
      const polyglotFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'polyglot.jpg',
        buffer: polyglotBuffer,
        size: polyglotBuffer.length,
      } as Express.Multer.File;

      await expect(filePipe.transform(polyglotFile)).rejects.toThrow(BadRequestException);
    });

    it('1.9 should REJECT extension mismatch (Authentic PDF file renamed to .jpg) with 400 Bad Request', async () => {
      const mismatchedFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'sneaky_document.jpg', // Extension is .jpg but buffer is PDF (%PDF)
        buffer: validPdfBuffer,
        size: validPdfBuffer.length,
      } as Express.Multer.File;

      await expect(filePipe.transform(mismatchedFile)).rejects.toThrow(BadRequestException);
    });

    it('1.10 should REJECT empty files, null files, or corrupted buffers (< 4 bytes) with 400 Bad Request', async () => {
      await expect(filePipe.transform(null as any)).rejects.toThrow(BadRequestException);
      await expect(filePipe.transform({ buffer: null } as any)).rejects.toThrow(
        BadRequestException,
      );
      await expect(filePipe.transform({ buffer: Buffer.from([]) } as any)).rejects.toThrow(
        BadRequestException,
      );
      await expect(
        filePipe.transform({ buffer: Buffer.from([0xff, 0xd8]) } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('1.11 should REJECT image files exceeding 5MB limit with 400 Bad Request', async () => {
      // 5MB + 10 bytes
      const oversizedImage = Buffer.alloc(5 * 1024 * 1024 + 10);
      validJpegBuffer.copy(oversizedImage, 0);

      const oversizedFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'huge_photo.jpg',
        buffer: oversizedImage,
        size: oversizedImage.length,
      } as Express.Multer.File;

      await expect(filePipe.transform(oversizedFile)).rejects.toThrow(BadRequestException);
    });

    it('1.12 should REJECT document files exceeding 10MB limit with 400 Bad Request', async () => {
      // 10MB + 10 bytes
      const oversizedPdf = Buffer.alloc(10 * 1024 * 1024 + 10);
      validPdfBuffer.copy(oversizedPdf, 0);

      const oversizedFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'huge_book.pdf',
        buffer: oversizedPdf,
        size: oversizedPdf.length,
      } as Express.Multer.File;

      await expect(filePipe.transform(oversizedFile)).rejects.toThrow(BadRequestException);
    });

    it('1.13 should process an array of files and validate each one', async () => {
      const files: Express.Multer.File[] = [
        {
          fieldname: 'file',
          originalname: 'img1.jpg',
          buffer: validJpegBuffer,
          size: validJpegBuffer.length,
        } as Express.Multer.File,
        {
          fieldname: 'file',
          originalname: 'img2.png',
          buffer: validPngBuffer,
          size: validPngBuffer.length,
        } as Express.Multer.File,
      ];

      const validatedFiles = (await filePipe.transform(files)) as Express.Multer.File[];
      expect(Array.isArray(validatedFiles)).toBe(true);
      expect(validatedFiles.length).toBe(2);
      expect(validatedFiles[0].mimetype).toBe('image/jpeg');
      expect(validatedFiles[1].mimetype).toBe('image/png');
    });
  });

  // =========================================================================
  // SUITE 2: LocalStorageService (CWE-22 Path Traversal & Date Hierarchy)
  // =========================================================================
  describe('2. LocalStorageService (Path Traversal & Safe VPS Storage)', () => {
    it('2.1 should safely store uploaded file into date-hierarchical directory {year}/{month}/UUID.ext', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'sample_photo.jpg',
        buffer: validJpegBuffer,
        size: validJpegBuffer.length,
        mimetype: 'image/jpeg',
      } as Express.Multer.File;

      const result = await storageService.upload(mockFile);

      expect(result).toBeDefined();
      expect(result.originalFileName).toBe('sample_photo.jpg');
      expect(result.mimeType).toBe('image/jpeg');

      // Kiểm tra cấu trúc objectKey: year/month/UUID.jpg
      const now = new Date();
      const currentYear = now.getFullYear().toString();
      const currentMonth = String(now.getMonth() + 1).padStart(2, '0');

      expect(result.objectKey.startsWith(`${currentYear}/${currentMonth}/`)).toBe(true);
      expect(result.objectKey.endsWith('.jpg')).toBe(true);

      // Layer 3 Database/Disk state check: Khẳng định file thực sự nằm trên ổ cứng
      const expectedDiskPath = path.join(testUploadDir, result.objectKey);
      expect(fs.existsSync(expectedDiskPath)).toBe(true);
      const savedContent = fs.readFileSync(expectedDiskPath);
      expect(savedContent).toEqual(validJpegBuffer);
    });

    it('2.2 should HARD BLOCK Path Traversal attempts like ../../etc/passwd with 400 Bad Request', async () => {
      const maliciousTraversalPaths = [
        '../../etc/passwd',
        '../../../var/log/syslog',
        '/etc/passwd',
        '2026/10/../../etc/shadow',
        '..\\..\\windows\\win.ini',
        '..%2F..%2Fetc%2Fpasswd',
        './../../secret.key',
      ];

      for (const traversalPath of maliciousTraversalPaths) {
        await expect(storageService.getFile(traversalPath)).rejects.toThrow(BadRequestException);
        await expect(storageService.delete(traversalPath)).rejects.toThrow(BadRequestException);
      }
    });

    it('2.3 should HARD BLOCK Null Byte Injection (%00, \\0) with 400 Bad Request', async () => {
      const nullBytePaths = ['valid_image.jpg\0.php', '2026/10/file.jpg%00.sh'];

      for (const nullPath of nullBytePaths) {
        await expect(storageService.getFile(nullPath)).rejects.toThrow(BadRequestException);
      }
    });

    it('2.4 should throw 404 NotFoundException when querying non-existent file inside baseDir', async () => {
      const nonExistentKey = '2026/10/non-existent-uuid-12345.jpg';
      await expect(storageService.getFile(nonExistentKey)).rejects.toThrow(NotFoundException);
    });

    it('2.5 should delete file cleanly from disk upon safe deletion request', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'to_be_deleted.png',
        buffer: validPngBuffer,
        size: validPngBuffer.length,
        mimetype: 'image/png',
      } as Express.Multer.File;

      const uploadResult = await storageService.upload(mockFile);
      const filePath = path.join(testUploadDir, uploadResult.objectKey);
      expect(fs.existsSync(filePath)).toBe(true);

      const deleted = await storageService.delete(uploadResult.objectKey);
      expect(deleted).toBe(true);
      expect(fs.existsSync(filePath)).toBe(false);
    });

    it('2.6 should generate and cryptographically verify time-limited HMAC signatures', () => {
      const testObjectKey = '2026/10/confidential_record.pdf';
      const previewUrl = storageService.generateSignedUrl(testObjectKey, 'preview', 600);

      expect(previewUrl).toContain('objectKey=');
      expect(previewUrl).toContain('token=');
      expect(previewUrl).toContain('expires=');

      const urlObj = new URL(previewUrl);
      const token = urlObj.searchParams.get('token')!;
      const expires = Number(urlObj.searchParams.get('expires')!);

      // 1. Chữ ký chuẩn -> Xác thực thành công
      const isValid = storageService.verifySignedUrl(testObjectKey, token, expires, 'preview');
      expect(isValid).toBe(true);

      // 2. Tấn công sửa đổi objectKey -> Bị phát hiện và từ chối
      const isTamperedObjectKey = storageService.verifySignedUrl(
        '2026/10/another_patient_record.pdf',
        token,
        expires,
        'preview',
      );
      expect(isTamperedObjectKey).toBe(false);

      // 3. Tấn công tráo đổi action (preview -> download) -> Bị phát hiện
      const isTamperedAction = storageService.verifySignedUrl(
        testObjectKey,
        token,
        expires,
        'download',
      );
      expect(isTamperedAction).toBe(false);

      // 4. Tấn công sửa đổi token -> Bị phát hiện
      const isTamperedToken = storageService.verifySignedUrl(
        testObjectKey,
        'invalid_forged_hmac_token_12345678',
        expires,
        'preview',
      );
      expect(isTamperedToken).toBe(false);

      // 5. Token đã hết hạn trong quá khứ -> Bị từ chối
      const pastExpires = Math.floor(Date.now() / 1000) - 30; // 30s ago
      const expiredToken = storageService.createHmacSignature(
        testObjectKey,
        pastExpires,
        'preview',
      );
      const isExpired = storageService.verifySignedUrl(
        testObjectKey,
        expiredToken,
        pastExpires,
        'preview',
      );
      expect(isExpired).toBe(false);
    });
  });

  // =========================================================================
  // SUITE 3: FilesController (Endpoints, Evidence Persistence & Headers)
  // =========================================================================
  describe('3. FilesController Integration & Endpoints', () => {
    it('3.1 POST /api/files/upload should successfully upload and return file list', async () => {
      const mockFiles: Express.Multer.File[] = [
        {
          fieldname: 'file',
          originalname: 'avatar1.jpg',
          buffer: validJpegBuffer,
          size: validJpegBuffer.length,
          mimetype: 'image/jpeg',
        } as Express.Multer.File,
      ];

      const response = await filesController.uploadFiles(mockFiles);

      expect(Array.isArray(response)).toBe(true);
      expect(response.length).toBe(1);
      expect(response[0].originalFileName).toBe('avatar1.jpg');
      expect(response[0].url).toContain('/uploads/');
    });

    it('3.2 POST /api/files/upload-evidence should persist record to minh_chung table with BigInt and HMAC links', async () => {
      const mockEvidenceFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'xray_result.pdf',
        buffer: validPdfBuffer,
        size: validPdfBuffer.length,
        mimetype: 'application/pdf',
      } as Express.Multer.File;

      const body = {
        proposalId: '10',
        paymentRequestId: '20',
        note: 'Bản chụp X-quang phổi',
      };
      const mockUser = { id: 'doctor-user-uuid-1' };

      const evidenceResponse = await filesController.uploadEvidence(
        mockEvidenceFile,
        body,
        mockUser,
      );

      expect(evidenceResponse).toBeDefined();
      expect(evidenceResponse.id).toBe('99');
      expect(evidenceResponse.previewUrl).toContain('/api/v1/files/preview');
      expect(evidenceResponse.downloadUrl).toContain('/api/v1/files/download');

      // Khẳng định bản ghi được lưu vào cơ sở dữ liệu qua Prisma
      expect(prismaService.minh_chung!.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ten_file_goc: 'xray_result.pdf',
          mime_type: 'application/pdf',
          de_xuat_id: BigInt(10),
          yeu_cau_id: BigInt(20),
          nguoi_upload_id: 'doctor-user-uuid-1',
        }),
      });
    });

    it('3.3 GET /api/files/preview should stream file with safe inline headers', async () => {
      // 1. Upload an image first
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'preview_me.png',
        buffer: validPngBuffer,
        size: validPngBuffer.length,
        mimetype: 'image/png',
      } as Express.Multer.File;

      const uploadResult = await storageService.upload(mockFile);
      const previewUrl = storageService.generateSignedUrl(uploadResult.objectKey, 'preview');
      const url = new URL(previewUrl);
      const token = url.searchParams.get('token')!;
      const expires = url.searchParams.get('expires')!;

      // 2. Mock Express Response
      const headersSet: Record<string, string> = {};
      let responseBody: any = null;
      const res = {
        setHeader: jest.fn((k: string, v: string) => {
          headersSet[k] = v;
        }),
        send: jest.fn((data: any) => {
          responseBody = data;
        }),
      } as unknown as Response;

      await filesController.previewFile(uploadResult.objectKey, token, expires, res);

      expect(headersSet['Content-Type']).toBe('application/octet-stream');
      expect(headersSet['X-Content-Type-Options']).toBe('nosniff');
      expect(headersSet['Content-Disposition']).toBe('inline');
      expect(responseBody).toEqual(validPngBuffer);
    });

    it('3.4 GET /api/files/preview should REJECT forged HMAC tokens with 403 Forbidden', async () => {
      const res = {} as Response;
      await expect(
        filesController.previewFile(
          '2026/10/any.jpg',
          'fake_token',
          (Math.floor(Date.now() / 1000) + 600).toString(),
          res,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('3.5 GET /api/files/download should sanitize filename to prevent HTTP Header Injection (CWE-113)', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'report.pdf',
        buffer: validPdfBuffer,
        size: validPdfBuffer.length,
        mimetype: 'application/pdf',
      } as Express.Multer.File;

      const uploadResult = await storageService.upload(mockFile);
      const downloadUrl = storageService.generateSignedUrl(uploadResult.objectKey, 'download');
      const url = new URL(downloadUrl);
      const token = url.searchParams.get('token')!;
      const expires = url.searchParams.get('expires')!;

      const headersSet: Record<string, string> = {};
      const res = {
        setHeader: jest.fn((k: string, v: string) => {
          headersSet[k] = v;
        }),
        send: jest.fn(),
      } as unknown as Response;

      // Malicious filename with CRLF injection: \r\nSet-Cookie: admin=true
      const maliciousFilename = 'report\r\nSet-Cookie: admin=true.pdf';

      await filesController.downloadFile(
        uploadResult.objectKey,
        token,
        expires,
        maliciousFilename,
        res,
      );

      // Khẳng định ký tự nguy hiểm \r, \n đã bị lọc bỏ hoàn toàn
      expect(headersSet['Content-Disposition']).not.toContain('\r');
      expect(headersSet['Content-Disposition']).not.toContain('\n');
      expect(headersSet['X-Content-Type-Options']).toBe('nosniff');
    });
  });
});
