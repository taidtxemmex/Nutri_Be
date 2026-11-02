import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsObject,
  IsArray,
  MaxLength,
  IsInt,
  Min,
  Max,
  ArrayMaxSize,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateIngredientProposalDto {
  @ApiPropertyOptional({ example: 'THEM_MOI' })
  @IsOptional()
  @IsString({ message: 'validation.ingredient_proposals.proposal_type_string' })
  @MaxLength(50, { message: 'validation.ingredient_proposals.proposal_type_max' })
  proposalType?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  ingredientId?: string | number;

  @ApiProperty({ example: 'Sữa hạt sen organic' })
  @IsString({ message: 'validation.ingredient_proposals.ingredient_name_string' })
  @IsNotEmpty({ message: 'validation.ingredient_proposals.ingredient_name_required' })
  @MaxLength(255, { message: 'validation.ingredient_proposals.ingredient_name_max' })
  ingredientName: string;

  @ApiPropertyOptional({
    description: 'Đường dẫn ảnh nguyên liệu đề xuất (relative path)',
    example: '/uploads/public/ingredients/2026/11/sua-sen.jpg',
  })
  @IsOptional()
  @IsString({ message: 'validation.ingredient_proposals.image_url_string' })
  @MaxLength(500, { message: 'validation.ingredient_proposals.image_url_max' })
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'Alias snake_case cho imageUrl',
    example: '/uploads/public/ingredients/2026/11/sua-sen.jpg',
  })
  @IsOptional()
  @IsString({ message: 'validation.ingredient_proposals.image_url_string' })
  @MaxLength(500, { message: 'validation.ingredient_proposals.image_url_max' })
  image_url?: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt({ message: 'validation.ingredient_proposals.category_id_int' })
  @Min(1, { message: 'validation.ingredient_proposals.category_id_min' })
  @IsNotEmpty({ message: 'validation.ingredient_proposals.category_id_required' })
  categoryId: number;

  @ApiPropertyOptional({ example: 'THUC_VAT' })
  @IsOptional()
  @IsString({ message: 'validation.ingredient_proposals.protein_type_string' })
  @MaxLength(50, { message: 'validation.ingredient_proposals.protein_type_max' })
  loaiProtein?: string;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined ? undefined : Number(value),
  )
  @IsNumber({}, { message: 'validation.ingredient_proposals.edible_number' })
  @Min(0, { message: 'validation.ingredient_proposals.edible_min' })
  @Max(100, { message: 'validation.ingredient_proposals.edible_max' })
  edible?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject({ message: 'validation.ingredient_proposals.nutrients_object' })
  nutrients?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'validation.ingredient_proposals.note_string' })
  @MaxLength(2000, { message: 'validation.proposals.note_max' })
  note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray({ message: 'validation.ingredient_proposals.evidences_array' })
  @ArrayMaxSize(20, { message: 'validation.ingredient_proposals.evidences_max' })
  evidences?: any[];
}
