import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsUUID,
  IsEmail,
  IsOptional,
  IsEnum,
  IsString,
  MaxLength,
  MinLength,
  Matches,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole } from '../../../config/enums/role.enum';
import { PHONE_REGEX } from '../../../config/constants/regex.constants';

export class BatchUserIdsDto {
  @ApiProperty({
    description: 'Danh sách ID người dùng cần xử lý batch (Tối đa 100 ID)',
    example: ['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'],
  })
  @IsArray({ message: 'validation.users.user_ids_array' })
  @ArrayMinSize(1, { message: 'validation.users.user_ids_min' })
  @ArrayMaxSize(100, { message: 'validation.users.user_ids_max' })
  @IsUUID('all', { each: true, message: 'validation.users.user_id_invalid' })
  @IsNotEmpty({ each: true, message: 'validation.users.user_id_required' })
  @MaxLength(50, { each: true, message: 'validation.users.user_id_max_50' })
  userIds: string[];
}

export class BatchUpdateUserStatusDto extends BatchUserIdsDto {
  @ApiProperty({
    description: 'Trạng thái hoạt động mới (true: kích hoạt, false: khóa)',
    example: false,
  })
  @IsBoolean({ message: 'validation.users.status_boolean' })
  isActive: boolean;
}

export class CreateUserItemDto {
  @ApiProperty({ description: 'Tên đăng nhập', example: 'bacsi_nam' })
  @IsNotEmpty({ message: 'validation.users.username_required' })
  @IsString({ message: 'validation.users.username_string' })
  @MinLength(4, { message: 'validation.users.username_min_4' })
  @MaxLength(100, { message: 'validation.users.username_max_100' })
  username: string;

  @ApiPropertyOptional({ enum: UserRole, default: UserRole.USER })
  @IsOptional()
  @IsEnum(UserRole, { message: 'validation.users.role_invalid' })
  role?: UserRole;

  @ApiProperty({ description: 'Họ và tên', example: 'BS. Nguyễn Văn Nam' })
  @IsNotEmpty({ message: 'validation.users.fullname_required' })
  @IsString({ message: 'validation.users.fullname_string' })
  @MinLength(2, { message: 'validation.users.fullname_min_2' })
  @MaxLength(255, { message: 'validation.users.fullname_max_255' })
  fullName: string;

  @ApiProperty({ description: 'Email', example: 'nam.bs@truenutri.vn' })
  @IsNotEmpty({ message: 'validation.users.email_required' })
  @IsString({ message: 'validation.users.email_string' })
  @IsEmail({}, { message: 'validation.users.email_invalid' })
  @MaxLength(255, { message: 'validation.users.email_max_255' })
  email: string;

  @ApiPropertyOptional({ description: 'Số điện thoại', example: '0987654321' })
  @IsOptional()
  @IsString({ message: 'validation.users.phone_string' })
  @MaxLength(20, { message: 'validation.users.phone_max_20' })
  @Matches(PHONE_REGEX, { message: 'validation.users.phone_vietnam_format' })
  phone?: string;

  @ApiPropertyOptional({ description: 'Mật khẩu khởi tạo', example: 'P@ssw0rd123!' })
  @IsOptional()
  @IsString({ message: 'validation.users.password_string' })
  @MinLength(8, { message: 'validation.users.password_min_8' })
  @MaxLength(100, { message: 'validation.users.password_max_100' })
  password?: string;
}

export class BatchCreateUsersDto {
  @ApiProperty({
    type: [CreateUserItemDto],
    description: 'Danh sách người dùng cần tạo theo batch (Tối đa 100 người)',
  })
  @IsArray({ message: 'validation.users.users_array' })
  @ArrayMinSize(1, { message: 'validation.users.users_min' })
  @ArrayMaxSize(100, { message: 'validation.users.users_max' })
  @ValidateNested({ each: true })
  @Type(() => CreateUserItemDto)
  users: CreateUserItemDto[];
}
