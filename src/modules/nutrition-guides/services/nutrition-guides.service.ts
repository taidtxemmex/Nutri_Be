import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import {
  NutritionGuideResponseDto,
  GetNutritionGuideByIdParamsDto,
  CreateNutritionGuideParamsDto,
  UpdateNutritionGuideParamsDto,
  DeleteNutritionGuideParamsDto,
} from '../dto';

@Injectable()
export class NutritionGuidesService {
  private readonly logger = new Logger(NutritionGuidesService.name);

  constructor(private readonly prisma: PrismaService) {}

  private mapToDto(entity: any): NutritionGuideResponseDto {
    let dietaryRequirements = entity.co_cau_khau_phan ?? undefined;
    if (typeof dietaryRequirements === 'string') {
      try {
        dietaryRequirements = JSON.parse(dietaryRequirements);
      } catch {
        dietaryRequirements = {};
      }
    }

    return {
      id: Number(entity.id),
      diseaseName: entity.ten_benh,
      code: entity.ma_ky_hieu,
      nutritionPrinciple: entity.nguyen_tac ?? undefined,
      dietaryRequirements,
      note: entity.luu_y ?? undefined,
    };
  }

  async getAll(): Promise<NutritionGuideResponseDto[]> {
    const list = await this.prisma.huong_dan_dinh_duong.findMany({
      orderBy: { id: 'asc' },
      take: 500,
    });
    return list.map((item) => this.mapToDto(item));
  }

  async getById({ id }: GetNutritionGuideByIdParamsDto): Promise<NutritionGuideResponseDto> {
    const entity = await this.prisma.huong_dan_dinh_duong.findUnique({
      where: { id: BigInt(id) },
    });

    if (!entity) {
      throw new NotFoundException('error.nutrition_guide.not_found');
    }

    return this.mapToDto(entity);
  }

  async create({ dto, userId }: CreateNutritionGuideParamsDto): Promise<NutritionGuideResponseDto> {
    const rawDto = dto as Record<string, any>;
    const code = dto.code ?? rawDto.maKyHieu;
    const diseaseName = dto.diseaseName ?? rawDto.tenBenh;
    const nutritionPrinciple =
      dto.nutritionPrinciple ?? rawDto.nguyenTac ?? rawDto.nguyenTacDinhDuong;
    const dietaryRequirements = dto.dietaryRequirements ?? rawDto.coCauKhauPhan;
    const note = dto.note ?? rawDto.luuY ?? rawDto.moTa ?? rawDto.description;

    const existing = await this.prisma.huong_dan_dinh_duong.findUnique({
      where: { ma_ky_hieu: code },
    });

    if (existing) {
      throw new ConflictException('Mã ký hiệu hướng dẫn đã tồn tại');
    }

    const created = await this.prisma.huong_dan_dinh_duong.create({
      data: {
        ma_ky_hieu: code,
        ten_benh: diseaseName,
        nguyen_tac: nutritionPrinciple ?? null,
        co_cau_khau_phan: dietaryRequirements
          ? JSON.parse(JSON.stringify(dietaryRequirements))
          : null,
        luu_y: note ?? null,
        nguoi_dung_id: userId ?? null,
      },
    });

    return this.mapToDto(created);
  }

  async update({ id, dto }: UpdateNutritionGuideParamsDto): Promise<NutritionGuideResponseDto> {
    const existing = await this.prisma.huong_dan_dinh_duong.findUnique({
      where: { id: BigInt(id) },
    });

    if (!existing) {
      throw new NotFoundException('error.nutrition_guide.not_found');
    }

    const rawDto = dto as Record<string, any>;
    const code = dto.code ?? rawDto.maKyHieu;
    const diseaseName = dto.diseaseName ?? rawDto.tenBenh;
    const nutritionPrinciple =
      dto.nutritionPrinciple ?? rawDto.nguyenTac ?? rawDto.nguyenTacDinhDuong;
    const dietaryRequirements = dto.dietaryRequirements ?? rawDto.coCauKhauPhan;
    const note = dto.note ?? rawDto.luuY ?? rawDto.moTa ?? rawDto.description;

    if (code && code !== existing.ma_ky_hieu) {
      const codeCheck = await this.prisma.huong_dan_dinh_duong.findUnique({
        where: { ma_ky_hieu: code },
      });
      if (codeCheck) {
        throw new ConflictException('Mã ký hiệu hướng dẫn đã tồn tại');
      }
    }

    const updated = await this.prisma.huong_dan_dinh_duong.update({
      where: { id: BigInt(id) },
      data: {
        ...(code ? { ma_ky_hieu: code } : {}),
        ...(diseaseName ? { ten_benh: diseaseName } : {}),
        ...(nutritionPrinciple !== undefined ? { nguyen_tac: nutritionPrinciple } : {}),
        ...(dietaryRequirements !== undefined
          ? {
              co_cau_khau_phan: dietaryRequirements
                ? JSON.parse(JSON.stringify(dietaryRequirements))
                : null,
            }
          : {}),
        ...(note !== undefined ? { luu_y: note } : {}),
      },
    });

    return this.mapToDto(updated);
  }

  async delete({ id }: DeleteNutritionGuideParamsDto): Promise<void> {
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
