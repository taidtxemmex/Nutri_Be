-- Rollback: 20261028101500_add_unique_ingredient_name
-- 1. Hủy ràng buộc UNIQUE uk_ingredient_name
ALTER TABLE `nguyen_lieu` DROP INDEX `uk_ingredient_name`;

-- 2. Khôi phục collation của cột ten_nguyen_lieu về utf8mb4_unicode_ci
ALTER TABLE `nguyen_lieu` MODIFY COLUMN `ten_nguyen_lieu` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;
