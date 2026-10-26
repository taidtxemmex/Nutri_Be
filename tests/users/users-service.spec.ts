import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UsersService } from '../../src/modules/users/services/users.service';
import { IdorDefenseService } from '../../src/security/idor/idor-defense.service';
import { UserRole } from '../../src/config/enums/role.enum';

describe('UsersService', () => {
  let usersService: UsersService;
  let mockPrisma: any;
  let idorDefenseService: IdorDefenseService;

  beforeEach(() => {
    idorDefenseService = new IdorDefenseService();

    mockPrisma = {
      nguoi_dung: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'uuid-1',
            ten_dang_nhap: 'bs_minhtri',
            vai_tro: 'USER',
            active: true,
            keycloak_user_id: 'uuid-1',
            created_at: new Date('2026-01-01'),
            ho_so_ca_nhan: {
              ho_ten: 'Nguyễn Minh Trí',
              email: 'bsminhtri@gmail.com',
              phone: '0987654321',
              dia_chi: 'Hà Nội',
              gioi_tinh: 'NAM',
              ngay_sinh: new Date('1990-05-15'),
            },
          },
        ]),
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'uuid-created' }),
        update: jest.fn().mockResolvedValue({ id: 'uuid-1' }),
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      ho_so_ca_nhan: {
        upsert: jest.fn().mockResolvedValue({ id: 1 }),
      },
      nguoi_de_xuat: {
        upsert: jest.fn().mockResolvedValue({ id: 1 }),
      },
      $transaction: jest.fn((ops) => (Array.isArray(ops) ? Promise.all(ops) : ops(mockPrisma))),
    };

    usersService = new UsersService(mockPrisma, idorDefenseService);
  });

  describe('findAll', () => {
    it('should return bounded paginated users with explicit fields', async () => {
      const result = await usersService.findAll({ page: 1, limit: 10 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.items[0].username).toBe('bs_minhtri');
      expect(result.items[0]).not.toHaveProperty('mat_khau');
    });
  });

  describe('getUserInfo (Forensic IDOR Protection)', () => {
    const regularUser = {
      id: 'uuid-regular-user',
      sub: 'uuid-regular-user',
      username: 'patient_a',
      role: UserRole.USER,
    };

    const adminUser = {
      id: 'uuid-admin-user',
      sub: 'uuid-admin-user',
      username: 'admin',
      role: UserRole.ADMIN,
    };

    it('should allow user to view their own profile and return { viewUser, viewJob } schema', async () => {
      mockPrisma.nguoi_dung.findUnique.mockResolvedValue({
        id: 'uuid-regular-user',
        ten_dang_nhap: 'patient_a',
        vai_tro: 'USER',
        active: true,
        created_at: new Date('2026-01-01'),
        ho_so_ca_nhan: {
          ho_ten: 'Nguyễn Văn A',
          email: 'vana@gmail.com',
          phone: '0912345678',
          dia_chi: 'Đà Nẵng',
          gioi_tinh: 'NAM',
          ngay_sinh: new Date('1995-10-10'),
        },
        nguoi_de_xuat: null,
      });

      const result = await usersService.getUserInfo('uuid-regular-user', regularUser);

      expect(result).toHaveProperty('viewUser');
      expect(result).toHaveProperty('viewJob');
      expect(result.viewUser.fullName).toBe('Nguyễn Văn A');
      expect(result.viewUser.status).toBe('active');
    });

    it('should block regular user from accessing another user data with ForbiddenException (IDOR Defense)', async () => {
      await expect(
        usersService.getUserInfo('uuid-victim-user', regularUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow ADMIN to view any target user profile', async () => {
      mockPrisma.nguoi_dung.findUnique.mockResolvedValue({
        id: 'uuid-target-user',
        ten_dang_nhap: 'target_user',
        vai_tro: 'USER',
        active: true,
        created_at: new Date('2026-01-01'),
        ho_so_ca_nhan: {
          ho_ten: 'Trần Thị B',
          email: 'thib@gmail.com',
          phone: '0988888888',
          dia_chi: 'TP.HCM',
          gioi_tinh: 'NU',
          ngay_sinh: new Date('1998-02-20'),
        },
        nguoi_de_xuat: {
          trinh_do_hoc_van: 'Thạc sĩ',
          nghe_nghiep: 'Bác sĩ dinh dưỡng',
          don_vi_cong_tac: 'BV Chợ Rẫy',
          vi_tri_cong_tac: 'Bác sĩ điều trị',
          linh_vuc_cong_tac: 'Dinh dưỡng lâm sàng',
        },
      });

      const result = await usersService.getUserInfo('uuid-target-user', adminUser);

      expect(result.viewUser.fullName).toBe('Trần Thị B');
      expect(result.viewJob.education).toBe('Thạc sĩ');
      expect(result.viewJob.unit).toBe('BV Chợ Rẫy');
    });
  });

  describe('updateRole & updateStatus', () => {
    const adminUser = {
      id: 'admin-id',
      sub: 'admin-id',
      username: 'admin',
      role: UserRole.ADMIN,
    };

    const regularUser = {
      id: 'regular-id',
      sub: 'regular-id',
      username: 'regular',
      role: UserRole.USER,
    };

    it('should allow admin to update role', async () => {
      mockPrisma.nguoi_dung.findUnique.mockResolvedValue({
        id: 'target-id',
        vai_tro: UserRole.USER,
      });

      const result = await usersService.updateRole('target-id', UserRole.USERPRO, adminUser);

      expect(result.success).toBe(true);
      expect(result.role).toBe(UserRole.USERPRO);
      expect(mockPrisma.nguoi_dung.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'target-id' },
          data: expect.objectContaining({ vai_tro: UserRole.USERPRO }),
        }),
      );
    });

    it('should throw ForbiddenException if non-admin attempts to update role', async () => {
      await expect(
        usersService.updateRole('target-id', UserRole.ADMIN, regularUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow admin to update active status', async () => {
      mockPrisma.nguoi_dung.findUnique.mockResolvedValue({ id: 'target-id' });

      const result = await usersService.updateStatus('target-id', false, adminUser);

      expect(result.success).toBe(true);
      expect(result.active).toBe(false);
      expect(mockPrisma.nguoi_dung.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'target-id' },
          data: expect.objectContaining({ active: false }),
        }),
      );
    });
  });

  describe('checkProfile & softDeleteUser', () => {
    const adminUser = {
      id: 'admin-id',
      sub: 'admin-id',
      username: 'admin',
      role: UserRole.ADMIN,
    };

    const regularUser = {
      id: 'regular-id',
      sub: 'regular-id',
      username: 'regular',
      role: UserRole.USER,
    };

    it('should return profileComplete status correctly', async () => {
      mockPrisma.nguoi_dung.findUnique.mockResolvedValue({
        id: 'user-id',
        profile_completed: true,
        deleted_at: null,
      });

      const result = await usersService.checkProfile('user-id');
      expect(result.profileComplete).toBe(true);
    });

    it('should allow admin to soft delete user, marking active false and setting deleted_at', async () => {
      mockPrisma.nguoi_dung.findUnique.mockResolvedValue({
        id: 'victim-id',
        active: true,
        deleted_at: null,
      });

      const result = await usersService.softDeleteUser('victim-id', adminUser);

      expect(result.success).toBe(true);
      expect(mockPrisma.nguoi_dung.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'victim-id' },
          data: expect.objectContaining({
            active: false,
            deleted_at: expect.any(Date),
          }),
        }),
      );
    });

    it('should throw ForbiddenException when non-admin attempts soft delete', async () => {
      await expect(
        usersService.softDeleteUser('victim-id', regularUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should batch soft delete multiple users using updateMany (Rule 20)', async () => {
      mockPrisma.nguoi_dung.findMany.mockResolvedValue([
        { id: 'user-1', vai_tro: UserRole.USER },
        { id: 'user-2', vai_tro: UserRole.USERPRO },
      ]);
      mockPrisma.nguoi_dung.updateMany.mockResolvedValue({ count: 2 });

      const result = await usersService.softDeleteBatch(['user-1', 'user-2'], adminUser);

      expect(result.success).toBe(true);
      expect(result.affectedCount).toBe(2);
      expect(mockPrisma.nguoi_dung.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['user-1', 'user-2'] }, deleted_at: null },
        data: expect.objectContaining({
          active: false,
          deleted_at: expect.any(Date),
        }),
      });
    });

    it('should prevent user from self-deleting in batch soft delete', async () => {
      await expect(
        usersService.softDeleteBatch(['user-1', adminUser.id], adminUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should prevent non-SUPERADMIN from soft deleting SUPERADMIN in batch', async () => {
      mockPrisma.nguoi_dung.findMany.mockResolvedValue([
        { id: 'super-admin-id', vai_tro: UserRole.SUPERADMIN },
      ]);

      await expect(
        usersService.softDeleteBatch(['super-admin-id'], adminUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should batch update user status using updateMany (Rule 20)', async () => {
      mockPrisma.nguoi_dung.findMany.mockResolvedValue([
        { id: 'user-1', vai_tro: UserRole.USER },
        { id: 'user-2', vai_tro: UserRole.USERPRO },
      ]);
      mockPrisma.nguoi_dung.updateMany.mockResolvedValue({ count: 2 });

      const result = await usersService.updateStatusBatch(['user-1', 'user-2'], false, adminUser);

      expect(result.success).toBe(true);
      expect(result.affectedCount).toBe(2);
      expect(mockPrisma.nguoi_dung.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['user-1', 'user-2'] }, deleted_at: null },
        data: { active: false },
      });
    });

    it('should batch create users in a single transaction (Rule 20)', async () => {
      mockPrisma.nguoi_dung.findMany.mockResolvedValue([]);

      const newUsers = [
        {
          username: 'new_user_1',
          fullName: 'New User One',
          email: 'user1@nutritest.com',
          role: UserRole.USER,
        },
        {
          username: 'new_user_2',
          fullName: 'New User Two',
          email: 'user2@nutritest.com',
          role: UserRole.BAC_SI,
        },
      ];

      const result = await usersService.createBatch(newUsers, adminUser);

      expect(result.success).toBe(true);
      expect(result.createdCount).toBe(2);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should throw BadRequestException when batch create contains duplicate usernames in payload', async () => {
      const duplicateUsers = [
        { username: 'same_name', fullName: 'User A', email: 'a@nutritest.com' },
        { username: 'same_name', fullName: 'User B', email: 'b@nutritest.com' },
      ];

      await expect(
        usersService.createBatch(duplicateUsers, adminUser),
      ).rejects.toThrow();
    });
  });
});
