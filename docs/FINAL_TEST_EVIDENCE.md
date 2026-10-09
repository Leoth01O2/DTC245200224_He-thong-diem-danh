# Bằng chứng Kiểm thử Toàn diện Hệ thống (Final Test Evidence)

**Dự án:** Hệ thống Điểm danh (Attendance System) - Đề tài 27  
**Thời gian kiểm thử:** 2026-10-09  
**Môi trường:** Ubuntu Linux (IP máy ảo hiện tại: `192.168.203.128`)  
**Kết quả tổng quan:** **100% PASS**

---

## 1. Môi trường Thực thi (Environment)
* **Hệ điều hành:** Linux 6.8.0-52-generic x86_64
* **Docker Engine:** 28.1.1
* **Docker Compose:** v2.35.1
* **IP nội bộ chính:** `192.168.203.128` (Kiểm tra động bằng lệnh `hostname -I`)

---

## 2. Danh mục Dịch vụ Container (Docker Service Inventory)

| Service Name | Container Name | Image Pinning | Status | Port Exposure | Kết quả |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `nginx` | `attendance-nginx` | `nginx:1.30.5-alpine` | Up (healthy) | `0.0.0.0:80->80/tcp` (Public) | **PASS** |
| `app` | `attendance-app` | `attendance-system-app` (`node:24.21.0-alpine`) | Up (healthy) | `3000/tcp` (Private internal) | **PASS** |
| `mysql` | `attendance-mysql` | `mysql:8.4.11` | Up (healthy) | `3306/tcp, 33060/tcp` (Private internal) | **PASS** |
| `phpmyadmin` | `attendance-phpmyadmin` | `phpmyadmin:5.2.3-apache` | Up | `0.0.0.0:8088->80/tcp` (Public) | **PASS** |
| `prometheus` | `attendance-prometheus` | `prom/prometheus:v3.14.0` | Up | `0.0.0.0:9090->9090/tcp` (Public) | **PASS** |
| `grafana` | `attendance-grafana` | `grafana/grafana:13.2.2` | Up (healthy) | `0.0.0.0:3000->3000/tcp` (Public) | **PASS** |
| `cadvisor` | `attendance-cadvisor` | `ghcr.io/google/cadvisor:v0.60.6` | Up (healthy) | `8080/tcp` (Private internal) | **PASS** |
| `mysqld-exporter`| `attendance-mysqld-exporter` | `prom/mysqld-exporter:v0.20.0` | Up | `9104/tcp` (Private internal) | **PASS** |
| `nginx-exporter` | `attendance-nginx-exporter` | `nginx/nginx-prometheus-exporter:1.5.1` | Up | `9113/tcp` (Private internal) | **PASS** |
| `loki` | `attendance-loki` | `grafana/loki:3.7.0` | Up | `3100/tcp` (Private internal) | **PASS** |
| `promtail` | `attendance-promtail` | `grafana/promtail:3.6.11` | Up | Không mở cổng | **PASS** |

*Tất cả 11 container đều sử dụng image pinned version cụ thể, tuyệt đối không dùng `:latest`.*

---

## 3. Bằng chứng Kiểm thử Nghiệp vụ Ứng dụng (End-to-End Application Test)

*Kiểm thử trực tiếp qua Reverse Proxy Nginx (Port 80):*

