import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectIngredientProposalDto {
  @ApiPropertyOptional({
    description: 'Lý do từ chối đề xuất nguyên liệu',
    example: 'Không đạt tiêu chí kiểm định lâm sàng',
  })
  @IsOptional()
  @IsString({ message: 'Lý do từ chối phải là chuỗi' })
  @MaxLength(500, { message: 'Lý do từ chối không được vượt quá 500 ký tự' })
  reason?: string;
}
