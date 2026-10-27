import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { MenuDishDetailDto } from './create-menu.dto';

export class ResolveDishDto {
  @ApiPropertyOptional({ description: 'ID món ăn gốc (nếu có)' })
  @IsOptional()
  dishId?: string | number;

  @ApiPropertyOptional({ description: 'Tên món ăn (nếu tạo nhanh)' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Hệ số sống/chín', default: 1.0 })
  @IsOptional()
  @IsNumber()
  coefficient?: number = 1.0;

  @ApiPropertyOptional({
    description: 'Danh sách nguyên liệu định lượng chi tiết',
    type: [MenuDishDetailDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuDishDetailDto)
  details?: MenuDishDetailDto[];
}
