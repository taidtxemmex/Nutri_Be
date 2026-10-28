import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class RejectProposalDto {
  @ApiPropertyOptional({
    description: 'Lý do từ chối đề xuất',
    example: 'Cơ cấu đạm vượt quá ngưỡng an toàn cho bệnh nhân suy thận',
  })
  @IsOptional()
  @IsString({ message: 'Lý do từ chối phải là chuỗi' })
  @MaxLength(500, { message: 'Lý do từ chối không được vượt quá 500 ký tự' })
  reason?: string;

  @ApiPropertyOptional({ description: 'Lý do từ chối (alias tương thích FE)' })
  @IsOptional()
  @IsString({ message: 'Lý do từ chối phải là chuỗi' })
  @MaxLength(500, { message: 'Lý do từ chối không được vượt quá 500 ký tự' })
  rejectReason?: string;
}

export class MenuProposalQueryDto {
  @ApiPropertyOptional({
    description:
      'Trạng thái đề xuất lọc (phân tách dấu phẩy hoặc đơn lẻ: PENDING, APPROVED, REJECTED hoặc CHO_DUYET, DA_DUYET, TU_CHOI)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Trạng thái lọc tối đa 100 ký tự' })
  statuses?: string;

  @ApiPropertyOptional({ description: 'Trang hiện tại (1-based)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Số lượng mục mỗi trang', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}

export class MenuProposalListDto {
  @ApiProperty({ description: 'ID đề xuất thực đơn' })
  id: string;

  @ApiProperty({ description: 'ID thực đơn gốc' })
  originalMenuId: string;

  @ApiProperty({ description: 'Tên thực đơn' })
  menuName: string;

  @ApiProperty({ description: 'Loại thực đơn: NGAY | TUAN | THANG' })
  menuType: string;

  @ApiProperty({ description: 'Loại đối tượng: BENH_NHAN | NHOM_BENH' })
  targetType: string;

  @ApiPropertyOptional({ description: 'Tổng năng lượng hiển thị' })
  totalEnergy?: string | null;

  @ApiProperty({ description: 'Trạng thái đề xuất: CHO_DUYET | DA_DUYET | TU_CHOI' })
  status: string;

  @ApiPropertyOptional({ description: 'Lý do từ chối nếu có' })
  rejectReason?: string | null;

  @ApiPropertyOptional({ description: 'Người đề xuất' })
  createdBy?: string | null;

  @ApiPropertyOptional({ description: 'Người phê duyệt' })
  approvedBy?: string | null;

  @ApiPropertyOptional({ description: 'Ngày đề xuất' })
  createdAt?: Date | string | null;

  @ApiPropertyOptional({ description: 'Ngày phê duyệt / từ chối' })
  approvedAt?: Date | string | null;
}

export class MenuProposalDetailDto {
  @ApiProperty({ description: 'ID đề xuất' })
  proposalId: string;

  @ApiProperty({ description: 'Trạng thái đề xuất' })
  proposalStatus: string;

  @ApiPropertyOptional({ description: 'Lý do từ chối' })
  rejectReason?: string | null;

  @ApiPropertyOptional({ description: 'Người gửi đề xuất' })
  proposalCreatedBy?: string | null;

  @ApiPropertyOptional({ description: 'Người duyệt đề xuất' })
  approvedBy?: string | null;

  @ApiPropertyOptional({ description: 'Thời gian đề xuất' })
  proposalCreatedAt?: Date | string | null;

  @ApiPropertyOptional({ description: 'Thời gian duyệt' })
  approvedAt?: Date | string | null;

  @ApiProperty({ description: 'ID thực đơn gốc' })
  originalMenuId: string;

  @ApiProperty({ description: 'Tên thực đơn' })
  menuName: string;

  @ApiProperty({ description: 'Loại thực đơn' })
  menuType: string;

  @ApiProperty({ description: 'Loại đối tượng' })
  targetType: string;

  @ApiPropertyOptional({ description: 'ID bệnh nhân' })
  patientId?: string | null;

  @ApiPropertyOptional({ description: 'ID nhóm bệnh' })
  diseaseGroupId?: number | null;

  @ApiPropertyOptional({ description: 'ID bộ giới hạn' })
  nutritionLimitSetId?: string | null;

  @ApiProperty({ description: 'Cấu trúc cây tuần -> ngày -> bữa -> món -> nguyên liệu tĩnh' })
  weeks: any[];
}
