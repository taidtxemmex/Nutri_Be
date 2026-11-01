import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserProfileResponseDto {
  @ApiProperty({ example: 'Nguyễn Văn A', description: 'Họ và tên' })
  ho_ten: string;

  @ApiProperty({ example: 'nguyenvana@example.com', description: 'Địa chỉ email' })
  email: string;

  @ApiPropertyOptional({ example: '0901234567', description: 'Số điện thoại liên hệ' })
  phone?: string;

  @ApiPropertyOptional({ example: 'Hà Nội, Việt Nam', description: 'Địa chỉ cư trú' })
  dia_chi?: string;

  @ApiPropertyOptional({ example: 'NAM', description: 'Giới tính' })
  gioi_tinh?: string;

  @ApiPropertyOptional({ example: '1990-01-01', description: 'Ngày sinh định dạng YYYY-MM-DD' })
  ngay_sinh?: string;
}

export class UserListItemDto {
  @ApiProperty({ example: '00000000-0000-0000-0000-000000000001', description: 'User ID UUID' })
  id: string;

  @ApiProperty({
    example: '00000000-0000-0000-0000-000000000001',
    description: 'Keycloak ID liên kết',
  })
  keycloakUserId: string;

  @ApiProperty({ example: 'admin', description: 'Tên đăng nhập' })
  username: string;

  @ApiProperty({ example: 'Quản Trị Viên Tối Cao', description: 'Họ và tên' })
  fullName: string;

  @ApiProperty({ example: 'admin@truenutri.vn', description: 'Email' })
  email: string;

  @ApiPropertyOptional({ example: '0901234567', description: 'Số điện thoại' })
  phone?: string;

  @ApiPropertyOptional({ example: 'Hà Nội', description: 'Địa chỉ' })
  address?: string;

  @ApiPropertyOptional({ example: 'NAM', description: 'Giới tính' })
  gender?: string;

  @ApiPropertyOptional({ example: '1990-01-01', description: 'Ngày sinh' })
  dob?: string;

  @ApiProperty({ example: 'ADMIN', description: 'Vai trò người dùng trong hệ thống' })
  role: string;

  @ApiProperty({ example: true, description: 'Trạng thái hoạt động' })
  active: boolean;

  @ApiProperty({ example: '2026-10-26T00:00:00.000Z', description: 'Thời điểm tạo' })
  createdAt: string;
}

export class UserDetailResponseDto {
  @ApiProperty({ example: '00000000-0000-0000-0000-000000000001', description: 'User ID UUID' })
  id: string;

  @ApiProperty({ example: 'admin', description: 'Tên đăng nhập' })
  ten_dang_nhap: string;

  @ApiProperty({ example: 'ADMIN', description: 'Vai trò' })
  vai_tro: string;

  @ApiProperty({ example: true, description: 'Trạng thái hoạt động' })
  active: boolean;

  @ApiProperty({ example: true, description: 'Trạng thái hoàn thiện hồ sơ' })
  profile_completed: boolean;

  @ApiPropertyOptional({ type: UserProfileResponseDto, description: 'Hồ sơ cá nhân' })
  ho_so_ca_nhan?: UserProfileResponseDto;

  @ApiProperty({ example: '2026-10-26T00:00:00.000Z', description: 'Thời điểm tạo' })
  created_at: string;

  @ApiProperty({ example: '2026-10-26T00:00:00.000Z', description: 'Thời điểm cập nhật gần nhất' })
  updated_at: string;
}

export class BatchOperationResponseDto {
  @ApiProperty({ example: true, description: 'Kết quả thực hiện thành công' })
  success: boolean;

  @ApiProperty({ example: 'Thao tác hàng loạt thành công', description: 'Thông báo kết quả' })
  message: string;

  @ApiProperty({ example: 5, description: 'Số lượng bản ghi bị ảnh hưởng' })
  affectedCount: number;
}
