import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectIngredientProposalDto {
  @ApiPropertyOptional({
    description: 'Lý do từ chối đề xuất nguyên liệu',
    example: 'Không đạt tiêu chí kiểm định lâm sàng',
  })
  @IsOptional()
  @IsString({ message: 'validation.ingredient_proposals.reject_reason_string' })
  @MaxLength(500, { message: 'validation.ingredient_proposals.reject_reason_max' })
  reason?: string;
}
