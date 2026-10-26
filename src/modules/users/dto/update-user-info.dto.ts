import { IsOptional, Matches, IsEnum, IsString, IsEmail } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PHONE_REGEX } from '../../../config/constants/regex.constants';

export class UpdateUserInfoReqDto {
  @ApiPropertyOptional({ description: 'Keycloak User ID hoặc UUID tương ứng' })
  @IsOptional()
  @IsString()
  keycloakUserId?: string;

  @ApiPropertyOptional({ description: 'User ID (UUID)' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ example: 'Nguyễn Minh Trí', description: 'Họ và tên' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ example: 'bsminhtri@gmail.com', description: 'Email' })
  @IsOptional()
  @IsEmail({}, { message: 'Định dạng email không hợp lệ' })
  email?: string;

  @ApiPropertyOptional({ example: '0987654321', description: 'Số điện thoại' })
  @IsOptional()
  @Matches(PHONE_REGEX, { message: 'Số điện thoại không đúng định dạng Việt Nam' })
  phone?: string;

  @ApiPropertyOptional({ example: '123 Giải Phóng, Hà Nội', description: 'Địa chỉ' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'NAM', enum: ['NAM', 'NU'], description: 'Giới tính' })
  @IsOptional()
  @IsEnum(['NAM', 'NU'], { message: 'Giới tính phải là NAM hoặc NU' })
  gender?: 'NAM' | 'NU';

  @ApiPropertyOptional({ example: '1990-05-15', description: 'Ngày sinh (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  dob?: string;

  @ApiPropertyOptional({
    example: '1990-05-15',
    description: 'Alias ngày sinh cho Frontend cũ (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  birthDate?: string;

  // Career / Job fields mapping to nguoi_de_xuat
  @ApiPropertyOptional({ example: 'Bác sĩ Chuyên khoa I', description: 'Trình độ học vấn' })
  @IsOptional()
  @IsString()
  education?: string;

  @ApiPropertyOptional({ example: 'Dinh dưỡng Lâm sàng', description: 'Chuyên ngành' })
  @IsOptional()
  @IsString()
  major?: string;

  @ApiPropertyOptional({ example: 'Bệnh viện Bạch Mai', description: 'Đơn vị công tác' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ example: 'Bác sĩ điều trị', description: 'Vị trí công tác' })
  @IsOptional()
  @IsString()
  position?: string;

  @ApiPropertyOptional({ example: 'Hồi sức tích cực', description: 'Lĩnh vực công tác' })
  @IsOptional()
  @IsString()
  field?: string;
}
