import {
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiOperation, ApiParam } from '@nestjs/swagger';
import { NutritionGuidesService } from '../services/nutrition-guides.service';
import {
  CreateNutritionGuideDto,
  UpdateNutritionGuideDto,
  NutritionGuideResponseDto,
} from '../dto';
import {
  ApiController,
  ApiStandardResponse,
  Auth,
  CurrentUser,
  Public,
} from '../../../common/decorators';
import { UserRole } from '../../../config/enums/role.enum';

@ApiController('NutritionGuides', ['nutrition-guides', 'nutrition-guide'])
export class NutritionGuidesController {
  constructor(private readonly service: NutritionGuidesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách các tài liệu hướng dẫn dinh dưỡng bệnh lý' })
  @ApiStandardResponse({
    type: NutritionGuideResponseDto,
    isArray: true,
    description: 'Lấy danh sách hướng dẫn dinh dưỡng thành công',
  })
  async getAll(): Promise<NutritionGuideResponseDto[]> {
    return this.service.getAll();
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết tài liệu hướng dẫn dinh dưỡng theo ID' })
  @ApiParam({ name: 'id', description: 'ID hướng dẫn dinh dưỡng' })
  @ApiStandardResponse({
    type: NutritionGuideResponseDto,
    description: 'Lấy chi tiết hướng dẫn dinh dưỡng thành công',
  })
  async getById(@Param('id', ParseIntPipe) id: number): Promise<NutritionGuideResponseDto> {
    return this.service.getById({ id });
  }

  @Post()
  @Auth(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Tạo bài viết hướng dẫn dinh dưỡng lâm sàng mới' })
  @ApiStandardResponse({
    type: NutritionGuideResponseDto,
    status: HttpStatus.CREATED,
    description: 'Tạo hướng dẫn dinh dưỡng thành công',
  })
  async create(
    @Body() dto: CreateNutritionGuideDto,
    @CurrentUser() user: any,
  ): Promise<NutritionGuideResponseDto> {
    return this.service.create({ dto, userId: user?.id || user?.userId });
  }

  @Put(':id')
  @Auth(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Cập nhật bài viết hướng dẫn dinh dưỡng theo ID' })
  @ApiParam({ name: 'id', description: 'ID hướng dẫn dinh dưỡng' })
  @ApiStandardResponse({
    type: NutritionGuideResponseDto,
    description: 'Cập nhật hướng dẫn dinh dưỡng thành công',
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateNutritionGuideDto,
  ): Promise<NutritionGuideResponseDto> {
    return this.service.update({ id, dto });
  }

  @Delete(':id')
  @Auth(UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa bài viết hướng dẫn dinh dưỡng theo ID' })
  @ApiParam({ name: 'id', description: 'ID hướng dẫn dinh dưỡng' })
  @ApiStandardResponse({
    description: 'Xóa hướng dẫn dinh dưỡng thành công',
  })
  async delete(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ success: boolean; message: string }> {
    await this.service.delete({ id });
    return { success: true, message: 'Xóa hướng dẫn dinh dưỡng thành công' };
  }
}
