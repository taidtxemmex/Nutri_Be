import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import {
  CreateNutritionGuideDto,
  UpdateNutritionGuideDto,
  NutritionGuideResponseDto,
} from '../dto';

@Injectable()
export class NutritionGuidesService {
  private readonly logger = new Logger(NutritionGuidesService.name);

  constructor(private readonly prisma: PrismaService) {}

  private mapToDto(entity: any): NutritionGuideResponseDto {
    return {
      id: Number(entity.id),
      diseaseName: entity.ten_benh,
      code: entity.ma_ky_hieu,
      nutritionPrinciple: entity.nguyen_tac ?? undefined,
      dietaryRequirements: entity.co_cau_khau_phan ?? undefined,
      note: entity.luu_y ?? undefined,
    };
  }

  async getAll(): Promise<NutritionGuideResponseDto[]> {
    const list = await this.prisma.huong_dan_dinh_duong.findMany({
      orderBy: { id: 'asc' },
    });
    return list.map((item) => this.mapToDto(item));
  }

  async getById(id: number): Promise<NutritionGuideResponseDto> {
    const entity = await this.prisma.huong_dan_dinh_duong.findUnique({
      where: { id: BigInt(id) },
    });

    if (!entity) {
      throw new NotFoundException('error.nutrition_guide.not_found');
    }

    return this.mapToDto(entity);
  }

  async create(
    dto: CreateNutritionGuideDto,
    userId?: string,
  ): Promise<NutritionGuideResponseDto> {
    const existing = await this.prisma.huong_dan_dinh_duong.findUnique({
      where: { ma_ky_hieu: dto.code },
    });

    if (existing) {
      throw new ConflictException('Mã ký hiệu hướng dẫn đã tồn tại');
    }

    const created = await this.prisma.huong_dan_dinh_duong.create({
      data: {
        ma_ky_hieu: dto.code,
        ten_benh: dto.diseaseName,
        nguyen_tac: dto.nutritionPrinciple ?? null,
        co_cau_khau_phan: dto.dietaryRequirements ? JSON.parse(JSON.stringify(dto.dietaryRequirements)) : null,
        luu_y: dto.note ?? null,
        nguoi_dung_id: userId ?? null,
      },
    });

    return this.mapToDto(created);
  }

  async update(
    id: number,
    dto: UpdateNutritionGuideDto,
  ): Promise<NutritionGuideResponseDto> {
    const existing = await this.prisma.huong_dan_dinh_duong.findUnique({
      where: { id: BigInt(id) },
    });

    if (!existing) {
      throw new NotFoundException('error.nutrition_guide.not_found');
    }

    if (dto.code && dto.code !== existing.ma_ky_hieu) {
      const codeCheck = await this.prisma.huong_dan_dinh_duong.findUnique({
        where: { ma_ky_hieu: dto.code },
      });
      if (codeCheck) {
        throw new ConflictException('Mã ký hiệu hướng dẫn đã tồn tại');
      }
    }

    const updated = await this.prisma.huong_dan_dinh_duong.update({
      where: { id: BigInt(id) },
      data: {
        ...(dto.code ? { ma_ky_hieu: dto.code } : {}),
        ...(dto.diseaseName ? { ten_benh: dto.diseaseName } : {}),
        ...(dto.nutritionPrinciple !== undefined ? { nguyen_tac: dto.nutritionPrinciple } : {}),
        ...(dto.dietaryRequirements !== undefined
          ? { co_cau_khau_phan: dto.dietaryRequirements ? JSON.parse(JSON.stringify(dto.dietaryRequirements)) : null }
          : {}),
        ...(dto.note !== undefined ? { luu_y: dto.note } : {}),
      },
    });

    return this.mapToDto(updated);
  }

  async delete(id: number): Promise<void> {
    const existing = await this.prisma.huong_dan_dinh_duong.findUnique({
      where: { id: BigInt(id) },
    });

    if (!existing) {
      throw new NotFoundException('error.nutrition_guide.not_found');
    }

    try {
      await this.prisma.huong_dan_dinh_duong.delete({
        where: { id: BigInt(id) },
      });
    } catch (err: any) {
      this.logger.error(`Failed to delete nutrition guide: ${err.message}`);
      throw new BadRequestException('error.nutrition_guide.in_use');
    }
  }
}
