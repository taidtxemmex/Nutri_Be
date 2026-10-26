import { IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

export class UpdateExtendedDiseaseGroupDto {
  @ApiPropertyOptional({ example: '01', description: 'Mã nhóm mở rộng cập nhật' })
  @IsOptional()
  @IsString({ message: 'Mã nhóm mở rộng phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(20, { message: 'Mã nhóm mở rộng tối đa 20 ký tự' })
  extendedCode?: string;

  @ApiPropertyOptional({
    example: 'Tăng huyết áp nguyên phát (độ 2)',
    description: 'Tên hiển thị cập nhật',
  })
  @IsOptional()
  @IsString({ message: 'Tên hiển thị phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'Tên hiển thị tối đa 255 ký tự' })
  displayName?: string;

  @ApiPropertyOptional({ example: 1, description: 'ID nhóm bệnh cha' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'ID nhóm bệnh cha phải là số' })
  parentId?: number;
}
