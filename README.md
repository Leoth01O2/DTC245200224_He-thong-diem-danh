# Hệ thống Điểm danh (Attendance System) - Đề tài 27

Bài thi kết thúc học phần: **Triển khai và Quản trị Hệ thống Phần mềm**

---

## 1. Giới thiệu tổng quan
Hệ thống Điểm danh (Attendance System) là ứng dụng web cho phép quản lý nhân sự (sinh viên / nhân viên), thiết lập các ca học / ca làm việc và thực hiện điểm danh ra/vào (Check-in / Check-out) thời gian thực. Hệ thống tự động đối chiếu thời gian điểm danh thực tế với quy định ca để xác định trạng thái **Đúng giờ (on_time)** hoặc **Đi muộn (late)**, đồng thời lưu trữ lịch sử điểm danh bền vững trong cơ sở dữ liệu MySQL thật.

---

## 2. Công nghệ sử dụng (Stack)

* **Backend & Web Application:** Node.js 24 LTS, Express 5, EJS Template Engine.
* **Cơ sở dữ liệu:** MySQL 8.4 LTS, Driver `mysql2` (Promise API).
* **Quản trị cơ sở dữ liệu:** phpMyAdmin 5.2.
* **Quản lý phiên (Session):** `express-session` kết hợp `express-mysql-session` (lưu trữ phiên làm việc an toàn trên MySQL).
* **Bảo mật:** `bcryptjs` mã hóa mật khẩu, Nginx Security Headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Content-Security-Policy`), Non-root container (`USER node`).
* **Reverse Proxy:** Nginx 1.30 Alpine.
* **Phương thức triển khai:** Docker Engine & Docker Compose.

---

## 3. Kiến trúc triển khai hiện tại

```text
[ Trình duyệt Client ]
         │
         │ (HTTP Port 80)
         ▼
┌──────────────────┐
│  Nginx :80       │ (Reverse Proxy, Security Headers, Static logs)
└────────┬─────────┘
         │ (Mạng nội bộ frontend_net)
         ▼
┌──────────────────┐
│  Express App     │ (Node.js 24 non-root :3000)
└────────┬─────────┘
         │ (Mạng nội bộ backend_net)
         ▼
┌──────────────────┐
│  MySQL 8.4 DB    │ (Port 3306 nội bộ, không mở ra host)
└────────▲─────────┘
         │ (Mạng nội bộ backend_net)
┌────────┴─────────┐
│  phpMyAdmin      │ (Port 8088: Quản trị Database)
└──────────────────┘
```

* **Phân vùng mạng cô lập (Docker Networks):**
  * `frontend_net`: Nginx kết nối với Express App.
  * `backend_net`: Express App kết nối MySQL và phpMyAdmin kết nối MySQL. Nginx không truy cập trực tiếp vào cơ sở dữ liệu.
* **Cổng dịch vụ trên máy chủ:**
  * Port `80`: Website Điểm danh (truy cập qua Nginx).
  * Port `8088`: phpMyAdmin (quản trị cơ sở dữ liệu).
  * Port `3000` (App) và Port `3306` (MySQL): Hoàn toàn đóng với bên ngoài, chỉ giao tiếp nội bộ container.

---

## 4. Yêu cầu môi trường
* Hệ điều hành: Linux (khuyên dùng Ubuntu 22.04 LTS / 24.04 LTS / 26.04 LTS).
* Docker Engine: >= 24.0 (khuyên dùng bản mới nhất).
* Docker Compose: >= v2.20.

---

## 5. Hướng dẫn cài đặt và khởi chạy

### Bước 1: Chuẩn bị biến môi trường
Sao chép file cấu hình mẫu `.env.example` thành `.env`:
```bash
cp .env.example .env
```
Chỉnh sửa các biến môi trường trong file `.env` theo nhu cầu (đặc biệt là mật khẩu tài khoản và session secret).

### Bước 2: Khởi chạy cụm dịch vụ bằng Docker Compose
```bash
docker compose up -d --build
```

### Bước 3: Kiểm tra trạng thái các container
```bash
docker compose ps
```
Đảm bảo tất cả các container (`attendance-nginx`, `attendance-app`, `attendance-mysql`, `attendance-phpmyadmin`) đều ở trạng thái `healthy` hoặc `Up`.

---

## 6. Đường dẫn truy cập

* **Website Điểm danh:** `http://<IP_MÁY_CHỦ>` (Ví dụ: `http://192.168.203.128`)
  * Đăng nhập với tài khoản Quản trị viên khởi tạo từ biến môi trường (`ADMIN_USERNAME` và `ADMIN_PASSWORD` trong `.env`).
* **phpMyAdmin:** `http://<IP_MÁY_CHỦ>:8088` (Ví dụ: `http://192.168.203.128:8088`)
  * Đăng nhập với tài khoản người dùng ứng dụng `attendance_app` và mật khẩu `DB_PASSWORD` trong `.env`.

---

## 7. Dừng hệ thống
```bash
docker compose down
```
*(Dữ liệu cơ sở dữ liệu được lưu trữ bền vững tại named volume `mysql_data`).*
