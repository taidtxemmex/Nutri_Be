import { Get, Post, Put, Delete, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiParam } from '@nestjs/swagger';
import { MealsService } from '../services/meals.service';
import { CreateMealDto, UpdateMealDto, MealResponseDto } from '../dto';
import { ApiController, ApiStandardResponse, CurrentUser } from '../../../common/decorators';

@ApiController('Meals', ['meal', 'meals'], { auth: true })
export class MealsController {
  constructor(private readonly mealsService: MealsService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tạo mới bữa ăn cùng danh sách món' })
  @ApiStandardResponse({
    type: MealResponseDto,
    description: 'Tạo bữa ăn thành công',
  })
  async create(@Body() dto: CreateMealDto, @CurrentUser() user: any): Promise<MealResponseDto> {
    return this.mealsService.create({ dto, currentUser: user });
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách bữa ăn' })
  @ApiStandardResponse({
    type: MealResponseDto,
    isArray: true,
    description: 'Lấy danh sách bữa ăn thành công',
  })
  async getAll(@CurrentUser() user: any): Promise<MealResponseDto[]> {
    return this.mealsService.findAll({ currentUser: user });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết bữa ăn tính toán 86 vi chất' })
  @ApiParam({ name: 'id', description: 'ID bữa ăn' })
  @ApiStandardResponse({
    type: MealResponseDto,
    description: 'Lấy chi tiết bữa ăn thành công',
  })
  async getById(@Param('id') id: string, @CurrentUser() user: any): Promise<MealResponseDto> {
    return this.mealsService.findById({ id, currentUser: user });
  }

  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật bữa ăn (bảo toàn hệ số sống chín cũ nếu không truyền mới)' })
  @ApiParam({ name: 'id', description: 'ID bữa ăn' })
  @ApiStandardResponse({
    type: MealResponseDto,
    description: 'Cập nhật bữa ăn thành công',
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMealDto,
    @CurrentUser() user: any,
  ): Promise<MealResponseDto> {
    return this.mealsService.update({ id, dto, currentUser: user });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa bữa ăn (bảo vệ không cho xóa nếu đang được dùng trong thực đơn)' })
  @ApiParam({ name: 'id', description: 'ID bữa ăn' })
  @ApiStandardResponse({
    description: 'Xóa bữa ăn thành công',
  })
  async delete(@Param('id') id: string, @CurrentUser() user: any): Promise<{ message: string }> {
    return this.mealsService.delete({ id, currentUser: user });
  }
}
