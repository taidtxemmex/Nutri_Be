-- =====================================================================
-- Migration: 20261027110000_add_patient_clinical_records
-- Sprint: 5 (Module 08 - Clinical Patient Management & Anthropometry)
-- Database: MySQL 8.0 / MariaDB
-- Strict Rule 31: Formal timestamped migration file with strict rollback
-- =====================================================================

-- 1. Bổ sung các cột mở rộng lâm sàng cho bảng `benh_nhan`
ALTER TABLE `benh_nhan`
  ADD COLUMN `tinh_trang_thai_san` VARCHAR(50) DEFAULT 'KHONG',
  ADD COLUMN `di_ung` TEXT NULL,
  ADD COLUMN `tien_su_benh` TEXT NULL,
  ADD COLUMN `nhom_benh_chinh_id` INT NULL;

CREATE INDEX `idx_patient_main_disease` ON `benh_nhan` (`nhom_benh_chinh_id`);

ALTER TABLE `benh_nhan`
  ADD CONSTRAINT `fk_patient_main_disease` FOREIGN KEY (`nhom_benh_chinh_id`) 
  REFERENCES `nhom_benh_mo_rong` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- 2. Tạo bảng Lịch sử Đo Nhân trắc học theo thời gian (`benh_nhan_nhan_trac`)
CREATE TABLE `benh_nhan_nhan_trac` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `benh_nhan_id` BIGINT NOT NULL,
  `ngay_do` DATE NOT NULL,
  `can_nang` DOUBLE NOT NULL,
  `chieu_cao` DOUBLE NOT NULL,
  `bmi` DOUBLE NOT NULL,
  `phan_loai_bmi` VARCHAR(50) NOT NULL,
  `bmr` DOUBLE NULL,
  `tdee` DOUBLE NULL,
  `huyet_ap_tam_thu` INT NULL,
  `huyet_ap_tam_truong` INT NULL,
  `vong_eo` DOUBLE NULL,
  `vong_mong` DOUBLE NULL,
  `he_so_hoat_dong` DOUBLE NULL,
  `ghi_chu` TEXT NULL,
  `nguoi_tao_id` CHAR(36) NOT NULL,
  `tao_luc` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  INDEX `idx_anthropometry_patient_date` (`benh_nhan_id`, `ngay_do` DESC),
  INDEX `idx_anthropometry_creator` (`nguoi_tao_id`),
  CONSTRAINT `fk_anthropometry_patient` FOREIGN KEY (`benh_nhan_id`) 
    REFERENCES `benh_nhan` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `fk_anthropometry_creator` FOREIGN KEY (`nguoi_tao_id`) 
    REFERENCES `nguoi_dung` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tạo bảng Lịch sử Khám Lâm sàng & Gán Thực đơn Can thiệp (`benh_nhan_benh_an`)
CREATE TABLE `benh_nhan_benh_an` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `benh_nhan_id` BIGINT NOT NULL,
  `ngay_kham` DATE NOT NULL,
  `ly_do_kham` VARCHAR(500) NULL,
  `chan_doan_chinh` VARCHAR(500) NOT NULL,
  `ma_icd10` VARCHAR(50) NULL,
  `nhom_benh_id` INT NULL,
  `trieu_chung_lam_sang` TEXT NULL,
  `tien_su_benh` TEXT NULL,
  `huong_dieu_tri` TEXT NULL,
  `thuc_don_can_thiep_id` BIGINT NULL,
  `bac_si_kham_id` CHAR(36) NOT NULL,
  `ghi_chu` TEXT NULL,
  `tao_luc` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  INDEX `idx_med_record_patient_date` (`benh_nhan_id`, `ngay_kham` DESC),
  INDEX `idx_med_record_menu` (`thuc_don_can_thiep_id`),
  INDEX `idx_med_record_doctor` (`bac_si_kham_id`),
  INDEX `idx_med_record_disease` (`nhom_benh_id`),
  CONSTRAINT `fk_med_record_patient` FOREIGN KEY (`benh_nhan_id`) 
    REFERENCES `benh_nhan` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `fk_med_record_menu` FOREIGN KEY (`thuc_don_can_thiep_id`) 
    REFERENCES `thuc_don` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT `fk_med_record_doctor` FOREIGN KEY (`bac_si_kham_id`) 
    REFERENCES `nguoi_dung` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_med_record_disease` FOREIGN KEY (`nhom_benh_id`) 
    REFERENCES `nhom_benh_mo_rong` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
