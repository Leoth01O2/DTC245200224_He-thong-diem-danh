-- ==============================================================================
-- Migration: 20261017_add_unique_shift_name.sql
-- Mục đích: Đảm bảo tính duy nhất của tên ca làm việc (shifts) ở cấp độ CSDL,
--           xét cả chuẩn hóa khoảng trắng thừa (nhiều khoảng trắng liên tiếp, đầu/cuối)
--           và không phân biệt chữ hoa/thường (thông qua collation utf8mb4_unicode_ci).
--
-- TRẠNG THÁI: REVIEW ONLY (CHỈ DÀNH ĐỂ XEM XÉT / REVIEW - KHÔNG TỰ ĐỘNG TRIỂN KHAI)
-- CẢNH BÁO QUAN TRỌNG:
-- 1. TUYỆT ĐỐI KHÔNG CHẠY FILE NÀY TRÊN CSDL CHÍNH KHI CHƯA XỬ LÝ DỮ LIỆU CŨ.
--    Hiện tại bảng shifts trên CSDL chính đang có 2 ca trùng lặp lịch sử:
--      - id = 10: 'Ca test' (12:00:00 - 12:59:59)
--      - id = 15: 'Ca test' (10:00:00 - 10:01:00)
--    Nếu chạy trực tiếp DDL này trên CSDL chính, MySQL 8.4 sẽ từ chối với lỗi:
--      ERROR 1062 (23000): Duplicate entry 'Ca test' for key 'shifts.uq_shifts_normalized_name'
--
-- 2. TÌNH TRẠNG FRESH DEPLOYMENT:
--    Tập tin khởi tạo `database/init/01-schema-and-seed.sql` hiện tại CHƯA có cột
--    `normalized_name` và ràng buộc UNIQUE này. Đối với các triển khai mới (fresh deployment),
--    tính duy nhất hiện được bảo vệ ở tầng ứng dụng bằng MySQL Advisory Lock
--    (`attendance:shifts:name_unique`). Khi chính thức phê duyệt đưa migration vào sản phẩm,
--    cần đồng bộ cả `01-schema-and-seed.sql` cho fresh install.
-- ==============================================================================

-- ==============================================================================
-- BƯỚC 1: PREFLIGHT CHECK (BẮT BUỘC KIỂM TRA TRƯỚC KHI THỰC HIỆN ALTER TABLE)
-- Kiểm tra phát hiện các ca trùng tên sau khi chuẩn hóa khoảng trắng và hoa/thường.
--
-- LƯU Ý KỸ THUẬT QUAN TRỌNG:
-- Câu lệnh SELECT dưới đây CHỈ mang tính chất phát hiện và thông báo cho người vận hành (DBA).
-- Bản thân câu lệnh SELECT KHÔNG tự động chặn (abort) câu lệnh ALTER TABLE ở Bước 3
-- nếu toàn bộ tập tin migration được chạy tự động theo lô (như mysql < migration.sql).
-- Do đó, người vận hành PHẢI chạy riêng câu lệnh SELECT này trước và xác nhận kết quả trả về
-- là 0 hàng (không có trùng lặp) thì mới được phép thực thi ALTER TABLE ở Bước 3!
-- ==============================================================================
SELECT
    REGEXP_REPLACE(TRIM(name), '[[:space:]]+', ' ') AS normalized_name,
    COUNT(*) AS duplicate_count,
    GROUP_CONCAT(id ORDER BY id ASC) AS conflicting_ids,
    GROUP_CONCAT(name ORDER BY id ASC SEPARATOR ' | ') AS original_names
FROM shifts
GROUP BY REGEXP_REPLACE(TRIM(name), '[[:space:]]+', ' ')
HAVING COUNT(*) > 1;

-- ==============================================================================
-- BƯỚC 2: HƯỚNG DẪN SAO LƯU & XỬ LÝ DỮ LIỆU TRÙNG LẶP AN TOÀN (KHI ĐƯỢC PHÊ DUYỆT)
-- (Lưu ý: Tuyệt đối KHÔNG tự ý chạy trên DB chính trong đợt review này; giữ nguyên dữ liệu 2 ca trùng tên)
-- ==============================================================================
-- 1. Sao lưu bảng shifts và attendance trước khi can thiệp:
--    mysqldump -u <user> -p<pass> attendance_db shifts attendance > backup_shifts_$(date +%Y%m%d_%H%M%S).sql
--
-- 2. Đánh giá dữ liệu tham chiếu trong bảng attendance:
--    SELECT a.shift_id, COUNT(*) AS count_attendance
--    FROM attendance a
--    WHERE a.shift_id IN (10, 15)
--    GROUP BY a.shift_id;
--
-- 3. Xử lý trùng lặp an toàn (Đổi tên ca cũ để phân biệt, không gộp hay xóa dữ liệu điểm danh):
--    UPDATE shifts SET name = 'Ca test (lịch sử)' WHERE id = 15;

-- ==============================================================================
-- BƯỚC 3: DDL ATOMIC - GỘP ADD COLUMN VÀ ADD UNIQUE VÀO MỘT CÂU LỆNH DUY NHẤT
-- Sử dụng 1 câu lệnh ALTER TABLE duy nhất để tránh tình trạng triển khai dở dang
-- (nếu vi phạm UNIQUE thì toàn bộ lệnh sẽ bị hủy, không để lại cột rác).
-- Tương thích hoàn toàn với MySQL 8.4.11 LTS.
-- ==============================================================================
ALTER TABLE `shifts`
    ADD COLUMN `normalized_name` VARCHAR(50)
        GENERATED ALWAYS AS (REGEXP_REPLACE(TRIM(`name`), '[[:space:]]+', ' ')) STORED,
    ADD CONSTRAINT `uq_shifts_normalized_name` UNIQUE (`normalized_name`);

-- ==============================================================================
-- BƯỚC 4: HƯỚNG DẪN ROLLBACK (KHI CẦN HỦY BỎ MIGRATION ĐÃ ÁP DỤNG)
-- Gộp DROP CONSTRAINT và DROP COLUMN vào cùng 1 câu lệnh ALTER TABLE:
-- ==============================================================================
-- ALTER TABLE `shifts`
--     DROP CONSTRAINT `uq_shifts_normalized_name`,
--     DROP COLUMN `normalized_name`;
