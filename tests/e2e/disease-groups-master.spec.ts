import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test', override: true });

import * as request from 'supertest';
import { TestAppHelper } from '../helpers/test-app.helper';
import { UserRole } from '../../src/config/enums/role.enum';
import { CacheService } from '../../src/core/cache/cache.service';
import {
  CACHE_TAG_DISEASE_GROUPS,
  CACHE_TAG_EXTENDED_DISEASE_GROUPS,
} from '../../src/config/constants/cache.constants';

describe('Disease Groups & Extended Disease Groups Master E2E (IDOR & 3-Layer Persistence)', () => {
  const helper = new TestAppHelper();
  let adminToken: string;
  let doctorAToken: string;
  let doctorAUser: any;
  let doctorBToken: string;
  let _doctorBUser: any;
  let cacheService: CacheService;

  beforeAll(async () => {
    await helper.init();
    cacheService = helper.getApp().get<CacheService>(CacheService);
  });

  beforeEach(async () => {
    // 1. Dọn dẹp theo thứ tự khóa ngoại từ bảng con tới bảng cha
    const prisma = helper.getPrisma();
    await prisma.$executeRawUnsafe('DELETE FROM `chi_tiet_mon_an`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `mon_an`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `thuc_don`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `de_xuat_thuc_don`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `nhom_benh_mo_rong`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `nhom_benh`;').catch(() => {});
    await helper.cleanDatabase();

    // 2. Dọn dẹp Cache tags
    if (cacheService) {
      await cacheService.invalidateTags([
        CACHE_TAG_DISEASE_GROUPS,
        CACHE_TAG_EXTENDED_DISEASE_GROUPS,
      ]);
    }

    // 3. Khởi tạo Admin và 2 Bác sĩ riêng biệt để kiểm định IDOR
    const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    const admin = await helper.createTestUser({
      username: `admin_dg_${uniqueSuffix}`,
      role: UserRole.ADMIN,
      password: 'P@ssw0rd123!',
      fullName: 'Quản Trị Viên Disease QA',
    });
    adminToken = admin.token;

    const doctorA = await helper.createTestUser({
      username: `doctor_a_${uniqueSuffix}`,
      role: UserRole.USER,
      password: 'P@ssw0rd123!',
      fullName: 'Bác Sĩ Nguyễn Văn A',
    });
    doctorAToken = doctorA.token;
    doctorAUser = doctorA.user;

    const doctorB = await helper.createTestUser({
      username: `doctor_b_${uniqueSuffix}`,
      role: UserRole.USER,
      password: 'P@ssw0rd123!',
      fullName: 'Bác Sĩ Trần Thị B',
    });
    doctorBToken = doctorB.token;
    _doctorBUser = doctorB.user;
  });

  afterAll(async () => {
    await helper.getPrisma().$disconnect();
    await helper.close();
  });

  describe('Scenario 1: Tạo mới nhóm bệnh danh mục chuẩn -> Layer 3 Verify CSDL nhom_benh', () => {
    it('should create new disease group and verify Layer 3 persistent database state', async () => {
      const payload = {
        code: 'TIMMACH',
        maNhom: 'TIMMACH',
        name: 'Bệnh lý Tim mạch & Huyết áp',
        tenNhom: 'Bệnh lý Tim mạch & Huyết áp',
      };

      // Layer 1: HTTP Status Code
      const res = await request(helper.getHttpServer())
        .post('/api/v1/disease-groups')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(200);

      // Layer 2: API Response Payload Envelope Validation
      expect(res.body).toHaveProperty('status', 200);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('id');
      expect(typeof res.body.data.id).toBe('number');
      expect(res.body.data.code).toBe('TIMMACH');
      expect(res.body.data.name).toBe('Bệnh lý Tim mạch & Huyết áp');
      expect(res.body.meta).toHaveProperty('timestamp');
      expect(res.body.meta).toHaveProperty('traceId');

      const createdId = res.body.data.id;

      // Layer 3: Direct Database State Persistence Assertion
      const dbGroup = await helper.getPrisma().nhom_benh.findUnique({
        where: { id: createdId },
      });
      expect(dbGroup).not.toBeNull();
      expect(dbGroup?.id).toBe(createdId);
      expect(dbGroup?.ma_nhom).toBe('TIMMACH');
      expect(dbGroup?.ten_nhom).toBe('Bệnh lý Tim mạch & Huyết áp');
    });

    it('should reject duplicate disease group code with DG_003 and preserve database integrity', async () => {
      // 1. Tạo trước nhóm bệnh gốc
      await helper.getPrisma().nhom_benh.create({
        data: { ma_nhom: 'TIEUDUONG', ten_nhom: 'Bệnh lý Đái tháo đường' },
      });

      // 2. Thử tạo trùng mã
      const res = await request(helper.getHttpServer())
        .post('/api/v1/disease-groups')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'TIEUDUONG',
          maNhom: 'TIEUDUONG',
          name: 'Đái tháo đường type 2',
          tenNhom: 'Đái tháo đường type 2',
        })
        .expect(400);

      // Layer 2: Error Envelope Assertion
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('DG_003');

      // Layer 3: Direct Database Count Assertion
      const count = await helper.getPrisma().nhom_benh.count({
        where: { ma_nhom: 'TIEUDUONG' },
      });
      expect(count).toBe(1);
    });
  });

  describe('Scenario 2: Tạo nhóm bệnh mở rộng với userId -> Layer 3 verify nhom_benh_mo_rong.nguoi_dung_id', () => {
    it('should create extended disease group bound to current doctor and verify Layer 3 DB foreign keys', async () => {
      // 1. Chuẩn bị nhóm bệnh cha
      const parentGroup = await helper.getPrisma().nhom_benh.create({
        data: { ma_nhom: 'THAN', ten_nhom: 'Bệnh lý Thận & Tiết niệu' },
      });

      const payload = {
        parentId: parentGroup.id,
        extendedCode: 'TH-01',
        displayName: 'Suy thận mạn giai đoạn 3b',
      };

      // Layer 1: HTTP Status Code
      const res = await request(helper.getHttpServer())
        .post('/api/v1/extended-disease-groups')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send(payload)
        .expect(200);

      // Layer 2: API Response Payload Envelope Validation
      expect(res.body).toHaveProperty('status', 200);
      expect(res.body.data).toMatchObject({
        id: expect.any(Number),
        extendedCode: 'TH-01',
        displayName: 'Suy thận mạn giai đoạn 3b',
        userId: doctorAUser.id,
        parentId: parentGroup.id,
        parentName: 'Bệnh lý Thận & Tiết niệu',
        fullCode: 'THAN - TH-01',
      });

      const createdExtId = res.body.data.id;

      // Layer 3: Direct Database State Persistence Assertion
      const dbExtRecord = await helper.getPrisma().nhom_benh_mo_rong.findUnique({
        where: { id: createdExtId },
      });
      expect(dbExtRecord).not.toBeNull();
      expect(dbExtRecord?.id).toBe(createdExtId);
      expect(dbExtRecord?.nguoi_dung_id).toBe(doctorAUser.id);
      expect(dbExtRecord?.ma_nhom_cha).toBe(parentGroup.id);
      expect(dbExtRecord?.ma_nhom_mo_rong).toBe('TH-01');
      expect(dbExtRecord?.ten_hien_thi).toBe('Suy thận mạn giai đoạn 3b');
    });
  });

  describe('Scenario 3: Bảo mật chống IDOR (Insecure Direct Object Reference)', () => {
    it('should forbid Doctor B from viewing, updating or deleting Doctor A extended group (DATA_001 - 404)', async () => {
      // 1. Tạo nhóm bệnh cha
      const parentGroup = await helper.getPrisma().nhom_benh.create({
        data: { ma_nhom: 'GAN', ten_nhom: 'Bệnh lý Gan mật' },
      });

      // 2. Bác sĩ A tạo nhóm mở rộng của riêng mình
      const groupA = await helper.getPrisma().nhom_benh_mo_rong.create({
        data: {
          ma_nhom_mo_rong: 'GM-01',
          ten_hien_thi: 'Xơ gan Child-Pugh B',
          ma_nhom_cha: parentGroup.id,
          nguoi_dung_id: doctorAUser.id,
        },
      });

      // 3. IDOR Attack 1: Bác sĩ B cố gắng đọc chi tiết nhóm của Bác sĩ A
      const resRead = await request(helper.getHttpServer())
        .get(`/api/v1/extended-disease-groups/${groupA.id}`)
        .set('Authorization', `Bearer ${doctorBToken}`)
        .expect(404);

      // Layer 2: API Error Envelope Assertion
      expect(resRead.body.error).toBeDefined();
      expect(resRead.body.error.code).toBe('DATA_001');

      // 4. IDOR Attack 2: Bác sĩ B cố gắng sửa nhóm của Bác sĩ A
      const resUpdate = await request(helper.getHttpServer())
        .put(`/api/v1/extended-disease-groups/${groupA.id}`)
        .set('Authorization', `Bearer ${doctorBToken}`)
        .send({
          displayName: 'Đã bị Doctor B chiếm quyền',
          extendedCode: 'HACKED',
        })
        .expect(404);

      expect(resUpdate.body.error).toBeDefined();
      expect(resUpdate.body.error.code).toBe('DATA_001');

      // Layer 3: Direct Database State Assertion - Nhóm A trong DB TUYỆT ĐỐI KHÔNG BỊ THAY ĐỔI
      const dbGroupAfterHackingAttempt = await helper.getPrisma().nhom_benh_mo_rong.findUnique({
        where: { id: groupA.id },
      });
      expect(dbGroupAfterHackingAttempt?.ten_hien_thi).toBe('Xơ gan Child-Pugh B');
      expect(dbGroupAfterHackingAttempt?.ma_nhom_mo_rong).toBe('GM-01');
      expect(dbGroupAfterHackingAttempt?.nguoi_dung_id).toBe(doctorAUser.id);

      // 5. IDOR Attack 3: Bác sĩ B cố gắng xóa nhóm của Bác sĩ A
      const resDelete = await request(helper.getHttpServer())
        .delete(`/api/v1/extended-disease-groups/${groupA.id}`)
        .set('Authorization', `Bearer ${doctorBToken}`)
        .expect(404);

      expect(resDelete.body.error).toBeDefined();
      expect(resDelete.body.error.code).toBe('DATA_001');

      // Layer 3: Direct Database State Assertion - Nhóm A vẫn tồn tại an toàn trong DB
      const dbGroupStillAlive = await helper.getPrisma().nhom_benh_mo_rong.findUnique({
        where: { id: groupA.id },
      });
      expect(dbGroupStillAlive).not.toBeNull();

      // 6. IDOR Query Leak Defense: Danh sách của Bác sĩ B TUYỆT ĐỐI không chứa nhóm của Bác sĩ A
      const resListB = await request(helper.getHttpServer())
        .get('/api/v1/extended-disease-groups')
        .set('Authorization', `Bearer ${doctorBToken}`)
        .expect(200);

      const itemsB = resListB.body.data;
      const idsB = itemsB.map((item: any) => item.id);
      expect(idsB).not.toContain(groupA.id);
    });

    it('should allow Doctor A to legitimately update and delete their own extended disease group', async () => {
      // 1. Tạo nhóm bệnh cha
      const parent = await helper.getPrisma().nhom_benh.create({
        data: { ma_nhom: 'HO', ten_nhom: 'Bệnh Hô hấp' },
      });

      // 2. Bác sĩ A tạo nhóm
      const groupA = await helper.getPrisma().nhom_benh_mo_rong.create({
        data: {
          ma_nhom_mo_rong: 'HH-01',
          ten_hien_thi: 'Hen phế quản mạn',
          ma_nhom_cha: parent.id,
          nguoi_dung_id: doctorAUser.id,
        },
      });

      // 3. Bác sĩ A cập nhật nhóm của chính mình
      const resUpdate = await request(helper.getHttpServer())
        .put(`/api/v1/extended-disease-groups/${groupA.id}`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          displayName: 'Hen phế quản mạn có kiểm soát',
        })
        .expect(200);

      expect(resUpdate.body.data.displayName).toBe('Hen phế quản mạn có kiểm soát');

      // Layer 3: Verify CSDL cập nhật chính xác
      const dbUpdated = await helper.getPrisma().nhom_benh_mo_rong.findUnique({
        where: { id: groupA.id },
      });
      expect(dbUpdated?.ten_hien_thi).toBe('Hen phế quản mạn có kiểm soát');

      // 4. Bác sĩ A xóa nhóm của chính mình
      const resDelete = await request(helper.getHttpServer())
        .delete(`/api/v1/extended-disease-groups/${groupA.id}`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(200);

      expect(resDelete.body.data.success).toBe(true);

      // Layer 3: Verify CSDL bản ghi đã bị xóa
      const dbDeleted = await helper.getPrisma().nhom_benh_mo_rong.findUnique({
        where: { id: groupA.id },
      });
      expect(dbDeleted).toBeNull();
    });
  });
});
