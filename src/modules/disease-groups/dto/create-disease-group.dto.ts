import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreateDiseaseGroupDto {
  @ApiPropertyOptional({ example: 'A', description: 'Mã nhóm bệnh (code)' })
  @IsOptional()
  @IsString({ message: 'validation.disease_groups.code_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(10, { message: 'validation.disease_groups.code_max_10' })
  code?: string;

  @ApiPropertyOptional({ example: 'Bệnh lý chuyển hóa', description: 'Tên nhóm bệnh (name)' })
  @IsOptional()
  @IsString({ message: 'validation.disease_groups.name_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'validation.disease_groups.name_max' })
  name?: string;

  @ApiPropertyOptional({ example: 'A', description: 'Mã nhóm bệnh (maNhom)' })
  @IsOptional()
  @IsString({ message: 'validation.disease_groups.code_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(10, { message: 'validation.disease_groups.code_max_10' })
  maNhom?: string;

  @ApiPropertyOptional({ example: 'Bệnh lý chuyển hóa', description: 'Tên nhóm bệnh (tenNhom)' })
  @IsOptional()
  @IsString({ message: 'validation.disease_groups.name_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'validation.disease_groups.name_max' })
  tenNhom?: string;

  @ApiPropertyOptional({ example: 'A', description: 'Mã nhóm bệnh (maNhomBenh alias)' })
  @IsOptional()
  @IsString({ message: 'validation.disease_groups.code_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(50, { message: 'validation.disease_groups.code_max_50' })
  maNhomBenh?: string;

  @ApiPropertyOptional({
    example: 'Bệnh lý chuyển hóa',
    description: 'Tên nhóm bệnh (tenNhomBenh alias)',
  })
  @IsOptional()
  @IsString({ message: 'validation.disease_groups.name_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'validation.disease_groups.name_max' })
  tenNhomBenh?: string;

  @ApiPropertyOptional({ example: 'Mô tả nhóm bệnh', description: 'Mô tả chi tiết nhóm bệnh' })
  @IsOptional()
  @IsString({ message: 'validation.disease_groups.desc_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(5000, { message: 'validation.disease_groups.desc_max' })
  description?: string;

  @ApiPropertyOptional({
    example: 'Mô tả nhóm bệnh',
    description: 'Mô tả chi tiết nhóm bệnh (Tiếng Việt)',
  })
  @IsOptional()
  @IsString({ message: 'validation.disease_groups.desc_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(5000, { message: 'validation.disease_groups.desc_max' })
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
