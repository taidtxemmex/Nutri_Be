-- Migration 1: Convert all native MySQL ENUM columns to VARCHAR
-- Created at: 2026-10-26 12:00:00
-- Purpose: Decouple DB storage from TypeScript Enums. Adding new enum values will never require DB DDL locks.

-- 1. Table: benh_nhan
ALTER TABLE `benh_nhan` MODIFY COLUMN `gioi_tinh` VARCHAR(20) NOT NULL;

-- 2. Table: bua_an
ALTER TABLE `bua_an` MODIFY COLUMN `trang_thai` VARCHAR(50) DEFAULT 'RIENG_TU';

-- 3. Table: dang_ky
ALTER TABLE `dang_ky` MODIFY COLUMN `trang_thai` VARCHAR(50) NOT NULL;

-- 4. Table: dang_ky_cho_xac_thuc
ALTER TABLE `dang_ky_cho_xac_thuc` MODIFY COLUMN `gioi_tinh` VARCHAR(20) DEFAULT NULL;

-- 5. Table: de_xuat_nguyen_lieu
ALTER TABLE `de_xuat_nguyen_lieu` 
  MODIFY COLUMN `loai_de_xuat` VARCHAR(50) NOT NULL,
  MODIFY COLUMN `loai_protein` VARCHAR(50) DEFAULT NULL,
  MODIFY COLUMN `trang_thai` VARCHAR(50) NOT NULL;

-- 6. Table: de_xuat_thuc_don
ALTER TABLE `de_xuat_thuc_don` 
  MODIFY COLUMN `loai_doi_tuong` VARCHAR(50) NOT NULL,
  MODIFY COLUMN `loai_thuc_don` VARCHAR(50) NOT NULL,
  MODIFY COLUMN `trang_thai` VARCHAR(50) NOT NULL;

-- 7. Table: gioi_han_dinh_duong
ALTER TABLE `gioi_han_dinh_duong` MODIFY COLUMN `canh_bao` VARCHAR(50) DEFAULT NULL;

-- 8. Table: goi
ALTER TABLE `goi` MODIFY COLUMN `trang_thai` VARCHAR(50) NOT NULL;

-- 9. Table: ho_so_ca_nhan
ALTER TABLE `ho_so_ca_nhan` MODIFY COLUMN `gioi_tinh` VARCHAR(20) DEFAULT NULL;

-- 10. Table: khau_phan_24h
ALTER TABLE `khau_phan_24h` MODIFY COLUMN `kieu_nhap` VARCHAR(50) NOT NULL;

-- 11. Table: mon_an
ALTER TABLE `mon_an` MODIFY COLUMN `trang_thai` VARCHAR(50) DEFAULT 'RIENG_TU';

-- 12. Table: nguoi_dung
ALTER TABLE `nguoi_dung` 
  MODIFY COLUMN `vai_tro` VARCHAR(50) NOT NULL DEFAULT 'USER',
  MODIFY COLUMN `kenh` VARCHAR(50) DEFAULT 'LOCAL';

-- 13. Table: nguyen_lieu
ALTER TABLE `nguyen_lieu` 
  MODIFY COLUMN `loai_protein` VARCHAR(50) DEFAULT NULL,
  MODIFY COLUMN `trang_thai` VARCHAR(50) DEFAULT NULL;

-- 14. Table: thiet_bi_dang_nhap
ALTER TABLE `thiet_bi_dang_nhap` MODIFY COLUMN `device_type` VARCHAR(50) DEFAULT NULL;

-- 15. Table: thuc_don
ALTER TABLE `thuc_don` 
  MODIFY COLUMN `loai_doi_tuong` VARCHAR(50) NOT NULL,
  MODIFY COLUMN `loai_thuc_don` VARCHAR(50) NOT NULL;

-- 16. Table: yeu_cau_thanh_toan
ALTER TABLE `yeu_cau_thanh_toan` MODIFY COLUMN `trang_thai` VARCHAR(50) NOT NULL;
