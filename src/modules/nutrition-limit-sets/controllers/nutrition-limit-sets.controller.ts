import { Get, Post, Put, Delete, Body, Param, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiParam } from '@nestjs/swagger';
import { NutritionLimitSetsService } from '../services/nutrition-limit-sets.service';
import {
  CreateNutritionLimitSetDto,
  UpdateNutritionLimitSetDto,
  NutritionLimitSetResponseDto,
} from '../dto';
import { ApiController, ApiStandardResponse, Auth, CurrentUser } from '../../../common/decorators';

@ApiController('NutritionLimitSets', 'nutrition-limit-sets')
export class NutritionLimitSetsController {
  constructor(private readonly service: NutritionLimitSetsService) {}

  @Get()
  @Auth()
  @ApiOperation({ summary: 'Lấy danh sách các bộ giới hạn dinh dưỡng (của tôi & mẫu tái sử dụng)' })
  @ApiStandardResponse({
    type: NutritionLimitSetResponseDto,
    isArray: true,
    description: 'Lấy danh sách thành công',
  })
  async getAll(@CurrentUser() user: any): Promise<NutritionLimitSetResponseDto[]> {
    return this.service.getAll({ currentUser: user });
  }

  @Get(':id')
  @Auth()
  @ApiOperation({ summary: 'Lấy chi tiết một bộ giới hạn dinh dưỡng theo ID' })
  @ApiParam({ name: 'id', description: 'ID bộ giới hạn' })
  @ApiStandardResponse({
    type: NutritionLimitSetResponseDto,
    description: 'Lấy chi tiết thành công',
  })
  async getById(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ): Promise<NutritionLimitSetResponseDto> {
    return this.service.getById({ id, currentUser: user });
  }

  @Post()
  @Auth()
  @ApiOperation({ summary: 'Tạo mới bộ giới hạn dinh dưỡng' })
  @ApiStandardResponse({
    type: NutritionLimitSetResponseDto,
    status: HttpStatus.CREATED,
    description: 'Tạo thành công',
  })
  async create(
    @Body() dto: CreateNutritionLimitSetDto,
    @CurrentUser() user: any,
  ): Promise<NutritionLimitSetResponseDto> {
    return this.service.create({ dto, currentUser: user });
  }

  @Put(':id')
  @Auth()
  @ApiOperation({ summary: 'Cập nhật bộ giới hạn dinh dưỡng' })
  @ApiParam({ name: 'id', description: 'ID bộ giới hạn' })
  @ApiStandardResponse({
    type: NutritionLimitSetResponseDto,
    description: 'Cập nhật thành công',
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateNutritionLimitSetDto,
    @CurrentUser() user: any,
  ): Promise<NutritionLimitSetResponseDto> {
    return this.service.update({ id, dto, currentUser: user });
  }

  @Delete(':id')
  @Auth()
  @ApiOperation({ summary: 'Xóa bộ giới hạn dinh dưỡng' })
  @ApiParam({ name: 'id', description: 'ID bộ giới hạn' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ): Promise<{ success: boolean; message: string }> {
    return this.service.delete({ id, currentUser: user });
  }
}
