import { IsString, IsNotEmpty, IsOptional, IsNumber, IsObject, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateIngredientProposalDto {
  @ApiPropertyOptional({ example: 'THEM_MOI' })
  @IsOptional()
  @IsString()
  proposalType?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  ingredientId?: string | number;

  @ApiProperty({ example: 'Sữa hạt sen organic' })
  @IsString()
  @IsNotEmpty()
  ingredientName: string;

  @ApiProperty({ example: 1 })
  @IsNotEmpty()
  categoryId: number;

  @ApiPropertyOptional({ example: 'THUC_VAT' })
  @IsOptional()
  @IsString()
  loaiProtein?: string;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsNumber()
  edible?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  nutrients?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  evidences?: any[];
}
