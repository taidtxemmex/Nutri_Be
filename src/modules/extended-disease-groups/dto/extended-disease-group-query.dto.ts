import { IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BasePaginationQueryDto } from '../../../common/dto/base-pagination-query.dto';

export class ExtendedDiseaseGroupQueryDto extends BasePaginationQueryDto {
  @ApiPropertyOptional({ example: 1, description: 'Lọc theo ID nhóm bệnh cha' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'validation.extended_disease_groups.parent_id_int' })
  @Min(1, { message: 'validation.extended_disease_groups.parent_id_min' })
  parentId?: number;
}
