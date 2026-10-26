import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class IngredientListItemDto {
  @ApiProperty({ example: '1', description: 'ID nguyên liệu' })
  id: string;

  @ApiProperty({ example: 'Gạo tẻ', description: 'Tên nguyên liệu' })
  ten_nguyen_lieu: string;

  @ApiProperty({ example: 'Gạo tẻ', description: 'Tên nguyên liệu (alias NutriFE)' })
  material: string;

  @ApiPropertyOptional({ example: 'Gạo tẻ', description: 'Tên nguyên liệu (alias name)' })
  name?: string;

  @ApiPropertyOptional({ example: 1, description: 'ID danh mục' })
  danh_muc?: number | null;

  @ApiPropertyOptional({ example: 1, description: 'ID danh mục (alias categoryId)' })
  categoryId?: number | null;

  @ApiPropertyOptional({ example: 'Ngũ cốc', description: 'Tên danh mục' })
  categoryName?: string | null;

  @ApiPropertyOptional({ example: 'THUC_VAT', description: 'Loại protein' })
  loai_protein?: string | null;

  @ApiPropertyOptional({ example: 'THUC_VAT', description: 'Loại protein (alias loaiProtein)' })
  loaiProtein?: string | null;

  @ApiPropertyOptional({ example: 'DA_DUYET', description: 'Trạng thái duyệt' })
  trang_thai?: string | null;

  @ApiPropertyOptional({ example: 'DA_DUYET', description: 'Trạng thái duyệt (alias trangThai)' })
  trangThai?: string | null;

  @ApiPropertyOptional({ example: 100, description: 'Tỷ lệ ăn được (%)' })
  edible?: number | null;
}

export class IngredientDetailDto extends IngredientListItemDto {
  // Calculated nutrients
  @ApiPropertyOptional({ description: 'Glucid / Carbohydrate (g)', example: 76.2 })
  carbohydrate?: number;

  @ApiPropertyOptional({ description: 'Năng lượng / Energy (Kcal)', example: 342.7 })
  energy?: number;

  @ApiPropertyOptional({ description: 'Vitamin A RAE (µg)', example: 0 })
  vitaminARae?: number;

