-- Rollback Migration 2: Remove Soft Delete columns and indexes
-- Warning: Rollback will permanently lose soft-deletion status. Ensure all soft-deleted records are handled prior to execution.

DROP INDEX `idx_user_deleted_at` ON `nguoi_dung`;
ALTER TABLE `nguoi_dung` DROP COLUMN `deleted_at`;

DROP INDEX `idx_profile_deleted_at` ON `ho_so_ca_nhan`;
ALTER TABLE `ho_so_ca_nhan` DROP COLUMN `deleted_at`;

DROP INDEX `idx_patient_deleted_at` ON `benh_nhan`;
ALTER TABLE `benh_nhan` DROP COLUMN `deleted_at`;

DROP INDEX `idx_dish_deleted_at` ON `mon_an`;
ALTER TABLE `mon_an` DROP COLUMN `deleted_at`;

DROP INDEX `idx_ingredient_deleted_at` ON `nguyen_lieu`;
ALTER TABLE `nguyen_lieu` DROP COLUMN `deleted_at`;

DROP INDEX `idx_menu_deleted_at` ON `thuc_don`;
ALTER TABLE `thuc_don` DROP COLUMN `deleted_at`;

DROP INDEX `idx_package_deleted_at` ON `goi`;
ALTER TABLE `goi` DROP COLUMN `deleted_at`;
