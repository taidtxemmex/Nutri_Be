import { IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BasePaginationQueryDto } from '../../../common/dto/base-pagination-query.dto';

export class ExtendedDiseaseGroupQueryDto extends BasePaginationQueryDto {
  @ApiPropertyOptional({ example: 1, description: 'Lọc theo ID nhóm bệnh cha' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'ID nhóm bệnh cha phải là số nguyên' })
  @Min(1, { message: 'ID nhóm bệnh cha phải lớn hơn 0' })
  parentId?: number;
}
