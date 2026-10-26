-- CreateTable
CREATE TABLE `_system_jobs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `queue_name` VARCHAR(50) NOT NULL,
    `payload` LONGTEXT NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `max_attempts` INTEGER NOT NULL DEFAULT 3,
    `run_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `priority` INTEGER NOT NULL DEFAULT 0,
    `locked_by` VARCHAR(100) NULL,
    `locked_at` DATETIME(6) NULL,
    `last_error` TEXT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL,

    INDEX `idx_system_jobs_status_run_pri`(`status`, `run_at`, `priority`),
    INDEX `idx_system_jobs_queue_status`(`queue_name`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_system_jobs_dlq` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `original_job_id` BIGINT NOT NULL,
    `queue_name` VARCHAR(50) NOT NULL,
    `payload` LONGTEXT NOT NULL,
    `error_stack` TEXT NULL,
    `failed_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `idx_dlq_queue_failed`(`queue_name`, `failed_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_system_sequences` (
    `name` VARCHAR(50) NOT NULL,
    `current_val` BIGINT NOT NULL DEFAULT 0,
    `updated_at` DATETIME(6) NOT NULL,

    PRIMARY KEY (`name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_system_cache` (
    `cache_key` VARCHAR(255) NOT NULL,
    `cache_value` LONGTEXT NOT NULL,
    `tag` VARCHAR(100) NULL,
    `expires_at` DATETIME(6) NOT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `idx_cache_key_exp`(`cache_key`, `expires_at`),
    INDEX `idx_cache_tag`(`tag`),
    PRIMARY KEY (`cache_key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `benh_nhan` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `nguoi_dung_id` CHAR(36) NOT NULL,
    `ho_ten` VARCHAR(255) NOT NULL,
    `so_dien_thoai` VARCHAR(20) NULL,
    `ngay_sinh` DATE NULL,
    `gioi_tinh` ENUM('NAM', 'NU') NOT NULL,
    `can_nang` DOUBLE NULL,
    `chieu_cao` DOUBLE NULL,
    `ghi_chu` TEXT NULL,
    `he_so_hoat_dong` DOUBLE NULL,
    `ma_benh_nhan_bv` VARCHAR(255) NULL,
    `tao_luc` DATETIME(6) NULL,
    `chi_nam_sinh` BIT(1) NULL,

    INDEX `benh_nhan_ibfk_1`(`nguoi_dung_id`),
    INDEX `idx_patient_user_name`(`nguoi_dung_id`, `ho_ten`),
    INDEX `idx_patient_phone`(`so_dien_thoai`),
    INDEX `idx_patient_bv_code`(`ma_benh_nhan_bv`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bua_an` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `nguoi_dung_id` CHAR(36) NOT NULL,
    `ten_bua_an` VARCHAR(255) NULL,
    `gio_an` VARCHAR(50) NOT NULL,
    `trang_thai` ENUM('RIENG_TU', 'CHO_DUYET', 'DA_DUYET', 'TU_CHOI') NULL DEFAULT 'RIENG_TU',
    `la_cong_khai` BOOLEAN NULL DEFAULT false,

    INDEX `bua_an_ibfk_1`(`nguoi_dung_id`),
    INDEX `idx_meal_user_status`(`nguoi_dung_id`, `trang_thai`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chi_tiet_bua_an` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `bua_an_id` BIGINT NOT NULL,
    `mon_an_id` BIGINT NOT NULL,
    `he_so_song_chin` DOUBLE NULL,

    INDEX `bua_an_id`(`bua_an_id`),
    INDEX `mon_an_id`(`mon_an_id`),
    UNIQUE INDEX `uk_meal_dish`(`bua_an_id`, `mon_an_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chi_tiet_mon_an` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `mon_an_id` BIGINT NOT NULL,
    `nguyen_lieu_id` BIGINT NOT NULL,
    `khoi_luong_song_sach` DOUBLE NULL,

    INDEX `FKfkf5e70sxg3d4f90312mdcxke`(`nguyen_lieu_id`),
    INDEX `mon_an_id`(`mon_an_id`),
    UNIQUE INDEX `uk_dish_ingredient`(`mon_an_id`, `nguyen_lieu_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chi_tiet_thuc_don` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `thuc_don_id` BIGINT NOT NULL,
    `bua_an_id` BIGINT NOT NULL,
    `so_tuan` TINYINT NULL,
    `thu_tu_trong_tuan` TINYINT NULL,
    `thu_trong_tuan` TINYINT NULL,

    INDEX `bua_an_id`(`bua_an_id`),
    INDEX `thuc_don_id`(`thuc_don_id`),
    INDEX `idx_menu_detail_week_day`(`thuc_don_id`, `so_tuan`, `thu_trong_tuan`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dang_ky` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `nguoi_dung_id` CHAR(36) NOT NULL,
    `ma_goi` VARCHAR(50) NOT NULL,
    `ngay_bat_dau` DATETIME(0) NOT NULL,
    `ngay_ket_thuc` DATETIME(0) NOT NULL,
    `trang_thai` ENUM('ACTIVE', 'EXPIRED') NOT NULL,
    `thanh_toan_id` BIGINT NULL,

    INDEX `idx_dang_ky_user_status_end`(`nguoi_dung_id`, `trang_thai`, `ngay_ket_thuc`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dang_ky_cho_xac_thuc` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `dia_chi` VARCHAR(255) NULL,
    `created_at` DATETIME(6) NOT NULL,
    `ngay_sinh` DATE NULL,
    `email` VARCHAR(255) NOT NULL,
    `mat_khau_ma_hoa` VARCHAR(512) NOT NULL,
    `expires_at` DATETIME(6) NOT NULL,
    `ho_ten` VARCHAR(255) NULL,
    `gioi_tinh` ENUM('NAM', 'NU') NULL,
    `phone` VARCHAR(255) NULL,
    `token_hash` VARCHAR(64) NOT NULL,
    `ten_dang_nhap` VARCHAR(100) NOT NULL,

    UNIQUE INDEX `UK_ab8mb59mlyohva6oewekv3vof`(`token_hash`),
    INDEX `idx_pending_email`(`email`),
    INDEX `idx_pending_expires`(`expires_at`),
    INDEX `idx_pending_username`(`ten_dang_nhap`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `danh_muc` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ten_danh_muc` VARCHAR(255) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `de_xuat_nguyen_lieu` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `ngay_tao` DATETIME(6) NOT NULL,
    `edible` DOUBLE NULL,
    `nguyen_lieu_id` BIGINT NULL,
    `ten_nguyen_lieu` VARCHAR(255) NOT NULL,
    `loai_protein` ENUM('THUC_VAT', 'DONG_VAT') NULL,
    `ghi_chu` TEXT NULL,
    `gia_tri_dinh_duong_json` TEXT NOT NULL,
    `loai_de_xuat` ENUM('ADD', 'UPDATE') NOT NULL,
    `ly_do_tu_choi` TEXT NULL,
    `ngay_duyet` DATETIME(6) NULL,
    `trang_thai` ENUM('RIENG_TU', 'CHO_DUYET', 'DA_DUYET', 'TU_CHOI') NOT NULL,
    `danh_muc` INTEGER NOT NULL,
    `nguoi_tao_id` CHAR(36) NOT NULL,
    `nguoi_duyet_id` CHAR(36) NULL,
    `gia_tri_dinh_duong_cu_json` TEXT NULL,

    INDEX `FK442it118nspyay7dhwwb18vxt`(`nguoi_duyet_id`),
    INDEX `FK950tlv8lq2qa531ipi8hsc8kk`(`danh_muc`),
    INDEX `FKmsprows787btecd7rt3c5ks5w`(`nguoi_tao_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `de_xuat_thuc_don` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `ngay_phe_duyet` DATETIME(6) NULL,
    `ngay_tao` DATETIME(6) NULL,
    `ten_thuc_don` VARCHAR(255) NOT NULL,
    `loai_thuc_don` ENUM('NGAY', 'TUAN', 'THANG') NOT NULL,
    `ly_do_tu_choi` TEXT NULL,
    `snapshot_json` LONGTEXT NOT NULL,
    `trang_thai` ENUM('RIENG_TU', 'CHO_DUYET', 'DA_DUYET', 'TU_CHOI') NOT NULL,
    `loai_doi_tuong` ENUM('BENH_NHAN', 'NHOM_BENH') NOT NULL,
    `tong_nang_luong` VARCHAR(255) NULL,
    `nguoi_phe_duyet_id` CHAR(36) NULL,
    `nguoi_de_xuat_id` CHAR(36) NULL,
    `nhom_benh_id` INTEGER NULL,
    `gioi_han_dinh_duong_id` BIGINT NULL,
    `menu_goc_id` BIGINT NOT NULL,
    `benh_nhan_id` BIGINT NULL,

    INDEX `FK3c3jeeklf8w6abyvu3fo9oeyq`(`benh_nhan_id`),
    INDEX `FKbtfihw33e5fdwirtfg657reu1`(`nhom_benh_id`),
    INDEX `FKjo9oihpixfe1p3r7dpca8j3w3`(`gioi_han_dinh_duong_id`),
    INDEX `FKrjw7ecrik8d6un29gfydh4dop`(`nguoi_phe_duyet_id`),
    INDEX `FKsncx10fbcqx5g9u4gv7fssepl`(`nguoi_de_xuat_id`),
    INDEX `FKtev5mo1ui2jqgbxxoohv4w27x`(`menu_goc_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `gioi_han_dinh_duong` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `ngay_tao` DATETIME(6) NULL,
    `gioi_han_json` JSON NULL,
    `ten_gioi_han` VARCHAR(255) NULL,
    `ngay_cap_nhat` DATETIME(6) NULL,
    `canh_bao` ENUM('OFF', 'GTE_5', 'GTE_10') NULL,
    `nguoi_dung_id` CHAR(36) NULL,
    `tai_su_dung` BIT(1) NOT NULL,

    INDEX `FKrhy3b2j8ghm5kkh86dya7djfb`(`nguoi_dung_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `goi` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `ma_goi` VARCHAR(50) NOT NULL,
    `ten_goi` VARCHAR(255) NOT NULL,
    `so_ngay_su_dung` INTEGER NOT NULL,
    `gia_tien` DECIMAL(15, 2) NOT NULL,
    `mo_ta` TEXT NULL,
    `trang_thai` ENUM('ACTIVE', 'INACTIVE') NOT NULL,
    `ngay_tao` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `ngay_cap_nhat` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `ma_goi`(`ma_goi`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `he_so_song_chin` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `nguyen_lieu_id` BIGINT NULL,
    `phuong_phap_che_bien` VARCHAR(255) NULL,
    `he_so` DOUBLE NULL,
    `is_public` BIT(1) NULL,
    `nguoi_dung_id` CHAR(36) NULL,

    INDEX `FKbp142ea7u0i1tlprly2e82jxm`(`nguoi_dung_id`),
    INDEX `fk_he_so_song_chin_nguyen_lieu`(`nguyen_lieu_id`),
    INDEX `idx_coeff_ing_method`(`nguyen_lieu_id`, `phuong_phap_che_bien`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ho_so_ca_nhan` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `nguoi_dung_id` CHAR(36) NULL,
    `ho_ten` VARCHAR(255) NULL,
    `ngay_sinh` DATE NULL,
    `gioi_tinh` ENUM('NAM', 'NU') NULL,
    `dia_chi` VARCHAR(255) NULL,
    `email` VARCHAR(255) NULL,
    `phone` VARCHAR(255) NULL,
    `created_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `nguoi_dung_id`(`nguoi_dung_id`),
    INDEX `idx_profile_email`(`email`),
    INDEX `idx_profile_phone`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `huong_dan_dinh_duong` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `ma_ky_hieu` VARCHAR(255) NOT NULL,
    `co_cau_khau_phan` JSON NULL,
    `ten_benh` VARCHAR(255) NOT NULL,
    `luu_y` TEXT NULL,
    `nguyen_tac` TEXT NULL,
    `nguoi_dung_id` CHAR(36) NULL,

    UNIQUE INDEX `UK_c12m565jgtwbc5hrivj191sf7`(`ma_ky_hieu`),
    INDEX `FK24pmrtr8iqg05h0wr90a5g88v`(`nguoi_dung_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `khau_phan_24h` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `tao_luc` DATETIME(6) NULL,
    `ngay_an` DATE NOT NULL,
    `ghi_chu` VARCHAR(255) NULL,
    `benh_nhan_id` BIGINT NOT NULL,
    `nguoi_dung_id` CHAR(36) NULL,
    `kieu_nhap` ENUM('INGREDIENT_ONLY', 'BY_MEAL') NOT NULL,

    INDEX `FKqt7efogms7js35qdvp3rfrct8`(`nguoi_dung_id`),
    INDEX `idx_intake_user_date`(`nguoi_dung_id`, `ngay_an`),
    UNIQUE INDEX `UKmscxxi0es7bbg73tw1iwb2lnt`(`benh_nhan_id`, `ngay_an`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `khau_phan_24h_bua_an` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `ten_bua` VARCHAR(255) NULL,
    `thu_tu_bua` INTEGER NOT NULL,
    `khau_phan_24h_id` BIGINT NOT NULL,
    `gio_an` VARCHAR(50) NULL,

    INDEX `FKfdwggqcjm9js81ccolmy1r605`(`khau_phan_24h_id`),
    INDEX `idx_intake_meal_order`(`khau_phan_24h_id`, `thu_tu_bua`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `khau_phan_24h_nguyen_lieu` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `nguyen_lieu_id` BIGINT NOT NULL,
    `khoi_luong_song_sach` DOUBLE NOT NULL,
    `khau_phan_24h_bua_an_id` BIGINT NOT NULL,

    INDEX `FK1ma9vy4almn90vk0qt5n0akar`(`khau_phan_24h_bua_an_id`),
    INDEX `FKk2t76jv540wnc38in39johnx5`(`nguyen_lieu_id`),
    INDEX `idx_intake_meal_ing`(`khau_phan_24h_bua_an_id`, `nguyen_lieu_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lich_su_dang_nhap` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `ip_address` VARCHAR(100) NULL,
    `login_time` DATETIME(6) NOT NULL,
    `logout_time` DATETIME(6) NULL,
    `session_id` VARCHAR(100) NULL,
    `device_id` BIGINT NULL,
    `nguoi_dung_id` CHAR(36) NOT NULL,

    INDEX `FKqe2qpqvfbbkwm23w03pl76yg5`(`nguoi_dung_id`),
    INDEX `FKrnkchmjhb2cxhlqb3ffc45tww`(`device_id`),
    INDEX `idx_login_session_id`(`session_id`),
    INDEX `idx_login_user_time`(`nguoi_dung_id`, `login_time` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ma_xac_thuc` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `ngay_het_han` DATETIME(6) NOT NULL,
    `ma_token` VARCHAR(64) NOT NULL,
    `nguoi_dung_id` VARCHAR(30) NOT NULL,

    UNIQUE INDEX `UK_p64rs7v4dlvxghardweeqwyfe`(`ma_token`),
    UNIQUE INDEX `UK_teim564lcp9scxbslwa55twu3`(`nguoi_dung_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `minh_chung` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `bucket_name` VARCHAR(255) NULL,
    `link_ngoai` TEXT NULL,
    `dung_luong` BIGINT NULL,
    `mime_type` VARCHAR(255) NULL,
    `object_key` VARCHAR(255) NULL,
    `ten_file_goc` VARCHAR(255) NULL,
    `ngay_upload` DATETIME(6) NOT NULL,
    `de_xuat_id` BIGINT NULL,
    `nguoi_upload_id` CHAR(36) NOT NULL,
    `yeu_cau_id` BIGINT NULL,

    INDEX `FKlywjnrhx8eem203vry3jvcg5v`(`yeu_cau_id`),
    INDEX `FKo7m6qmwpnrs09t6q5hrytlhov`(`nguoi_upload_id`),
    INDEX `FKp5i387oficedotfi0a3brr9oh`(`de_xuat_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mon_an` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `nguoi_dung_id` CHAR(36) NULL,
    `ten_mon` VARCHAR(255) NOT NULL,
    `trang_thai` ENUM('RIENG_TU', 'CHO_DUYET', 'DA_DUYET', 'TU_CHOI', 'HE_THONG') NULL DEFAULT 'RIENG_TU',
    `mon_goc_id` BIGINT NULL,
    `ly_do_tu_choi` TEXT NULL,
    `ngay_phe_duyet` DATETIME(6) NULL,
    `ngay_tao` DATETIME(6) NULL,
    `nguoi_phe_duyet_id` CHAR(36) NULL,
    `recipe_hash` VARCHAR(64) NULL,

    INDEX `FKtii3dvuoo8lxj35dwn1uknt9e`(`nguoi_phe_duyet_id`),
    INDEX `fk_mon_an_goc`(`mon_goc_id`),
    INDEX `idx_mon_an_recipe_hash`(`recipe_hash`),
    INDEX `mon_an_ibfk_1`(`nguoi_dung_id`),
    INDEX `idx_dish_user_status_created`(`nguoi_dung_id`, `trang_thai`, `ngay_tao` DESC),
    INDEX `idx_dish_status_created`(`trang_thai`, `ngay_tao` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `nguoi_de_xuat` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `nguoi_dung_id` CHAR(36) NOT NULL,
    `trinh_do_hoc_van` VARCHAR(100) NULL,
    `nghe_nghiep` VARCHAR(100) NULL,
    `don_vi_cong_tac` VARCHAR(255) NULL,
    `vi_tri_cong_tac` VARCHAR(255) NULL,
    `linh_vuc_cong_tac` VARCHAR(100) NULL,

    UNIQUE INDEX `nguoi_dung_id`(`nguoi_dung_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `nguoi_dung` (
    `id` CHAR(36) NOT NULL,
    `ten_dang_nhap` VARCHAR(255) NOT NULL,
    `mat_khau` VARCHAR(255) NULL,
    `vai_tro` ENUM('USER', 'USERPRO', 'SUPERADMIN', 'ADMIN') NOT NULL,
    `kenh` ENUM('LOCAL', 'FACEBOOK', 'KEYCLOAK_GOOGLE') NULL,
    `id_kenh` VARCHAR(100) NULL,
    `active` BIT(1) NOT NULL,
    `keycloak_user_id` VARCHAR(255) NULL,
    `created_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `pro_expired_at` DATETIME(6) NULL,
    `profile_completed` BIT(1) NOT NULL,

    INDEX `idx_user_role_exp`(`vai_tro`, `pro_expired_at`),
    INDEX `idx_user_created_at`(`created_at`),
    UNIQUE INDEX `uk_nguoi_dung_username`(`ten_dang_nhap`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `nguyen_lieu` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `ten_nguyen_lieu` VARCHAR(255) NOT NULL,
    `danh_muc` INTEGER NULL,
    `edible` DOUBLE NULL,
    `water` DOUBLE NULL,
    `protein` DOUBLE NULL,
    `fat` DOUBLE NULL,
    `fiber` DOUBLE NULL,
    `ash` DOUBLE NULL,
    `calci` DOUBLE NULL,
    `phosphorous` DOUBLE NULL,
    `iron` DOUBLE NULL,
    `zinc` DOUBLE NULL,
    `sodium` DOUBLE NULL,
    `potassium` DOUBLE NULL,
    `magnesium` DOUBLE NULL,
    `manganese` DOUBLE NULL,
    `copper` DOUBLE NULL,
    `selenium` DOUBLE NULL,
    `vitaminC` DOUBLE NULL,
    `thiamine` DOUBLE NULL,
    `riboflavin` DOUBLE NULL,
    `niacin` DOUBLE NULL,
    `pantothenicAcid` DOUBLE NULL,
    `vitaminB6` DOUBLE NULL,
    `folate` DOUBLE NULL,
    `folicAcid` DOUBLE NULL,
    `biotin` DOUBLE NULL,
    `vitaminB12` DOUBLE NULL,
    `retinol` DOUBLE NULL,
    `vitaminD` DOUBLE NULL,
    `vitaminE` DOUBLE NULL,
    `vitaminK` DOUBLE NULL,
    `betaCarotene` DOUBLE NULL,
    `alphaCarotene` DOUBLE NULL,
    `betaCryptoxanthin` DOUBLE NULL,
    `lycopene` DOUBLE NULL,
    `luteinZeaxanthin` DOUBLE NULL,
    `isoflavoneTongSo` DOUBLE NULL,
    `daidzein` DOUBLE NULL,
    `genistein` DOUBLE NULL,
    `glycetin` DOUBLE NULL,
    `purine` DOUBLE NULL,
    `tsAxitBeoNo` DOUBLE NULL,
    `palmitic` DOUBLE NULL,
    `margaric` DOUBLE NULL,
    `stearic` DOUBLE NULL,
    `arachidic` DOUBLE NULL,
    `behenic` DOUBLE NULL,
    `lignoceric` DOUBLE NULL,
    `tsAxitBeoKhongNo1NoiDoi` DOUBLE NULL,
    `myristoleic` DOUBLE NULL,
    `palmitoleic` DOUBLE NULL,
    `oleic` DOUBLE NULL,
    `tsAxitBeoKhongNoNhieuNoiDoi` DOUBLE NULL,
    `linoleic` DOUBLE NULL,
    `linolenic` DOUBLE NULL,
    `arachidonic` DOUBLE NULL,
    `epa` DOUBLE NULL,
    `dha` DOUBLE NULL,
    `tsAxitBeoTrans` DOUBLE NULL,
    `cholesterol` DOUBLE NULL,
    `phytosterol` DOUBLE NULL,
    `lysin` DOUBLE NULL,
    `methionin` DOUBLE NULL,
    `tryptophan` DOUBLE NULL,
    `phenylalanin` DOUBLE NULL,
    `threonin` DOUBLE NULL,
    `valine` DOUBLE NULL,
    `leucine` DOUBLE NULL,
    `isoleucine` DOUBLE NULL,
    `arginine` DOUBLE NULL,
    `histidine` DOUBLE NULL,
    `cystine` DOUBLE NULL,
    `tyrosine` DOUBLE NULL,
    `alanine` DOUBLE NULL,
    `asparticAcid` DOUBLE NULL,
    `glutamicAcid` DOUBLE NULL,
    `glycine` DOUBLE NULL,
    `proline` DOUBLE NULL,
    `serine` DOUBLE NULL,
    `loai_protein` ENUM('DONG_VAT', 'THUC_VAT') NULL,
    `tao_boi_id` CHAR(36) NULL,
    `trang_thai` ENUM('CHO_DUYET', 'DA_DUYET', 'TU_CHOI') NULL,

    INDEX `danh_muc`(`danh_muc`),
    INDEX `tao_boi_id`(`tao_boi_id`),
    INDEX `idx_ing_status_cat_name`(`trang_thai`, `danh_muc`, `ten_nguyen_lieu`),
    INDEX `idx_ing_creator_status`(`tao_boi_id`, `trang_thai`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `nhom_benh` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ma_nhom` VARCHAR(10) NULL,
    `ten_nhom` VARCHAR(255) NULL,

    UNIQUE INDEX `ma_nhom`(`ma_nhom`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `nhom_benh_mo_rong` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ma_nhom_mo_rong` VARCHAR(20) NULL,
    `ten_hien_thi` VARCHAR(255) NULL,
    `nguoi_dung_id` CHAR(36) NULL,
    `ma_nhom_cha` INTEGER NULL,

    INDEX `FKm7btvfmi36owyphlk7re5v4y2`(`ma_nhom_cha`),
    INDEX `bac_si_id`(`nguoi_dung_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `thiet_bi_dang_nhap` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `created_at` DATETIME(6) NOT NULL,
    `device_hash` VARCHAR(64) NOT NULL,
    `device_name` VARCHAR(255) NULL,
    `device_type` ENUM('WEB', 'ANDROID', 'IOS', 'DESKTOP', 'TABLET', 'POSTMAN', 'UNKNOWN') NULL,
    `is_active` BIT(1) NOT NULL,
    `updated_at` DATETIME(6) NULL,
    `user_agent` VARCHAR(500) NULL,
    `nguoi_dung_id` CHAR(36) NOT NULL,

    INDEX `FK2uvu7lv3uj4ioedbf8wl2jt11`(`nguoi_dung_id`),
    UNIQUE INDEX `uk_user_device_hash`(`nguoi_dung_id`, `device_hash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `thuc_don` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `nguoi_dung_id` CHAR(36) NOT NULL,
    `ten_thuc_don` VARCHAR(255) NOT NULL,
    `loai_thuc_don` ENUM('NGAY', 'TUAN', 'THANG') NOT NULL,
    `loai_doi_tuong` ENUM('BENH_NHAN', 'NHOM_BENH') NOT NULL,
    `benh_nhan_id` BIGINT NULL,
    `nhom_benh_id` INTEGER NULL,
    `ngay_tao` DATE NULL,
    `tong_nang_luong` VARCHAR(255) NULL,
    `gioi_han_dinh_duong_id` BIGINT NULL,

    INDEX `FKf6w6c6rdroab1wvpd77q5aggu`(`gioi_han_dinh_duong_id`),
    INDEX `benh_nhan_id`(`benh_nhan_id`),
    INDEX `fk_thuc_don_nhom_benh_mo_rong`(`nhom_benh_id`),
    INDEX `thuc_don_ibfk_1`(`nguoi_dung_id`),
    INDEX `idx_menu_user_type_created`(`nguoi_dung_id`, `loai_thuc_don`, `ngay_tao` DESC),
    INDEX `idx_menu_patient_created`(`benh_nhan_id`, `ngay_tao` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `yeu_cau_thanh_toan` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `nguoi_dung_id` CHAR(36) NOT NULL,
    `ma_goi` VARCHAR(50) NOT NULL,
    `ten_goi` VARCHAR(255) NOT NULL,
    `so_ngay_su_dung` INTEGER NOT NULL,
    `so_tien` DECIMAL(15, 2) NOT NULL,
    `trang_thai` ENUM('APPROVED', 'REJECTED', 'PENDING') NOT NULL,
    `ly_do_tu_choi` TINYTEXT NULL,
    `ngay_tao` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `ngay_phe_duyet` DATETIME(0) NULL,
    `nguoi_phe_duyet_id` CHAR(36) NULL,
    `ma_giao_dich` VARCHAR(50) NOT NULL,

    UNIQUE INDEX `UK_ehthwii962vn7vns2m3hw6ows`(`ma_giao_dich`),
    INDEX `FKsn2jkdkl35fi3wlnsxefqwhtq`(`nguoi_phe_duyet_id`),
    INDEX `idx_yc_ma_giao_dich`(`ma_giao_dich`),
    INDEX `idx_yc_ngay_tao`(`ngay_tao`),
    INDEX `idx_yc_nguoi_dung`(`nguoi_dung_id`),
    INDEX `idx_yc_trang_thai`(`trang_thai`),
    INDEX `idx_payment_status_created`(`trang_thai`, `ngay_tao` DESC),
    INDEX `idx_payment_user_created`(`nguoi_dung_id`, `ngay_tao` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `benh_nhan` ADD CONSTRAINT `benh_nhan_ibfk_1` FOREIGN KEY (`nguoi_dung_id`) REFERENCES `nguoi_dung`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `bua_an` ADD CONSTRAINT `bua_an_ibfk_1` FOREIGN KEY (`nguoi_dung_id`) REFERENCES `nguoi_dung`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `chi_tiet_bua_an` ADD CONSTRAINT `chi_tiet_bua_an_ibfk_1` FOREIGN KEY (`bua_an_id`) REFERENCES `bua_an`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `chi_tiet_bua_an` ADD CONSTRAINT `chi_tiet_bua_an_ibfk_2` FOREIGN KEY (`mon_an_id`) REFERENCES `mon_an`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `chi_tiet_mon_an` ADD CONSTRAINT `chi_tiet_mon_an_ibfk_1` FOREIGN KEY (`mon_an_id`) REFERENCES `mon_an`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `chi_tiet_mon_an` ADD CONSTRAINT `chi_tiet_mon_an_ibfk_2` FOREIGN KEY (`nguyen_lieu_id`) REFERENCES `nguyen_lieu`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `chi_tiet_thuc_don` ADD CONSTRAINT `chi_tiet_thuc_don_ibfk_1` FOREIGN KEY (`thuc_don_id`) REFERENCES `thuc_don`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `chi_tiet_thuc_don` ADD CONSTRAINT `chi_tiet_thuc_don_ibfk_2` FOREIGN KEY (`bua_an_id`) REFERENCES `bua_an`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `de_xuat_nguyen_lieu` ADD CONSTRAINT `FK442it118nspyay7dhwwb18vxt` FOREIGN KEY (`nguoi_duyet_id`) REFERENCES `nguoi_dung`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `de_xuat_nguyen_lieu` ADD CONSTRAINT `FK950tlv8lq2qa531ipi8hsc8kk` FOREIGN KEY (`danh_muc`) REFERENCES `danh_muc`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `de_xuat_nguyen_lieu` ADD CONSTRAINT `FKmsprows787btecd7rt3c5ks5w` FOREIGN KEY (`nguoi_tao_id`) REFERENCES `nguoi_dung`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `de_xuat_thuc_don` ADD CONSTRAINT `FK3c3jeeklf8w6abyvu3fo9oeyq` FOREIGN KEY (`benh_nhan_id`) REFERENCES `benh_nhan`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `de_xuat_thuc_don` ADD CONSTRAINT `FKbtfihw33e5fdwirtfg657reu1` FOREIGN KEY (`nhom_benh_id`) REFERENCES `nhom_benh_mo_rong`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `de_xuat_thuc_don` ADD CONSTRAINT `FKjo9oihpixfe1p3r7dpca8j3w3` FOREIGN KEY (`gioi_han_dinh_duong_id`) REFERENCES `gioi_han_dinh_duong`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `de_xuat_thuc_don` ADD CONSTRAINT `FKrjw7ecrik8d6un29gfydh4dop` FOREIGN KEY (`nguoi_phe_duyet_id`) REFERENCES `nguoi_dung`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `de_xuat_thuc_don` ADD CONSTRAINT `FKsncx10fbcqx5g9u4gv7fssepl` FOREIGN KEY (`nguoi_de_xuat_id`) REFERENCES `nguoi_dung`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `de_xuat_thuc_don` ADD CONSTRAINT `FKtev5mo1ui2jqgbxxoohv4w27x` FOREIGN KEY (`menu_goc_id`) REFERENCES `thuc_don`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `gioi_han_dinh_duong` ADD CONSTRAINT `FKrhy3b2j8ghm5kkh86dya7djfb` FOREIGN KEY (`nguoi_dung_id`) REFERENCES `nguoi_dung`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `he_so_song_chin` ADD CONSTRAINT `FKbp142ea7u0i1tlprly2e82jxm` FOREIGN KEY (`nguoi_dung_id`) REFERENCES `nguoi_dung`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `he_so_song_chin` ADD CONSTRAINT `fk_he_so_song_chin_nguyen_lieu` FOREIGN KEY (`nguyen_lieu_id`) REFERENCES `nguyen_lieu`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `ho_so_ca_nhan` ADD CONSTRAINT `ho_so_ca_nhan_ibfk_1` FOREIGN KEY (`nguoi_dung_id`) REFERENCES `nguoi_dung`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `huong_dan_dinh_duong` ADD CONSTRAINT `FK24pmrtr8iqg05h0wr90a5g88v` FOREIGN KEY (`nguoi_dung_id`) REFERENCES `nguoi_dung`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `khau_phan_24h` ADD CONSTRAINT `FK8aqjtjyd95rlsimqr2f5cosmj` FOREIGN KEY (`benh_nhan_id`) REFERENCES `benh_nhan`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `khau_phan_24h` ADD CONSTRAINT `FKqt7efogms7js35qdvp3rfrct8` FOREIGN KEY (`nguoi_dung_id`) REFERENCES `nguoi_dung`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `khau_phan_24h_bua_an` ADD CONSTRAINT `FKfdwggqcjm9js81ccolmy1r605` FOREIGN KEY (`khau_phan_24h_id`) REFERENCES `khau_phan_24h`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `khau_phan_24h_nguyen_lieu` ADD CONSTRAINT `FK1ma9vy4almn90vk0qt5n0akar` FOREIGN KEY (`khau_phan_24h_bua_an_id`) REFERENCES `khau_phan_24h_bua_an`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `khau_phan_24h_nguyen_lieu` ADD CONSTRAINT `FKk2t76jv540wnc38in39johnx5` FOREIGN KEY (`nguyen_lieu_id`) REFERENCES `nguyen_lieu`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `lich_su_dang_nhap` ADD CONSTRAINT `FKqe2qpqvfbbkwm23w03pl76yg5` FOREIGN KEY (`nguoi_dung_id`) REFERENCES `nguoi_dung`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `lich_su_dang_nhap` ADD CONSTRAINT `FKrnkchmjhb2cxhlqb3ffc45tww` FOREIGN KEY (`device_id`) REFERENCES `thiet_bi_dang_nhap`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `ma_xac_thuc` ADD CONSTRAINT `FKr9iu02dnwlrpl4xkl8ep7pxrw` FOREIGN KEY (`nguoi_dung_id`) REFERENCES `nguoi_dung`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `minh_chung` ADD CONSTRAINT `FKlywjnrhx8eem203vry3jvcg5v` FOREIGN KEY (`yeu_cau_id`) REFERENCES `yeu_cau_thanh_toan`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `minh_chung` ADD CONSTRAINT `FKo7m6qmwpnrs09t6q5hrytlhov` FOREIGN KEY (`nguoi_upload_id`) REFERENCES `nguoi_dung`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `minh_chung` ADD CONSTRAINT `FKp5i387oficedotfi0a3brr9oh` FOREIGN KEY (`de_xuat_id`) REFERENCES `de_xuat_nguyen_lieu`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `mon_an` ADD CONSTRAINT `FKtii3dvuoo8lxj35dwn1uknt9e` FOREIGN KEY (`nguoi_phe_duyet_id`) REFERENCES `nguoi_dung`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `mon_an` ADD CONSTRAINT `fk_mon_an_goc` FOREIGN KEY (`mon_goc_id`) REFERENCES `mon_an`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `mon_an` ADD CONSTRAINT `mon_an_ibfk_1` FOREIGN KEY (`nguoi_dung_id`) REFERENCES `nguoi_dung`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `nguoi_de_xuat` ADD CONSTRAINT `fk_nguoi_de_xuat_nguoi_dung` FOREIGN KEY (`nguoi_dung_id`) REFERENCES `nguoi_dung`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `nguyen_lieu` ADD CONSTRAINT `nguyen_lieu_ibfk_1` FOREIGN KEY (`danh_muc`) REFERENCES `danh_muc`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `nguyen_lieu` ADD CONSTRAINT `nguyen_lieu_ibfk_2` FOREIGN KEY (`tao_boi_id`) REFERENCES `nguoi_dung`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `nhom_benh_mo_rong` ADD CONSTRAINT `FKm7btvfmi36owyphlk7re5v4y2` FOREIGN KEY (`ma_nhom_cha`) REFERENCES `nhom_benh`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `nhom_benh_mo_rong` ADD CONSTRAINT `nhom_benh_mo_rong_ibfk_2` FOREIGN KEY (`nguoi_dung_id`) REFERENCES `nguoi_dung`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `thiet_bi_dang_nhap` ADD CONSTRAINT `FK2uvu7lv3uj4ioedbf8wl2jt11` FOREIGN KEY (`nguoi_dung_id`) REFERENCES `nguoi_dung`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `thuc_don` ADD CONSTRAINT `FKf6w6c6rdroab1wvpd77q5aggu` FOREIGN KEY (`gioi_han_dinh_duong_id`) REFERENCES `gioi_han_dinh_duong`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `thuc_don` ADD CONSTRAINT `fk_thuc_don_nhom_benh_mo_rong` FOREIGN KEY (`nhom_benh_id`) REFERENCES `nhom_benh_mo_rong`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `thuc_don` ADD CONSTRAINT `thuc_don_ibfk_1` FOREIGN KEY (`nguoi_dung_id`) REFERENCES `nguoi_dung`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `thuc_don` ADD CONSTRAINT `thuc_don_ibfk_2` FOREIGN KEY (`benh_nhan_id`) REFERENCES `benh_nhan`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `yeu_cau_thanh_toan` ADD CONSTRAINT `FKsn2jkdkl35fi3wlnsxefqwhtq` FOREIGN KEY (`nguoi_phe_duyet_id`) REFERENCES `nguoi_dung`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `yeu_cau_thanh_toan` ADD CONSTRAINT `FKt8rh702i8c3t2re3tolicnqyh` FOREIGN KEY (`nguoi_dung_id`) REFERENCES `nguoi_dung`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

