import { IsOptional, IsString, MaxLength, IsInt, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

export class UpdateExtendedDiseaseGroupDto {
  @ApiPropertyOptional({ example: '01', description: 'Mã nhóm mở rộng cập nhật' })
  @IsOptional()
  @IsString({ message: 'validation.extended_disease_groups.extended_code_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(50, { message: 'validation.extended_disease_groups.extended_code_max_50' })
  extendedCode?: string;

  @ApiPropertyOptional({
    example: '01',
    description: 'Mã nhóm mở rộng cập nhật (alias maNhomBenh)',
  })
  @IsOptional()
  @IsString({ message: 'validation.extended_disease_groups.extended_code_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(50, { message: 'validation.extended_disease_groups.extended_code_max_50' })
  maNhomBenh?: string;

  @ApiPropertyOptional({
    example: '01',
    description: 'Mã nhóm mở rộng cập nhật (alias maNhomMoRong)',
  })
  @IsOptional()
  @IsString({ message: 'validation.extended_disease_groups.extended_code_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(50, { message: 'validation.extended_disease_groups.extended_code_max_50' })
  maNhomMoRong?: string;

  @ApiPropertyOptional({
    example: 'Tăng huyết áp nguyên phát (độ 2)',
    description: 'Tên hiển thị cập nhật',
  })
  @IsOptional()
  @IsString({ message: 'validation.extended_disease_groups.display_name_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'validation.extended_disease_groups.display_name_max_255' })
  displayName?: string;

  @ApiPropertyOptional({
    example: 'Tăng huyết áp nguyên phát (độ 2)',
    description: 'Tên nhóm bệnh cập nhật (alias tenNhomBenh)',
  })
  @IsOptional()
  @IsString({ message: 'validation.extended_disease_groups.group_name_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'validation.extended_disease_groups.group_name_max_255' })
  tenNhomBenh?: string;

  @ApiPropertyOptional({
    example: 'Tăng huyết áp nguyên phát (độ 2)',
    description: 'Tên hiển thị cập nhật (alias tenHienThi)',
  })
  @IsOptional()
  @IsString({ message: 'validation.extended_disease_groups.display_name_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'validation.extended_disease_groups.display_name_max_255' })
  tenHienThi?: string;

  @ApiPropertyOptional({ example: 1, description: 'ID nhóm bệnh cha' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'validation.extended_disease_groups.parent_id_int' })
  @Min(1, { message: 'validation.extended_disease_groups.parent_id_min' })
  parentId?: number;

  @ApiPropertyOptional({
    example: 'uuid-1',
    description: 'User ID (tùy chọn, hệ thống ưu tiên lấy từ JWT)',
  })
  @IsOptional()
  @IsString({ message: 'validation.extended_disease_groups.user_id_string' })
  userId?: string;

  getExtendedCode(): string {
    const raw = this.extendedCode || this.maNhomBenh || this.maNhomMoRong || '';
    return raw.trim();
  }

  getDisplayName(): string {
    const raw = this.displayName || this.tenNhomBenh || this.tenHienThi || '';
    return raw.trim();
  }
}