  // 77 Base Nutrients
  @ApiPropertyOptional({ description: 'Nước (g)' }) water?: number | null;
  @ApiPropertyOptional({ description: 'Protein (g)' }) protein?: number | null;
  @ApiPropertyOptional({ description: 'Chất béo / Lipid (g)' }) fat?: number | null;
  @ApiPropertyOptional({ description: 'Chất xơ / Fiber (g)' }) fiber?: number | null;
  @ApiPropertyOptional({ description: 'Tro / Ash (g)' }) ash?: number | null;
  @ApiPropertyOptional({ description: 'Canxi / Calci (mg)' }) calci?: number | null;
  @ApiPropertyOptional({ description: 'Photpho / Phosphorous (mg)' }) phosphorous?: number | null;
  @ApiPropertyOptional({ description: 'Sắt / Iron (mg)' }) iron?: number | null;
  @ApiPropertyOptional({ description: 'Kẽm / Zinc (mg)' }) zinc?: number | null;
  @ApiPropertyOptional({ description: 'Natri / Sodium (mg)' }) sodium?: number | null;
  @ApiPropertyOptional({ description: 'Kali / Potassium (mg)' }) potassium?: number | null;
  @ApiPropertyOptional({ description: 'Magie / Magnesium (mg)' }) magnesium?: number | null;
  @ApiPropertyOptional({ description: 'Mangan / Manganese (mg)' }) manganese?: number | null;
  @ApiPropertyOptional({ description: 'Đồng / Copper (µg)' }) copper?: number | null;
  @ApiPropertyOptional({ description: 'Selen / Selenium (µg)' }) selenium?: number | null;
  @ApiPropertyOptional({ description: 'Vitamin C (mg)' }) vitaminC?: number | null;
  @ApiPropertyOptional({ description: 'Thiamine - B1 (mg)' }) thiamine?: number | null;
  @ApiPropertyOptional({ description: 'Riboflavin - B2 (mg)' }) riboflavin?: number | null;
  @ApiPropertyOptional({ description: 'Niacin - B3 (mg)' }) niacin?: number | null;
  @ApiPropertyOptional({ description: 'Pantothenic acid - B5 (mg)' }) pantothenicAcid?:
    number | null;
  @ApiPropertyOptional({ description: 'Vitamin B6 (mg)' }) vitaminB6?: number | null;
  @ApiPropertyOptional({ description: 'Folate (µg)' }) folate?: number | null;
  @ApiPropertyOptional({ description: 'Axit folic (µg)' }) folicAcid?: number | null;
  @ApiPropertyOptional({ description: 'Biotin - B7 (µg)' }) biotin?: number | null;
  @ApiPropertyOptional({ description: 'Vitamin B12 (µg)' }) vitaminB12?: number | null;
  @ApiPropertyOptional({ description: 'Retinol (µg)' }) retinol?: number | null;
  @ApiPropertyOptional({ description: 'Vitamin D (µg)' }) vitaminD?: number | null;
  @ApiPropertyOptional({ description: 'Vitamin E (mg)' }) vitaminE?: number | null;
  @ApiPropertyOptional({ description: 'Vitamin K (µg)' }) vitaminK?: number | null;
  @ApiPropertyOptional({ description: 'Beta-carotene (µg)' }) betaCarotene?: number | null;
  @ApiPropertyOptional({ description: 'Alpha-carotene (µg)' }) alphaCarotene?: number | null;
  @ApiPropertyOptional({ description: 'Beta-cryptoxanthin (µg)' }) betaCryptoxanthin?:
    number | null;
  @ApiPropertyOptional({ description: 'Lycopene (µg)' }) lycopene?: number | null;
  @ApiPropertyOptional({ description: 'Lutein + Zeaxanthin (µg)' }) luteinZeaxanthin?:
    number | null;
  @ApiPropertyOptional({ description: 'Isoflavone tổng số (mg)' }) isoflavoneTongSo?: number | null;
  @ApiPropertyOptional({ description: 'Daidzein (mg)' }) daidzein?: number | null;
  @ApiPropertyOptional({ description: 'Genistein (mg)' }) genistein?: number | null;
  @ApiPropertyOptional({ description: 'Glycetin (mg)' }) glycetin?: number | null;
  @ApiPropertyOptional({ description: 'Purine (mg)' }) purine?: number | null;
  @ApiPropertyOptional({ description: 'TS Axit béo no (g)' }) tsAxitBeoNo?: number | null;
  @ApiPropertyOptional({ description: 'Palmitic (g)' }) palmitic?: number | null;
  @ApiPropertyOptional({ description: 'Margaric (g)' }) margaric?: number | null;
  @ApiPropertyOptional({ description: 'Stearic (g)' }) stearic?: number | null;
  @ApiPropertyOptional({ description: 'Arachidic (g)' }) arachidic?: number | null;
  @ApiPropertyOptional({ description: 'Behenic (g)' }) behenic?: number | null;
  @ApiPropertyOptional({ description: 'Lignoceric (g)' }) lignoceric?: number | null;
  @ApiPropertyOptional({ description: 'TS acid béo không no 1 nối đôi (g)' })
  tsAxitBeoKhongNo1NoiDoi?: number | null;
  @ApiPropertyOptional({ description: 'Myristoleic (g)' }) myristoleic?: number | null;
  @ApiPropertyOptional({ description: 'Palmitoleic (g)' }) palmitoleic?: number | null;
  @ApiPropertyOptional({ description: 'Oleic (g)' }) oleic?: number | null;
  @ApiPropertyOptional({ description: 'TS acid béo không no nhiều nối đôi (g)' })
  tsAxitBeoKhongNoNhieuNoiDoi?: number | null;
  @ApiPropertyOptional({ description: 'Linoleic (g)' }) linoleic?: number | null;
  @ApiPropertyOptional({ description: 'Linolenic (g)' }) linolenic?: number | null;
  @ApiPropertyOptional({ description: 'Arachidonic (g)' }) arachidonic?: number | null;
  @ApiPropertyOptional({ description: 'EPA (g)' }) epa?: number | null;
  @ApiPropertyOptional({ description: 'DHA (g)' }) dha?: number | null;
  @ApiPropertyOptional({ description: 'TS acid béo trans (g)' }) tsAxitBeoTrans?: number | null;
  @ApiPropertyOptional({ description: 'Cholesterol (mg)' }) cholesterol?: number | null;
  @ApiPropertyOptional({ description: 'Phytosterol (mg)' }) phytosterol?: number | null;
  @ApiPropertyOptional({ description: 'Lysin (mg)' }) lysin?: number | null;
  @ApiPropertyOptional({ description: 'Methionin (mg)' }) methionin?: number | null;
  @ApiPropertyOptional({ description: 'Tryptophan (mg)' }) tryptophan?: number | null;
  @ApiPropertyOptional({ description: 'Phenylalanin (mg)' }) phenylalanin?: number | null;
  @ApiPropertyOptional({ description: 'Threonin (mg)' }) threonin?: number | null;
  @ApiPropertyOptional({ description: 'Valine (mg)' }) valine?: number | null;
  @ApiPropertyOptional({ description: 'Leucine (mg)' }) leucine?: number | null;
  @ApiPropertyOptional({ description: 'Isoleucine (mg)' }) isoleucine?: number | null;
  @ApiPropertyOptional({ description: 'Arginine (mg)' }) arginine?: number | null;
  @ApiPropertyOptional({ description: 'Histidine (mg)' }) histidine?: number | null;
  @ApiPropertyOptional({ description: 'Cystine (mg)' }) cystine?: number | null;
  @ApiPropertyOptional({ description: 'Tyrosine (mg)' }) tyrosine?: number | null;
  @ApiPropertyOptional({ description: 'Alanine (mg)' }) alanine?: number | null;
  @ApiPropertyOptional({ description: 'Aspartic acid (mg)' }) asparticAcid?: number | null;
  @ApiPropertyOptional({ description: 'Glutamic acid (mg)' }) glutamicAcid?: number | null;
  @ApiPropertyOptional({ description: 'Glycine (mg)' }) glycine?: number | null;
  @ApiPropertyOptional({ description: 'Proline (mg)' }) proline?: number | null;
  @ApiPropertyOptional({ description: 'Serine (mg)' }) serine?: number | null;
}
