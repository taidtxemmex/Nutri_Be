-- Migration 2: Add Soft Delete (deleted_at) and optimize timestamps
-- Created at: 2026-10-26 12:10:00
-- Purpose: Support audit trail, legal compliance, and non-destructive soft deletes for core clinical & financial tables.

-- 1. Table: nguoi_dung
ALTER TABLE `nguoi_dung` ADD COLUMN `deleted_at` DATETIME DEFAULT NULL;
CREATE INDEX `idx_user_deleted_at` ON `nguoi_dung` (`deleted_at`);

-- 2. Table: ho_so_ca_nhan
ALTER TABLE `ho_so_ca_nhan` ADD COLUMN `deleted_at` DATETIME DEFAULT NULL;
CREATE INDEX `idx_profile_deleted_at` ON `ho_so_ca_nhan` (`deleted_at`);

-- 3. Table: benh_nhan (Hồ sơ y tế - không bao giờ xóa vĩnh viễn)
ALTER TABLE `benh_nhan` ADD COLUMN `deleted_at` DATETIME DEFAULT NULL;
CREATE INDEX `idx_patient_deleted_at` ON `benh_nhan` (`deleted_at`);

-- 4. Table: mon_an
ALTER TABLE `mon_an` ADD COLUMN `deleted_at` DATETIME DEFAULT NULL;
CREATE INDEX `idx_dish_deleted_at` ON `mon_an` (`deleted_at`);

-- 5. Table: nguyen_lieu (Kho thực phẩm quốc gia)
ALTER TABLE `nguyen_lieu` ADD COLUMN `deleted_at` DATETIME DEFAULT NULL;
CREATE INDEX `idx_ingredient_deleted_at` ON `nguyen_lieu` (`deleted_at`);

-- 6. Table: thuc_don
ALTER TABLE `thuc_don` ADD COLUMN `deleted_at` DATETIME DEFAULT NULL;
CREATE INDEX `idx_menu_deleted_at` ON `thuc_don` (`deleted_at`);

-- 7. Table: goi (Gói dịch vụ)
ALTER TABLE `goi` ADD COLUMN `deleted_at` DATETIME DEFAULT NULL;
CREATE INDEX `idx_package_deleted_at` ON `goi` (`deleted_at`);

-- 8. Table: dang_ky_cho_xac_thuc & thiet_bi_dang_nhap (DEFAULT CURRENT_TIMESTAMP)
ALTER TABLE `dang_ky_cho_xac_thuc` MODIFY COLUMN `created_at` DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6);
ALTER TABLE `thiet_bi_dang_nhap` MODIFY COLUMN `created_at` DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6);
