import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  MaxLength,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsIn,
  IsInt,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CreateIngredientDto {
  @ApiProperty({ description: 'Tên nguyên liệu', example: 'Gạo tẻ' })
  @Transform(({ value, obj }) => (value !== undefined ? value : obj?.name)?.toString().trim())
  @IsNotEmpty({ message: 'Tên nguyên liệu không được để trống' })
  @IsString()
  @MaxLength(255)
  material: string;

  // Alias name for backward compatibility
  @ApiPropertyOptional({ description: 'Tên nguyên liệu (alias)', example: 'Gạo tẻ' })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Tên nguyên liệu tối đa 255 ký tự' })
  name?: string;

  @ApiPropertyOptional({ description: 'ID danh mục nhóm thực phẩm', example: 1 })
  @Transform(({ value, obj }) => {
    const raw = value !== undefined ? value : obj?.danhMuc || obj?.category_id;
    if (raw === undefined || raw === null || raw === '') return undefined;
    const num = Number(raw);
    return isNaN(num) ? undefined : num;
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId?: number;

  @ApiPropertyOptional({
    description: 'Loại protein (THUC_VAT, DONG_VAT)',
    enum: ['THUC_VAT', 'DONG_VAT'],
    example: 'THUC_VAT',
  })
  @Transform(({ value, obj }) => {
    const raw = value !== undefined ? value : obj?.proteinType;
    if (raw === 'Thực vật') return 'THUC_VAT';
    if (raw === 'Động vật' || raw === 'Động Vật') return 'DONG_VAT';
    return raw;
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @IsIn(['THUC_VAT', 'DONG_VAT'])
  loaiProtein?: string;

  @ApiPropertyOptional({ description: 'Tỷ lệ phần ăn được (%) (0 - 100)', example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  edible?: number;

  // ===== 77 CHỈ TIÊU VI CHẤT CƠ SỞ (BASE NUTRIENTS) =====

  // 1. Nhóm sinh năng lượng & chất xơ, tro, nước (5 chỉ tiêu)
  @ApiPropertyOptional({ description: 'Nước (g)', example: 13.8 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  water?: number;

  @ApiPropertyOptional({ description: 'Chất đạm / Protein (g)', example: 7.9 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  protein?: number;

  @ApiPropertyOptional({ description: 'Chất béo / Lipid (g)', example: 0.7 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fat?: number;

  @ApiPropertyOptional({ description: 'Chất xơ tổng số / Fiber (g)', example: 0.4 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fiber?: number;

  @ApiPropertyOptional({ description: 'Tro / Ash (g)', example: 0.8 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  ash?: number;

  // 2. Khoáng chất (10 chỉ tiêu)
  @ApiPropertyOptional({ description: 'Canxi / Calci (mg)', example: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  calci?: number;

  @ApiPropertyOptional({ description: 'Photpho / Phosphorous (mg)', example: 104 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  phosphorous?: number;

  @ApiPropertyOptional({ description: 'Sắt / Iron (mg)', example: 1.3 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  iron?: number;

  @ApiPropertyOptional({ description: 'Kẽm / Zinc (mg)', example: 1.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  zinc?: number;

  @ApiPropertyOptional({ description: 'Natri / Sodium (mg)', example: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sodium?: number;

  @ApiPropertyOptional({ description: 'Kali / Potassium (mg)', example: 110 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  potassium?: number;

  @ApiPropertyOptional({ description: 'Magie / Magnesium (mg)', example: 35 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  magnesium?: number;

  @ApiPropertyOptional({ description: 'Mangan / Manganese (mg)', example: 1.1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  manganese?: number;

  @ApiPropertyOptional({ description: 'Đồng / Copper (µg)', example: 210 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  copper?: number;

  @ApiPropertyOptional({ description: 'Selen / Selenium (µg)', example: 15.1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  selenium?: number;

  // 3. Vitamin & Tiền Vitamin (17 chỉ tiêu)
  @ApiPropertyOptional({ description: 'Vitamin C (mg)', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  vitaminC?: number;

  @ApiPropertyOptional({ description: 'Thiamine - B1 (mg)', example: 0.1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  thiamine?: number;

  @ApiPropertyOptional({ description: 'Riboflavin - B2 (mg)', example: 0.03 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  riboflavin?: number;

  @ApiPropertyOptional({ description: 'Niacin - B3 (mg)', example: 1.6 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  niacin?: number;

  @ApiPropertyOptional({ description: 'Pantothenic acid - B5 (mg)', example: 0.7 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  pantothenicAcid?: number;

  @ApiPropertyOptional({ description: 'Vitamin B6 (mg)', example: 0.15 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  vitaminB6?: number;

  @ApiPropertyOptional({ description: 'Folate (µg)', example: 8 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  folate?: number;

  @ApiPropertyOptional({ description: 'Axit folic (µg)', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  folicAcid?: number;

  @ApiPropertyOptional({ description: 'Biotin - B7 (µg)', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  biotin?: number;

  @ApiPropertyOptional({ description: 'Vitamin B12 (µg)', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  vitaminB12?: number;

  @ApiPropertyOptional({ description: 'Retinol (µg)', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  retinol?: number;

  @ApiPropertyOptional({ description: 'Vitamin D (µg)', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  vitaminD?: number;

  @ApiPropertyOptional({ description: 'Vitamin E (mg)', example: 0.11 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  vitaminE?: number;

  @ApiPropertyOptional({ description: 'Vitamin K (µg)', example: 0.1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  vitaminK?: number;

  @ApiPropertyOptional({ description: 'Beta-carotene (µg)', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  betaCarotene?: number;

  @ApiPropertyOptional({ description: 'Alpha-carotene (µg)', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  alphaCarotene?: number;

  @ApiPropertyOptional({ description: 'Beta-cryptoxanthin (µg)', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  betaCryptoxanthin?: number;

  // 4. Isoflavon & Hợp chất sinh học (6 chỉ tiêu)
  @ApiPropertyOptional({ description: 'Lycopene (µg)', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  lycopene?: number;

  @ApiPropertyOptional({ description: 'Lutein + Zeaxanthin (µg)', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  luteinZeaxanthin?: number;

  @ApiPropertyOptional({ description: 'Isoflavone tổng số (mg)', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  isoflavoneTongSo?: number;

  @ApiPropertyOptional({ description: 'Daidzein (mg)', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  daidzein?: number;

  @ApiPropertyOptional({ description: 'Genistein (mg)', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  genistein?: number;

  @ApiPropertyOptional({ description: 'Glycetin (mg)', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  glycetin?: number;

  // 5. Purine (1 chỉ tiêu)
  @ApiPropertyOptional({ description: 'Purine (mg)', example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  purine?: number;

  // 6. Axit béo & Lipid chuyên sâu (20 chỉ tiêu)
  @ApiPropertyOptional({ description: 'Tổng axit béo no (g)', example: 0.18 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  tsAxitBeoNo?: number;

  @ApiPropertyOptional({ description: 'Palmitic (g)', example: 0.15 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  palmitic?: number;

  @ApiPropertyOptional({ description: 'Margaric (g)', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  margaric?: number;

  @ApiPropertyOptional({ description: 'Stearic (g)', example: 0.02 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stearic?: number;

  @ApiPropertyOptional({ description: 'Arachidic (g)', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  arachidic?: number;

  @ApiPropertyOptional({ description: 'Behenic (g)', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  behenic?: number;

  @ApiPropertyOptional({ description: 'Lignoceric (g)', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  lignoceric?: number;

  @ApiPropertyOptional({ description: 'Tổng axit béo không no 1 nối đôi (g)', example: 0.21 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  tsAxitBeoKhongNo1NoiDoi?: number;

  @ApiPropertyOptional({ description: 'Myristoleic (g)', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  myristoleic?: number;

  @ApiPropertyOptional({ description: 'Palmitoleic (g)', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  palmitoleic?: number;

  @ApiPropertyOptional({ description: 'Oleic (g)', example: 0.21 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  oleic?: number;

  @ApiPropertyOptional({ description: 'Tổng axit béo không no nhiều nối đôi (g)', example: 0.25 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  tsAxitBeoKhongNoNhieuNoiDoi?: number;

  @ApiPropertyOptional({ description: 'Linoleic (g)', example: 0.23 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  linoleic?: number;

  @ApiPropertyOptional({ description: 'Linolenic (g)', example: 0.02 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  linolenic?: number;

  @ApiPropertyOptional({ description: 'Arachidonic (g)', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  arachidonic?: number;

  @ApiPropertyOptional({ description: 'EPA (g)', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  epa?: number;

  @ApiPropertyOptional({ description: 'DHA (g)', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  dha?: number;

  @ApiPropertyOptional({ description: 'Tổng axit béo Trans (g)', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  tsAxitBeoTrans?: number;

  @ApiPropertyOptional({ description: 'Cholesterol (mg)', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cholesterol?: number;

  @ApiPropertyOptional({ description: 'Phytosterol (mg)', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  phytosterol?: number;

  // 7. Axit amin (18 chỉ tiêu)
  @ApiPropertyOptional({ description: 'Lysin (mg)', example: 270 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  lysin?: number;

  @ApiPropertyOptional({ description: 'Methionin (mg)', example: 180 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  methionin?: number;

  @ApiPropertyOptional({ description: 'Tryptophan (mg)', example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  tryptophan?: number;

  @ApiPropertyOptional({ description: 'Phenylalanin (mg)', example: 420 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  phenylalanin?: number;

  @ApiPropertyOptional({ description: 'Threonin (mg)', example: 310 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  threonin?: number;

  @ApiPropertyOptional({ description: 'Valine (mg)', example: 480 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  valine?: number;

  @ApiPropertyOptional({ description: 'Leucine (mg)', example: 680 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  leucine?: number;

  @ApiPropertyOptional({ description: 'Isoleucine (mg)', example: 360 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  isoleucine?: number;

  @ApiPropertyOptional({ description: 'Arginine (mg)', example: 610 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  arginine?: number;

  @ApiPropertyOptional({ description: 'Histidine (mg)', example: 210 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  histidine?: number;

  @ApiPropertyOptional({ description: 'Cystine (mg)', example: 160 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cystine?: number;

  @ApiPropertyOptional({ description: 'Tyrosine (mg)', example: 350 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  tyrosine?: number;

  @ApiPropertyOptional({ description: 'Alanine (mg)', example: 460 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  alanine?: number;

  @ApiPropertyOptional({ description: 'Aspartic acid (mg)', example: 720 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  asparticAcid?: number;

  @ApiPropertyOptional({ description: 'Glutamic acid (mg)', example: 1450 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  glutamicAcid?: number;

  @ApiPropertyOptional({ description: 'Glycine (mg)', example: 380 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  glycine?: number;

  @ApiPropertyOptional({ description: 'Proline (mg)', example: 390 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  proline?: number;

  @ApiPropertyOptional({ description: 'Serine (mg)', example: 410 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  serine?: number;
}