| Kịch bản kiểm thử | Thao tác / Endpoint | Kết quả thực tế | Đánh giá |
| :--- | :--- | :--- | :--- |
| **Đăng nhập (Login)** | `POST /login` với credentials quản trị viên | Trả về HTTP 302 chuyển hướng về `/dashboard` | **PASS** |
| **Bảng điều khiển** | `GET /dashboard` | Trả về HTTP 200, hiển thị đầy đủ thẻ thống kê tổng quan | **PASS** |
| **Thêm nhân sự** | `POST /members/create` | Tạo mới nhân sự thành công, ghi vào CSDL MySQL | **PASS** |
| **Tìm kiếm nhân sự** | `GET /members?search=NV...` | Tìm kiếm chính xác theo mã và họ tên | **PASS** |
| **Sửa nhân sự** | `POST /members/:id/edit` | Cập nhật thông tin nhân sự thành công | **PASS** |
| **Xóa nhân sự test**| `POST /members/:id/delete` | Xóa bản ghi test an toàn khi chưa có dữ liệu điểm danh | **PASS** |
| **Thêm ca làm việc**| `POST /shifts/create` | Tạo mới ca làm việc với quy định giờ bắt đầu/kết thúc | **PASS** |
| **Sửa ca làm việc** | `POST /shifts/:id/edit` | Cập nhật thông số ca làm việc thành công | **PASS** |
| **Xóa ca test** | `POST /shifts/:id/delete` | Xóa ca làm việc test thành công | **PASS** |
| **Điểm danh vào** | `POST /attendance/check-in` | Ghi nhận Check-in, tính trạng thái đúng giờ/muộn chính xác | **PASS** |
| **Chống trùng Check-in** | `POST /attendance/check-in` cùng ca trong ngày cho cùng thành viên | Hệ thống chặn và báo lỗi "Thành viên đã check-in ca này trong ngày hôm nay" (Chống check-in trùng cùng thành viên, cùng ca, cùng ngày; thành viên vẫn được phép check-in ca khác hợp lệ trong cùng ngày) | **PASS** |
| **Điểm danh ra** | `POST /attendance/check-out` | Cập nhật `check_out` thời gian thực | **PASS** |
| **Chống trùng Check-out**| `POST /attendance/check-out` lần 2 | Hệ thống xử lý an toàn, không tạo bản ghi rác | **PASS** |
| **Lọc Lịch sử** | `GET /attendance/history?date_from=...&member_id=...&status=...` | Bộ lọc theo ngày, theo nhân sự và trạng thái trả về HTTP 200 | **PASS** |
| **Đăng xuất (Logout)** | `POST /logout` | Xóa phiên làm việc trong CSDL, hủy cookie, chuyển hướng login | **PASS** |

---

## 4. Bằng chứng Cơ sở Dữ liệu & Ràng buộc (Database Evidence)

* **Danh sách bảng CSDL:** `users`, `members`, `shifts`, `attendance`, `sessions`.
* **Ràng buộc duy nhất:** `UNIQUE KEY uq_member_shift_date (member_id, shift_id, attendance_date)` trên bảng `attendance`.
* **Khóa ngoại bảo vệ:** `fk_attendance_member` và `fk_attendance_shift` đều có hành vi `ON DELETE RESTRICT`, ngăn ngừa xóa nhầm dữ liệu gốc khi đã có lịch sử điểm danh.
* **Đặc quyền tài khoản ứng dụng `attendance_app`:**
  ```sql
  GRANT USAGE ON *.* TO `attendance_app`@`%`;
  GRANT SELECT, INSERT, UPDATE, DELETE ON `attendance\_db`.* TO `attendance_app`@`%`;
  ```
  *(Thu hồi toàn bộ quyền DDL và quyền quản trị server).*
* **Đặc quyền tài khoản giám sát `attendance_exporter`:**
  ```sql
  GRANT SELECT, PROCESS, REPLICATION CLIENT ON *.* TO `attendance_exporter`@`%`;
  ```
  *(Áp dụng giới hạn `MAX_USER_CONNECTIONS 3`).*
* **Port MySQL:** Cổng `3306` nội bộ trong mạng `backend_net`, không mở ra host.
* **Đánh giá:** **PASS**

---

## 5. Bằng chứng Phiên làm việc & Cookie (Session & Cookie Evidence)

* **Lưu trữ phiên bền vững:** Bảng `sessions` trên MySQL lưu giữ phiên của người dùng đăng nhập; khi đăng xuất, bản ghi phiên lập tức bị xóa bỏ (`DELETE`).
* **Thuộc tính Cookie `attendance_sid`:**
  * `HttpOnly: true` (Ngăn chặn tấn công XSS đánh cắp cookie qua JavaScript).
  * `SameSite: Lax` (Giúp giảm rủi ro CSRF đối với một số cross-site request).
* **Bảo mật Log:** Toàn bộ log của ứng dụng và Nginx không bao giờ ghi nhận giá trị session ID hay chuỗi cookie.
* **Đánh giá:** **PASS**

---

## 6. Bằng chứng Nginx Reverse Proxy & Tiêu đề Bảo mật (Nginx Evidence)

* **Reverse Proxy:** Định tuyến lưu lượng cổng `80` vào ứng dụng Express nội bộ.
* **Tài nguyên tĩnh & Font:** Font chữ `Be Vietnam Pro` (`/fonts/be-vietnam-pro-vietnamese-400-normal.woff2`) tải với mã `HTTP 200 OK`.
* **Ẩn phiên bản máy chủ:** `Server: nginx` (đã kích hoạt `server_tokens off`, không hiển thị phiên bản).
* **Tiêu đề bảo mật HTTP (Security Headers):**
  * `X-Frame-Options: SAMEORIGIN` (Chống Clickjacking).
  * `X-Content-Type-Options: nosniff` (Chống MIME-type sniffing).
  * `Referrer-Policy: strict-origin-when-cross-origin`.
  * `Permissions-Policy: geolocation=(), camera=(), microphone=()`.
  * `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self';`
  * Không sử dụng tiêu đề lỗi thời `X-XSS-Protection`.
