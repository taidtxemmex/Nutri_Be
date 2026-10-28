import {
  IsOptional,
  Matches,
  IsEnum,
  IsString,
  IsEmail,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PHONE_REGEX } from '../../../config/constants/regex.constants';

export class UpdateUserInfoReqDto {
  @ApiPropertyOptional({ description: 'Keycloak User ID hoặc UUID tương ứng' })
  @IsOptional()
  @IsString({ message: 'keycloakUserId phải là chuỗi' })
  @MaxLength(255, { message: 'keycloakUserId tối đa 255 ký tự' })
  keycloakUserId?: string;

  @ApiPropertyOptional({ description: 'User ID (UUID)' })
  @IsOptional()
  @IsString({ message: 'userId phải là chuỗi' })
  @MaxLength(50, { message: 'userId tối đa 50 ký tự' })
  userId?: string;

  @ApiPropertyOptional({ example: 'Nguyễn Minh Trí', description: 'Họ và tên' })
  @IsOptional()
  @IsString({ message: 'Họ và tên phải là chuỗi' })
  @MinLength(2, { message: 'Họ và tên tối thiểu 2 ký tự' })
  @MaxLength(255, { message: 'Họ và tên tối đa 255 ký tự' })
  fullName?: string;

  @ApiPropertyOptional({ example: 'bsminhtri@gmail.com', description: 'Email' })
  @IsOptional()
  @IsString({ message: 'Email phải là chuỗi' })
  @IsEmail({}, { message: 'Định dạng email không hợp lệ' })
  @MaxLength(255, { message: 'Email tối đa 255 ký tự' })
  email?: string;

  @ApiPropertyOptional({ example: '0987654321', description: 'Số điện thoại' })
  @IsOptional()
  @IsString({ message: 'Số điện thoại phải là chuỗi' })
  @MaxLength(20, { message: 'Số điện thoại tối đa 20 ký tự' })
  @Matches(PHONE_REGEX, { message: 'Số điện thoại không đúng định dạng Việt Nam' })
  phone?: string;

  @ApiPropertyOptional({ example: '123 Giải Phóng, Hà Nội', description: 'Địa chỉ' })
  @IsOptional()
  @IsString({ message: 'Địa chỉ phải là chuỗi' })
  @MaxLength(500, { message: 'Địa chỉ tối đa 500 ký tự' })
  address?: string;

  @ApiPropertyOptional({ example: 'NAM', enum: ['NAM', 'NU'], description: 'Giới tính' })
  @IsOptional()
  @IsEnum(['NAM', 'NU'], { message: 'Giới tính phải là NAM hoặc NU' })
  gender?: 'NAM' | 'NU';

  @ApiPropertyOptional({ example: '1990-05-15', description: 'Ngày sinh (YYYY-MM-DD)' })
  @IsOptional()
  @IsString({ message: 'Ngày sinh phải là chuỗi' })
  @MaxLength(10, { message: 'Ngày sinh tối đa 10 ký tự (YYYY-MM-DD)' })
  dob?: string;

  @ApiPropertyOptional({
    example: '1990-05-15',
    description: 'Alias ngày sinh cho Frontend cũ (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString({ message: 'Ngày sinh phải là chuỗi' })
  @MaxLength(10, { message: 'Ngày sinh tối đa 10 ký tự (YYYY-MM-DD)' })
  birthDate?: string;

  // Career / Job fields mapping to nguoi_de_xuat
  @ApiPropertyOptional({ example: 'Bác sĩ Chuyên khoa I', description: 'Trình độ học vấn' })
  @IsOptional()
  @IsString({ message: 'Trình độ học vấn phải là chuỗi' })
  @MaxLength(100, { message: 'Trình độ học vấn tối đa 100 ký tự' })
  education?: string;

  @ApiPropertyOptional({ example: 'Dinh dưỡng Lâm sàng', description: 'Chuyên ngành' })
  @IsOptional()
  @IsString({ message: 'Chuyên ngành phải là chuỗi' })
  @MaxLength(100, { message: 'Chuyên ngành tối đa 100 ký tự' })
  major?: string;

  @ApiPropertyOptional({ example: 'Bệnh viện Bạch Mai', description: 'Đơn vị công tác' })
  @IsOptional()
  @IsString({ message: 'Đơn vị công tác phải là chuỗi' })
  @MaxLength(255, { message: 'Đơn vị công tác tối đa 255 ký tự' })
  unit?: string;

  @ApiPropertyOptional({ example: 'Bác sĩ điều trị', description: 'Vị trí công tác' })
  @IsOptional()
  @IsString({ message: 'Vị trí công tác phải là chuỗi' })
  @MaxLength(100, { message: 'Vị trí công tác/chức vụ tối đa 100 ký tự' })
  position?: string;

  @ApiPropertyOptional({ example: 'Hồi sức tích cực', description: 'Lĩnh vực công tác' })
  @IsOptional()
  @IsString({ message: 'Lĩnh vực công tác phải là chuỗi' })
  @MaxLength(100, { message: 'Lĩnh vực công tác tối đa 100 ký tự' })
  field?: string;
}
