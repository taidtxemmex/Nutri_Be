import { CreateCategoryDto } from './create-category.dto';
import { UpdateCategoryDto } from './update-category.dto';
import { CategoryQueryDto } from './category-query.dto';

export class FindCategoriesParamsDto {
  query?: CategoryQueryDto;
}

export class FindCategoryByIdParamsDto {
  id: number;
}

export class CreateCategoryParamsDto {
  dto: CreateCategoryDto;
}

export class UpdateCategoryParamsDto {
  id: number;
  dto: UpdateCategoryDto;
}

export class DeleteCategoryParamsDto {
  id: number;
}
