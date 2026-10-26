-- Rollback Migration 2: Remove Soft Delete columns and indexes
-- Warning: Rollback will permanently lose soft-deletion status. Ensure all soft-deleted records are handled prior to execution.

DROP INDEX IF EXISTS `idx_user_deleted_at` ON `nguoi_dung`;
ALTER TABLE `nguoi_dung` DROP COLUMN IF EXISTS `deleted_at`;

DROP INDEX IF EXISTS `idx_profile_deleted_at` ON `ho_so_ca_nhan`;
ALTER TABLE `ho_so_ca_nhan` DROP COLUMN IF EXISTS `deleted_at`;

DROP INDEX IF EXISTS `idx_patient_deleted_at` ON `benh_nhan`;
ALTER TABLE `benh_nhan` DROP COLUMN IF EXISTS `deleted_at`;

DROP INDEX IF EXISTS `idx_dish_deleted_at` ON `mon_an`;
ALTER TABLE `mon_an` DROP COLUMN IF EXISTS `deleted_at`;

DROP INDEX IF EXISTS `idx_ingredient_deleted_at` ON `nguyen_lieu`;
ALTER TABLE `nguyen_lieu` DROP COLUMN IF EXISTS `deleted_at`;

DROP INDEX IF EXISTS `idx_menu_deleted_at` ON `thuc_don`;
ALTER TABLE `thuc_don` DROP COLUMN IF EXISTS `deleted_at`;

DROP INDEX IF EXISTS `idx_package_deleted_at` ON `goi`;
ALTER TABLE `goi` DROP COLUMN IF EXISTS `deleted_at`;
