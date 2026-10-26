import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsUUID,
  IsEmail,
  IsOptional,
  IsEnum,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole } from '../../../config/enums/role.enum';

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
  username: string;

  @ApiPropertyOptional({ enum: UserRole, default: UserRole.USER })
  @IsOptional()
  @IsEnum(UserRole, { message: 'users.validation.role_invalid' })
  role?: UserRole;

  @ApiProperty({ description: 'Họ và tên', example: 'BS. Nguyễn Văn Nam' })
  @IsNotEmpty({ message: 'users.validation.fullname_required' })
  fullName: string;

  @ApiProperty({ description: 'Email', example: 'nam.bs@truenutri.vn' })
  @IsEmail({}, { message: 'users.validation.email_invalid' })
  email: string;

  @ApiPropertyOptional({ description: 'Số điện thoại', example: '0987654321' })
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ description: 'Mật khẩu khởi tạo', example: 'P@ssw0rd123!' })
  @IsOptional()
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
