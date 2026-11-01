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
  @IsArray({ message: 'users.validation.user_ids_array' })
  @ArrayMinSize(1, { message: 'users.validation.user_ids_min' })
  @ArrayMaxSize(100, { message: 'users.validation.user_ids_max' })
  @IsUUID('all', { each: true, message: 'users.validation.user_id_invalid' })
  @IsNotEmpty({ each: true, message: 'users.validation.user_id_required' })
  @MaxLength(50, { each: true, message: 'userId không được vượt quá 50 ký tự' })
  userIds: string[];
}

export class BatchUpdateUserStatusDto extends BatchUserIdsDto {
  @ApiProperty({
    description: 'Trạng thái hoạt động mới (true: kích hoạt, false: khóa)',
    example: false,
  })
  @IsBoolean({ message: 'users.validation.status_boolean' })
  isActive: boolean;
}

export class CreateUserItemDto {
  @ApiProperty({ description: 'Tên đăng nhập', example: 'bacsi_nam' })
  @IsNotEmpty({ message: 'users.validation.username_required' })
  @IsString({ message: 'Tên đăng nhập phải là chuỗi' })
  @MinLength(4, { message: 'Tên đăng nhập tối thiểu 4 ký tự' })
  @MaxLength(100, { message: 'Tên đăng nhập tối đa 100 ký tự' })
  username: string;

  @ApiPropertyOptional({ enum: UserRole, default: UserRole.USER })
  @IsOptional()
  @IsEnum(UserRole, { message: 'users.validation.role_invalid' })
  role?: UserRole;

  @ApiProperty({ description: 'Họ và tên', example: 'BS. Nguyễn Văn Nam' })
  @IsNotEmpty({ message: 'users.validation.fullname_required' })
  @IsString({ message: 'Họ và tên phải là chuỗi' })
  @MinLength(2, { message: 'Họ và tên tối thiểu 2 ký tự' })
  @MaxLength(255, { message: 'Họ và tên tối đa 255 ký tự' })
  fullName: string;

  @ApiProperty({ description: 'Email', example: 'nam.bs@truenutri.vn' })
  @IsNotEmpty({ message: 'users.validation.email_invalid' })
  @IsString({ message: 'Email phải là chuỗi' })
  @IsEmail({}, { message: 'users.validation.email_invalid' })
  @MaxLength(255, { message: 'Email tối đa 255 ký tự' })
  email: string;

  @ApiPropertyOptional({ description: 'Số điện thoại', example: '0987654321' })
  @IsOptional()
  @IsString({ message: 'Số điện thoại phải là chuỗi' })
  @MaxLength(20, { message: 'Số điện thoại tối đa 20 ký tự' })
  @Matches(PHONE_REGEX, { message: 'Số điện thoại không đúng định dạng Việt Nam' })
  phone?: string;

  @ApiPropertyOptional({ description: 'Mật khẩu khởi tạo', example: 'P@ssw0rd123!' })
  @IsOptional()
  @IsString({ message: 'Mật khẩu phải là chuỗi' })
  @MinLength(8, { message: 'Mật khẩu tối thiểu 8 ký tự' })
  @MaxLength(100, { message: 'Mật khẩu tối đa 100 ký tự' })
  password?: string;
}

export class BatchCreateUsersDto {
  @ApiProperty({
    type: [CreateUserItemDto],
    description: 'Danh sách người dùng cần tạo theo batch (Tối đa 100 người)',
  })
  @IsArray({ message: 'users.validation.users_array' })
  @ArrayMinSize(1, { message: 'users.validation.users_min' })
  @ArrayMaxSize(100, { message: 'users.validation.users_max' })
  @ValidateNested({ each: true })
  @Type(() => CreateUserItemDto)
  users: CreateUserItemDto[];
}
