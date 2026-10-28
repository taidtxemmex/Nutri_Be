import { IsOptional, IsString, MaxLength, IsInt, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

export class UpdateExtendedDiseaseGroupDto {
  @ApiPropertyOptional({ example: '01', description: 'Mã nhóm mở rộng cập nhật' })
  @IsOptional()
  @IsString({ message: 'Mã nhóm mở rộng phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(50, { message: 'Mã nhóm mở rộng tối đa 50 ký tự' })
  extendedCode?: string;

  @ApiPropertyOptional({
    example: '01',
    description: 'Mã nhóm mở rộng cập nhật (alias maNhomBenh)',
  })
  @IsOptional()
  @IsString({ message: 'Mã nhóm mở rộng phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(50, { message: 'Mã nhóm mở rộng tối đa 50 ký tự' })
  maNhomBenh?: string;

  @ApiPropertyOptional({
    example: '01',
    description: 'Mã nhóm mở rộng cập nhật (alias maNhomMoRong)',
  })
  @IsOptional()
  @IsString({ message: 'Mã nhóm mở rộng phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(50, { message: 'Mã nhóm mở rộng tối đa 50 ký tự' })
  maNhomMoRong?: string;

  @ApiPropertyOptional({
    example: 'Tăng huyết áp nguyên phát (độ 2)',
    description: 'Tên hiển thị cập nhật',
  })
  @IsOptional()
  @IsString({ message: 'Tên hiển thị phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'Tên hiển thị tối đa 255 ký tự' })
  displayName?: string;

  @ApiPropertyOptional({
    example: 'Tăng huyết áp nguyên phát (độ 2)',
    description: 'Tên nhóm bệnh cập nhật (alias tenNhomBenh)',
  })
  @IsOptional()
  @IsString({ message: 'Tên nhóm bệnh phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'Tên nhóm bệnh tối đa 255 ký tự' })
  tenNhomBenh?: string;

  @ApiPropertyOptional({
    example: 'Tăng huyết áp nguyên phát (độ 2)',
    description: 'Tên hiển thị cập nhật (alias tenHienThi)',
  })
  @IsOptional()
  @IsString({ message: 'Tên hiển thị phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'Tên hiển thị tối đa 255 ký tự' })
  tenHienThi?: string;

  @ApiPropertyOptional({ example: 1, description: 'ID nhóm bệnh cha' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'ID nhóm bệnh cha phải là số nguyên' })
  @Min(1, { message: 'ID nhóm bệnh cha phải lớn hơn 0' })
  parentId?: number;

  getExtendedCode(): string {
    const raw = this.extendedCode || this.maNhomBenh || this.maNhomMoRong || '';
    return raw.trim();
  }

  getDisplayName(): string {
    const raw = this.displayName || this.tenNhomBenh || this.tenHienThi || '';
    return raw.trim();
  }
}