* **Đánh giá:** **PASS**

---

## 7. Bằng chứng Hệ thống Giám sát (Prometheus Evidence)

* **Trạng thái Scrape Targets (5/5 UP):**
  1. `attendance-app` (`app:3000`): **UP**
  2. `cadvisor` (`cadvisor:8080`): **UP**
  3. `mysql` (`mysqld-exporter:9104`): **UP**
  4. `nginx` (`nginx-exporter:9113`): **UP**
  5. `prometheus` (`prometheus:9090`): **UP**

* **Kết quả kiểm tra câu truy vấn PromQL cốt lõi:**
  * `up`: Trả về 5 target với giá trị `1`.
  * `attendance_http_requests_total`: Thu thập đầy đủ dữ liệu lưu lượng theo phương thức, route và status_code.
  * `histogram_quantile(0.95, sum(rate(attendance_http_request_duration_seconds_bucket[5m])) by (le))`: Trả về độ trễ phân vị p95 hợp lệ.
  * `nginx_connections_active`: Trả về số lượng kết nối Nginx thời gian thực.
  * `mysql_up`: Trả về `1` (CSDL MySQL kết nối tốt).
  * `container_cpu_usage_seconds_total`: Thu thập tải CPU từ cAdvisor.
  * `container_memory_working_set_bytes`: Thu thập bộ nhớ RAM container thực tế.
* **Đánh giá:** **PASS**

---

## 8. Bằng chứng Trực quan hóa (Grafana Evidence)

* **Grafana Health:** `HTTP 200` (`database: ok`, version `13.2.2`).
* **Nguồn dữ liệu tự động (Provisioned Datasources):**
  * `Prometheus` (UID: `prometheus-main`): **OK**
  * `Loki` (UID: `loki-main`): **OK**
* **Bảng điều khiển tự động (Provisioned Dashboard):**
  * Tên: **Attendance System Monitoring** (UID: `attendance-system-monitoring`).
  * Gồm 18 panels chia thành 4 Row chuyên sâu (System Overview, Application Traffic, MySQL Database, Container Resources), không có panel nào bị lỗi cú pháp truy vấn.
* **Đánh giá:** **PASS**

---

## 9. Bằng chứng Thu thập Nhật ký Tập trung (Loki + Promtail + LogQL Evidence)

* **Loki Readiness:** `GET http://loki:3100/ready` từ mạng nội bộ trả về `HTTP 200 ready`.
* **Promtail Discovery:** Thu thập log tự động từ Docker daemon qua socket và bóc tách cấu trúc JSON qua pipeline `docker: {}`.
* **Minh chứng 5 câu truy vấn LogQL chuẩn hóa:**
  1. **Toàn bộ log ứng dụng:**
     `{compose_service="app"} | json` -> Trả về log JSON có cấu trúc gồm `status_code`, `latency_ms`, `route`.
  2. **Truy vấn lỗi HTTP ứng dụng:**
     `{compose_service="app"} | json | status_code >= 400` -> Trích xuất chính xác log lỗi HTTP 404, không gặp lỗi `LabelFilterErr`.
  3. **Truy vấn sự kiện nghiệp vụ điểm danh:**
     `{compose_service="app"} | json | action=~"CHECK_IN|CHECK_OUT"` -> Bắt được cả hai sự kiện CHECK_IN và CHECK_OUT.
  4. **Truy vấn điểm danh đi muộn:**
     `{compose_service="app"} | json | action="CHECK_IN" | attendance_status="late"` -> Lọc chính xác các lượt check-in muộn.
  5. **Truy vấn lỗi Nginx reverse proxy:**
     `{compose_service="nginx"} | json | status >= 400` -> Trích xuất toàn bộ yêu cầu lỗi từ Nginx access log.
* **Đánh giá:** **PASS**

---

## 10. Bằng chứng Bền vững Dữ liệu (Persistence Evidence)

* **Quy trình kiểm thử:** Thực hiện `docker compose restart` toàn bộ stack dịch vụ.
* **Kết quả sau restart:**
  * Dữ liệu CSDL MySQL (nhân sự, ca, lượt điểm danh) được bảo toàn nguyên vẹn trên volume `mysql_data`.
  * Dashboard và cấu hình Grafana không đổi trên volume `grafana_data`.
  * Dữ liệu số liệu Prometheus tiếp tục nối chuỗi trên volume `prometheus_data`.
  * Toàn bộ log trong Loki vẫn truy vấn lại đầy đủ trên volume `loki_data`.
  * Tệp con trỏ offset vị trí của Promtail trên volume `promtail_positions` được giữ nguyên, tiếp tục đọc nối tiếp log mà không bị duplicate.
