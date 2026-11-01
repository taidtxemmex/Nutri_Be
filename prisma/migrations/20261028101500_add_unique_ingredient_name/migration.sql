-- Migration: 20261028101500_add_unique_ingredient_name
-- 1. Chuyển đổi collation của cột ten_nguyen_lieu sang utf8mb4_0900_as_ci (accent-sensitive, case-insensitive)
-- để phân biệt chính xác dấu tiếng Việt (ví dụ: 'Kẹo dừa mềm' != 'Kẹo dứa mềm', 'Bánh gio' != 'Bánh giò', 'Bánh khoai' != 'Bánh khoái')
-- hoàn toàn tương thích với cấu hình Java cũ: columnDefinition = "VARCHAR(255) NOT NULL COLLATE utf8mb4_0900_as_ci".
ALTER TABLE `nguyen_lieu` MODIFY COLUMN `ten_nguyen_lieu` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_ci NOT NULL;

-- 2. Thêm ràng buộc UNIQUE uk_ingredient_name cho ten_nguyen_lieu
ALTER TABLE `nguyen_lieu` ADD CONSTRAINT `uk_ingredient_name` UNIQUE (`ten_nguyen_lieu`);
