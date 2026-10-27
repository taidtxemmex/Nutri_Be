-- =====================================================================
-- Rollback Migration: 20261027110000_add_patient_clinical_records
-- Sprint: 5 (Module 08)
-- Purpose: Safely reverse schema changes adhering to FK dependency order
-- =====================================================================

-- 1. Xóa bảng `benh_nhan_benh_an` (tự động drop các foreign keys liên đới)
DROP TABLE IF EXISTS `benh_nhan_benh_an`;

-- 2. Xóa bảng `benh_nhan_nhan_trac` (tự động drop các foreign keys liên đới)
DROP TABLE IF EXISTS `benh_nhan_nhan_trac`;

-- 3. Xóa các ràng buộc ngoại, index và cột mới khỏi bảng `benh_nhan`
ALTER TABLE `benh_nhan` DROP FOREIGN KEY `fk_patient_main_disease`;
DROP INDEX `idx_patient_main_disease` ON `benh_nhan`;
ALTER TABLE `benh_nhan`
  DROP COLUMN `tinh_trang_thai_san`,
  DROP COLUMN `di_ung`,
  DROP COLUMN `tien_su_benh`,
  DROP COLUMN `nhom_benh_chinh_id`;