* **Đánh giá:** **PASS**

---

## 11. Bằng chứng Gia cố An ninh (Hardening Evidence)

* **App non-root user:** `docker exec attendance-app whoami` -> **`node`** (UID: 1000).
* **App Read-only root filesystem:** Thử tạo tệp tại thư mục gốc `/root-test.txt` trả về **`Read-only file system`**; ghi tệp tạm vào `/tmp` thành công qua tmpfs.
* **App Capabilities & No-new-privileges:** `CapDrop: ["ALL"]`, `SecurityOpt: ["no-new-privileges:true"]`, `Init: true`.
* **Cấm nâng quyền diện rộng:** Áp dụng `no-new-privileges:true` cho 10/11 services Compose.
* **Bảo vệ Secret:** Tệp `.env` phân quyền `600`, nằm trong `.gitignore`.
* **Quay vòng mật khẩu (Password Rotation):** Mật khẩu quản trị viên ứng dụng và Grafana đã được xoay vòng an toàn bằng chuỗi ngẫu nhiên mạnh.
* **Giới hạn kích thước log:** Cấu hình `max-size: "10m"` và `max-file: "3"` cho toàn bộ các container.
* **Đánh giá:** **PASS**

---

## 12. Quét Rò rỉ Bí mật (Secret Leak Scan) & An toàn Thư viện (npm audit)

* **Quét mã nguồn Git:** `git grep` xác nhận không có bất kỳ mật khẩu hoặc chuỗi secret thực tế nào bị commit vào mã nguồn. Tệp `.env.example` chỉ chứa placeholder `change_me_*`.
* **Quét lỗ hổng thư viện:** `npm audit --omit=dev` trên môi trường container Node 24 LTS trả về **`found 0 vulnerabilities`**.
* **Đánh giá:** **PASS**

---

## 13. Kiểm thử Giao diện Người dùng (UI Regression)

* **Ngôn ngữ:** 100% tiếng Việt chuẩn có dấu, không sử dụng emoji trong giao diện nghiệp vụ.
* **Phông chữ:** Nhúng cục bộ `Be Vietnam Pro`, không phụ thuộc Google Fonts bên ngoài.
* **Định dạng ngày giờ:** Hiển thị chuẩn Việt Nam `DD/MM/YYYY` và `HH:mm:ss`, không lộ chuỗi JavaScript raw Date.
* **Tương thích:** Bố cục responsive, không phát sinh lỗi CSP (Content Security Policy).
* **Đánh giá:** **PASS**

---

## 14. Bảng Tổng kết Đánh giá Cuối cùng (Final Checklist)

| STT | Hạng mục kiểm thử | Trạng thái | Ghi chú |
| :---: | :--- | :---: | :--- |
| 1 | Khởi động & Độ ổn định 11 Containers | **PASS** | Tất cả containers đều Healthy / Up |
| 2 | Nghiệp vụ Điểm danh & Quản trị Nhân sự / Ca | **PASS** | E2E CRUD, Check-in/Check-out, chống trùng lặp |
| 3 | Cơ sở dữ liệu MySQL & Quyền tối thiểu | **PASS** | Chỉ cấp SELECT, INSERT, UPDATE, DELETE cho App |
| 4 | Quản lý Phiên & Cookie an toàn | **PASS** | HttpOnly, SameSite=Lax, lưu MySQL sessions |
| 5 | Nginx Reverse Proxy & Security Headers | **PASS** | OWASP Headers, server_tokens off, font Be Vietnam Pro |
| 6 | Giám sát Prometheus (5/5 targets UP) | **PASS** | Đủ metrics App, Nginx, MySQL, cAdvisor, Prometheus |
| 7 | Dashboard Grafana tự động nạp | **PASS** | 18 panels trực quan, datasources Prometheus & Loki OK |
| 8 | Quản lý Nhật ký tập trung Loki + Promtail | **PASS** | 5 câu truy vấn LogQL hoạt động chuẩn xác |
| 9 | Bền vững Dữ liệu sau Restart | **PASS** | Toàn bộ 5 named volumes giữ nguyên dữ liệu |
| 10 | Gia cố An ninh (Hardening) | **PASS** | Non-root, cap_drop, read-only rootfs, .env 600, log rotation |
| 11 | Không rò rỉ Secret & npm audit sạch | **PASS** | 0 vulnerabilities, không secret trong Git |
| 12 | Giao diện chuẩn Tiếng Việt & Typography | **PASS** | DD/MM/YYYY, Be Vietnam Pro, không emoji |
