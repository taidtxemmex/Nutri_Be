import { IsOptional, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BasePaginationQueryDto } from '../../../common/dto/base-pagination-query.dto';

export class ExtendedDiseaseGroupQueryDto extends BasePaginationQueryDto {
  @ApiPropertyOptional({ example: 1, description: 'Lọc theo ID nhóm bệnh cha' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  parentId?: number;
}
