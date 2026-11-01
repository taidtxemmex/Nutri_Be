import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class UpdateDiseaseGroupDto {
  @ApiPropertyOptional({ example: 'A', description: 'Mã nhóm bệnh cập nhật (code)' })
  @IsOptional()
  @IsString({ message: 'Mã nhóm bệnh phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(10, { message: 'Mã nhóm bệnh tối đa 10 ký tự' })
  code?: string;

  @ApiPropertyOptional({
    example: 'Bệnh lý chuyển hóa cập nhật',
    description: 'Tên nhóm bệnh (name)',
  })
  @IsOptional()
  @IsString({ message: 'Tên nhóm bệnh phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'Tên nhóm bệnh tối đa 255 ký tự' })
  name?: string;

  @ApiPropertyOptional({ example: 'A', description: 'Mã nhóm bệnh (maNhom)' })
  @IsOptional()
  @IsString({ message: 'Mã nhóm bệnh phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(10, { message: 'Mã nhóm bệnh tối đa 10 ký tự' })
  maNhom?: string;

  @ApiPropertyOptional({
    example: 'Bệnh lý chuyển hóa cập nhật',
    description: 'Tên nhóm bệnh (tenNhom)',
  })
  @IsOptional()
  @IsString({ message: 'Tên nhóm bệnh phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'Tên nhóm bệnh tối đa 255 ký tự' })
  tenNhom?: string;

  @ApiPropertyOptional({ example: 'A', description: 'Mã nhóm bệnh cập nhật (maNhomBenh alias)' })
  @IsOptional()
  @IsString({ message: 'Mã nhóm bệnh phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(50, { message: 'Mã nhóm bệnh tối đa 50 ký tự' })
  maNhomBenh?: string;

  @ApiPropertyOptional({
    example: 'Bệnh lý chuyển hóa cập nhật',
    description: 'Tên nhóm bệnh cập nhật (tenNhomBenh alias)',
  })
  @IsOptional()
  @IsString({ message: 'Tên nhóm bệnh phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'Tên nhóm bệnh tối đa 255 ký tự' })
  tenNhomBenh?: string;

  @ApiPropertyOptional({
    example: 'Mô tả nhóm bệnh cập nhật',
    description: 'Mô tả nhóm bệnh cập nhật',
  })
  @IsOptional()
  @IsString({ message: 'Mô tả nhóm bệnh phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(5000, { message: 'Mô tả nhóm bệnh tối đa 5000 ký tự' })
  description?: string;

  @ApiPropertyOptional({
    example: 'Mô tả nhóm bệnh cập nhật',
    description: 'Mô tả nhóm bệnh cập nhật (Tiếng Việt)',
  })
  @IsOptional()
  @IsString({ message: 'Mô tả nhóm bệnh phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(5000, { message: 'Mô tả nhóm bệnh tối đa 5000 ký tự' })
  moTa?: string;

  getCode(): string {
    const raw = this.code || this.maNhom || this.maNhomBenh || '';
    return raw.trim();
  }

  getName(): string {
    const raw = this.name || this.tenNhom || this.tenNhomBenh || '';
    return raw.trim();
  }

  getDescription(): string {
    const raw = this.description || this.moTa || '';
    return raw.trim();
  }
}
