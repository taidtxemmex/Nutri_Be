import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreateProposerDto {
  @ApiPropertyOptional({ example: 'Thạc sĩ Dinh dưỡng', description: 'Trình độ học vấn' })
  @IsOptional()
  @IsString({ message: 'Trình độ học vấn phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(100, { message: 'Trình độ học vấn tối đa 100 ký tự' })
  education?: string;

  @ApiPropertyOptional({ example: 'Bác sĩ Dinh dưỡng', description: 'Nghề nghiệp / Chuyên môn' })
  @IsOptional()
  @IsString({ message: 'Nghề nghiệp phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(100, { message: 'Nghề nghiệp tối đa 100 ký tự' })
  major?: string;

  @ApiPropertyOptional({ example: 'Bệnh viện Bạch Mai', description: 'Đơn vị công tác' })
  @IsOptional()
  @IsString({ message: 'Đơn vị công tác phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'Đơn vị công tác tối đa 255 ký tự' })
  unit?: string;

  @ApiPropertyOptional({ example: 'Trưởng khoa Dinh dưỡng', description: 'Vị trí công tác' })
  @IsOptional()
  @IsString({ message: 'Vị trí công tác phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'Vị trí công tác tối đa 255 ký tự' })
  position?: string;

  @ApiPropertyOptional({ example: 'Dinh dưỡng lâm sàng', description: 'Lĩnh vực công tác' })
  @IsOptional()
  @IsString({ message: 'Lĩnh vực công tác phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(100, { message: 'Lĩnh vực công tác tối đa 100 ký tự' })
  field?: string;

  @ApiPropertyOptional({ example: 'uuid-1', description: 'User ID (tùy chọn)' })
  @IsOptional()
  @IsString()
  userId?: string;
}
