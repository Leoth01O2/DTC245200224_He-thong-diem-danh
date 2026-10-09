-- Database schema for Attendance System
-- Character set and collation: UTF8MB4 for full Vietnamese support

CREATE DATABASE IF NOT EXISTS attendance_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE attendance_db;

-- 1. Table users: Quản trị viên hệ thống
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Table members: Sinh viên / Nhân viên cần điểm danh
-- Cột code đã là UNIQUE (tự động có UNIQUE index), không tạo thêm index trùng lặp
CREATE TABLE IF NOT EXISTS members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NULL,
    department VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_member_name (full_name),
    INDEX idx_member_department (department)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Table shifts: Ca học / Ca làm việc
CREATE TABLE IF NOT EXISTS shifts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    late_after_minutes INT NOT NULL DEFAULT 15,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Table attendance: Lịch sử điểm danh thực tế
CREATE TABLE IF NOT EXISTS attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    member_id INT NOT NULL,
    shift_id INT NOT NULL,
    attendance_date DATE NOT NULL,
    check_in TIME NULL,
    check_out TIME NULL,
    status ENUM('on_time', 'late') NOT NULL DEFAULT 'on_time',
    notes VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_member_shift_date UNIQUE (member_id, shift_id, attendance_date),
    CONSTRAINT fk_attendance_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE RESTRICT,
    CONSTRAINT fk_attendance_shift FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE RESTRICT,
    INDEX idx_attendance_date (attendance_date),
    INDEX idx_attendance_member (member_id),
    INDEX idx_attendance_shift (shift_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Table sessions: Lưu trữ phiên đăng nhập server-side cho express-mysql-session
CREATE TABLE IF NOT EXISTS sessions (
    session_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL PRIMARY KEY,
    expires INT(11) UNSIGNED NOT NULL,
    data MEDIUMTEXT COLLATE utf8mb4_bin,
    INDEX idx_sessions_expires (expires)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- SEED DATA MẪU (Demo ban đầu)
-- Seed ca học / ca làm việc
INSERT INTO shifts (name, start_time, end_time, late_after_minutes) VALUES
('Ca Sáng (08:00 - 12:00)', '08:00:00', '12:00:00', 15),
('Ca Chiều (13:30 - 17:30)', '13:30:00', '17:30:00', 15),
('Ca Tối (18:00 - 21:00)', '18:00:00', '21:00:00', 10)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Seed danh sách thành viên (sinh viên / nhân viên)
INSERT INTO members (code, full_name, email, department) VALUES
('SV001', 'Nguyễn Văn An', 'an.nguyen@example.com', 'Công nghệ Thông tin'),
('SV002', 'Trần Thị Bình', 'binh.tran@example.com', 'Công nghệ Thông tin'),
('SV003', 'Lê Hoàng Cường', 'cuong.le@example.com', 'Khoa học Máy tính'),
('SV004', 'Phạm Minh Đức', 'duc.pham@example.com', 'Hệ thống Thông tin'),
('SV005', 'Võ Thị Hoa', 'hoa.vo@example.com', 'Mạng máy tính và An toàn TT')
ON DUPLICATE KEY UPDATE code=VALUES(code);
