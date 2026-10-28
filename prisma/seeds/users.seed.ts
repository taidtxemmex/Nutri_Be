import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { UserRole, Gender, AuthProvider } from '../../src/config/enums';

/**
 * Khởi tạo danh sách tài khoản người dùng theo chuẩn TypeScript Enums
 */
export async function seedUsers(prisma: PrismaClient): Promise<void> {
  console.log('👤 Đang khởi tạo các tài khoản người dùng chuẩn theo Enum...');
  const salt = await bcrypt.genSalt(10);
  const commonHash = await bcrypt.hash('P@ssw0rd123!', salt);
  const adminHash = await bcrypt.hash('Admin@123456', salt);

  const initialUsers = [
    {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'admin',
      role: UserRole.SUPERADMIN,
      password: adminHash,
      fullName: 'Quản Trị Viên Tối Cao',
      email: 'admin@truenutri.vn',
      phone: '0901234567',
      gender: Gender.NAM,
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      username: 'bacsi_truong',
      role: UserRole.BAC_SI,
      password: commonHash,
      fullName: 'BS. CKII Nguyễn Văn Trưởng',
      email: 'bacsi.truong@truenutri.vn',
      phone: '0912345678',
      gender: Gender.NAM,
    },
    {
      id: '00000000-0000-0000-0000-000000000003',
      username: 'chuyengia_dinhduong',
      role: UserRole.EXPERT,
      password: commonHash,
      fullName: 'ThS. Trần Thị Mai (Chuyên Gia Dinh Dưỡng)',
      email: 'mai.expert@truenutri.vn',
      phone: '0923456789',
      gender: Gender.NU,
    },
    {
      id: '00000000-0000-0000-0000-000000000004',
      username: 'user_pro',
      role: UserRole.USERPRO,
      password: commonHash,
      fullName: 'Lê Hoàng Pro (Hội Viên VIP)',
      email: 'pro.user@truenutri.vn',
      phone: '0934567890',
      gender: Gender.NAM,
    },
    {
      id: '00000000-0000-0000-0000-000000000005',
      username: 'user_standard',
      role: UserRole.USER,
      password: commonHash,
      fullName: 'Phạm Thu Thảo (Người Dùng)',
      email: 'thao.standard@truenutri.vn',
      phone: '0945678901',
      gender: Gender.NU,
    },
  ];

  // Batch Upsert Transaction: Tự động Create nếu chưa có, Update nếu đã có trong 1 transaction (Rule 20)
  const upsertOps = initialUsers.map((u) =>
    prisma.nguoi_dung.upsert({
      where: { id: u.id },
      create: {
        id: u.id,
        ten_dang_nhap: u.username,
        mat_khau: u.password,
        vai_tro: u.role,
        kenh: AuthProvider.LOCAL,
        active: true,
        profile_completed: true,
        deleted_at: null,
        ho_so_ca_nhan: {
          create: {
            ho_ten: u.fullName,
            email: u.email,
            phone: u.phone,
            gioi_tinh: u.gender,
            deleted_at: null,
          },
        },
      },
      update: {
        mat_khau: u.password,
        vai_tro: u.role,
        active: true,
        deleted_at: null,
        ho_so_ca_nhan: {
          upsert: {
            create: {
              ho_ten: u.fullName,
              email: u.email,
              phone: u.phone,
              gioi_tinh: u.gender,
              deleted_at: null,
            },
            update: {
              ho_ten: u.fullName,
              email: u.email,
              phone: u.phone,
              gioi_tinh: u.gender,
              deleted_at: null,
            },
          },
        },
      },
    }),
  );

  await prisma.$transaction(upsertOps);

  // Đảm bảo Admin có ít nhất 1 món ăn cá nhân RIENG_TU phục vụ màn hình DishTable FE
  const adminDish = await prisma.mon_an.findFirst({
    where: { nguoi_dung_id: '00000000-0000-0000-0000-000000000001', deleted_at: null },
  });
  if (!adminDish) {
    await prisma.mon_an.create({
      data: {
        nguoi_dung_id: '00000000-0000-0000-0000-000000000001',
        ten_mon: 'Cơm gạo tẻ cá nhân',
        trang_thai: 'RIENG_TU',
        chi_tiet_mon_an: {
          create: {
            nguyen_lieu_id: 1,
            khoi_luong_song_sach: 100,
          },
        },
      },
    });
  } else if (adminDish.trang_thai !== 'RIENG_TU') {
    await prisma.mon_an.update({
      where: { id: adminDish.id },
      data: { trang_thai: 'RIENG_TU' },
    });
  }

  console.log(
    `   ✅ Đã khởi tạo/cập nhật thành công ${initialUsers.length} tài khoản người dùng theo chuẩn Enum.`,
  );
}

if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { runStandaloneSeed } = require('./standalone-runner');
  runStandaloneSeed('users', (p: PrismaClient) => seedUsers(p));
}
