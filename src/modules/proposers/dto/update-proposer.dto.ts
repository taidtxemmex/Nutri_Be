import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class UpdateProposerDto {
  @ApiPropertyOptional({ example: 'Tiến sĩ Dinh dưỡng', description: 'Trình độ học vấn cập nhật' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim()
      : Array.isArray(value)
        ? value.join(', ').trim()
        : value,
  )
  @IsString({ message: 'validation.proposers.education_level_string' })
  @MaxLength(100, { message: 'validation.proposers.education_level_max' })
  education?: string;

  @ApiPropertyOptional({ example: 'Bác sĩ CKII', description: 'Nghề nghiệp cập nhật' })
  @IsOptional()
  @IsString({ message: 'validation.proposers.occupation_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(100, { message: 'validation.proposers.occupation_max' })
  major?: string;

  @ApiPropertyOptional({ example: 'Bệnh viện TW Quân Đội 108', description: 'Đơn vị công tác' })
  @IsOptional()
  @IsString({ message: 'validation.proposers.workplace_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'validation.proposers.workplace_max' })
  unit?: string;

  @ApiPropertyOptional({ example: 'Phó Giám đốc Trung tâm', description: 'Vị trí công tác' })
  @IsOptional()
  @IsString({ message: 'validation.proposers.position_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'validation.proposers.position_max' })
  position?: string;

  @ApiPropertyOptional({ example: 'Dinh dưỡng hồi sức tích cực', description: 'Lĩnh vực công tác' })
  @IsOptional()
  @IsString({ message: 'validation.proposers.field_of_activity_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(100, { message: 'validation.proposers.field_of_activity_max' })
  field?: string;

  @ApiPropertyOptional({ example: 'uuid-1', description: 'User ID (tùy chọn)' })
  @IsOptional()
  @IsString({ message: 'validation.proposers.user_id_string' })
  @MaxLength(50, { message: 'validation.proposers.user_id_max' })
  userId?: string;

  @ApiPropertyOptional({ example: '0987654321', description: 'Số điện thoại (tùy chọn)' })
  @IsOptional()
  @IsString({ message: 'validation.proposers.phone_number_string' })
  @MaxLength(20, { message: 'validation.proposers.phone_number_max' })
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'CHO_DUYET', description: 'Trạng thái (tùy chọn)' })
  @IsOptional()
  @IsString({ message: 'validation.proposers.status_string' })
  @MaxLength(50, { message: 'validation.proposers.status_max' })
  status?: string;
}
