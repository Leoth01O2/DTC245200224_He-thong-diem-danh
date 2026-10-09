# Hệ thống Điểm danh (Attendance System) - Đề tài 27

Bài thi kết thúc học phần: **Triển khai và Quản trị Hệ thống Phần mềm**

---

## 1. Giới thiệu tổng quan
Hệ thống Điểm danh (Attendance System) là ứng dụng web cho phép quản lý nhân sự (sinh viên / nhân viên), thiết lập các ca học / ca làm việc và thực hiện điểm danh ra/vào (Check-in / Check-out) thời gian thực. Hệ thống tự động đối chiếu thời gian điểm danh thực tế với quy định ca để xác định trạng thái **Đúng giờ (on_time)** hoặc **Đi muộn (late)**, đồng thời lưu trữ lịch sử điểm danh bền vững trong cơ sở dữ liệu MySQL thật.

---

## 2. Công nghệ sử dụng (Stack)

* **Backend & Web Application:** Node.js 24 LTS (`node:24.21.0-alpine`), Express 5, EJS Template Engine.
* **Cơ sở dữ liệu:** MySQL 8.4 LTS (`mysql:8.4.11`), Driver `mysql2` (Promise API).
* **Quản trị cơ sở dữ liệu:** phpMyAdmin 5.2 (`phpmyadmin:5.2.3-apache`).
* **Quản lý phiên (Session):** `express-session` kết hợp `express-mysql-session` (lưu trữ phiên làm việc an toàn trên MySQL).
* **Bảo mật:** `bcryptjs` mã hóa mật khẩu, Nginx Security Headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Content-Security-Policy`), Non-root container (`USER node`).
* **Reverse Proxy:** Nginx 1.30 Alpine (`nginx:1.30.5-alpine`).
* **Giám sát & Metrics:**
  * Prometheus 3.14 (`prom/prometheus:v3.14.0`).
  * Grafana 13.2 (`grafana/grafana:13.2.2`).
  * cAdvisor 0.60 (`ghcr.io/google/cadvisor:v0.60.6`).
  * MySQL Exporter 0.20 (`prom/mysqld-exporter:v0.20.0`).
  * Nginx Prometheus Exporter 1.5 (`nginx/nginx-prometheus-exporter:1.5.1`).
* **Phương thức triển khai:** Docker Engine & Docker Compose.

---

## 3. Kiến trúc triển khai & Mạng cô lập

```text
[ Trình duyệt Client / Quản trị viên ]
         │
         ├── (HTTP Port 80) ──────────────► Nginx :80 (Reverse Proxy)
         │                                       │
         │                                       ▼ (frontend_net)
         │                                  Express App :3000
         │                                       │
         │                                       ▼ (backend_net)
         ├── (HTTP Port 8088) ──► phpMyAdmin ──► MySQL 8.4 :3306
         │                                       ▲
         │                                       │ (backend_net)
         │                               mysqld-exporter :9104
         │                                       ▲
         │                                       │ (monitoring_net)
         ├── (HTTP Port 9090) ──► Prometheus :9090
         │                               ▲
         │                               ├── (monitoring_net) ──► App :3000 (/metrics)
         │                               ├── (monitoring_net) ──► nginx-exporter :9113 ──► Nginx :8080 (/stub_status)
         │                               ├── (monitoring_net) ──► mysqld-exporter :9104
         │                               └── (monitoring_net) ──► cadvisor :8080
         │                                       ▲
         │                                       │ (monitoring_net)
         └── (HTTP Port 3000) ──► Grafana :3000 ─┘ (Provisioning tự động)
```

* **Phân vùng mạng cô lập (Docker Networks):**
  * `frontend_net`: Nginx kết nối với Express App.
  * `backend_net`: Express App, phpMyAdmin và MySQL Exporter kết nối với MySQL Database. Nginx, Prometheus và Grafana không kết nối trực tiếp vào MySQL.
  * `monitoring_net`: Vùng mạng nội bộ dành riêng cho giám sát. Prometheus thu thập dữ liệu từ Express App, Nginx Exporter, MySQL Exporter, cAdvisor; Grafana kết nối tới Prometheus qua DNS nội bộ `http://prometheus:9090`.
* **Cổng dịch vụ trên máy chủ (Host Ports):**
  * Port `80`: Website Điểm danh (truy cập qua Nginx).
  * Port `3000`: Grafana Web UI (Dashboard trực quan hóa).
  * Port `8088`: phpMyAdmin (quản trị cơ sở dữ liệu).
  * Port `9090`: Prometheus Web UI / Metrics API.
  * Port `3000` (App container), `3306` (MySQL), `8080` (Nginx stub_status & cAdvisor), `9104` (mysqld-exporter), `9113` (nginx-exporter): Hoàn toàn đóng với host bên ngoài, chỉ giao tiếp nội bộ container qua Docker networks.

---

## 4. Hệ thống Giám sát & Dashboard (Prometheus & Grafana)

Hệ thống giám sát được cấu hình **Provisioning tự động 100%**, người dùng không cần thao tác thêm Datasource hoặc import Dashboard thủ công trên giao diện.

### A. Tự động nạp Datasource (Datasource Provisioning)
Grafana tự động nạp nguồn dữ liệu Prometheus tại [`monitoring/grafana/provisioning/datasources/prometheus.yml`](monitoring/grafana/provisioning/datasources/prometheus.yml):
- Name: `Prometheus`
- Type: `prometheus`
- UID: `prometheus-main`
- URL: `http://prometheus:9090` (qua `monitoring_net`)
- Default: `true`

### B. Tự động nạp Dashboard (Dashboard Provisioning)
Grafana tự động nạp Dashboard từ [`monitoring/grafana/dashboards/attendance-system-overview.json`](monitoring/grafana/dashboards/attendance-system-overview.json) thông qua provider [`monitoring/grafana/provisioning/dashboards/dashboards.yml`](monitoring/grafana/provisioning/dashboards/dashboards.yml):
- Tên Dashboard: **`Attendance System Monitoring`**
- UID: `attendance-system-monitoring`
- Thư mục: `Attendance Monitoring`
- Tần suất tự động làm mới (Auto Refresh): `10s`
- Khung thời gian mặc định: `Last 15 minutes`

Dashboard được cấu trúc thành 4 nhóm (Row) chỉ số chuyên sâu:

1. **Row A - System Overview (Tổng quan Hệ thống):**
   * *Prometheus Targets Up:* Trạng thái sống/chết của toàn bộ 5 scrape targets (`sum(up)` / `count(up)`).
   * *Application Request Rate:* Tốc độ yêu cầu HTTP trung bình (`sum(rate(attendance_http_requests_total[5m]))`).
   * *Application p95 Latency:* Độ trễ phân vị 95 của Express App (`histogram_quantile(0.95, ...)`).
   * *Attendance Actions:* Thống kê các lượt điểm danh Check-in / Check-out (`sum(attendance_actions_total) by (action, status)`).

2. **Row B - Application & Web Traffic (Lưu lượng Ứng dụng & Nginx):**
   * *Requests by HTTP Status:* Phân loại lưu lượng theo mã trạng thái HTTP (2xx, 3xx, 4xx, 5xx) từ Express App.
   * *Requests by Route:* Lưu lượng chi tiết theo từng route nghiệp vụ (`/dashboard`, `/attendance`, `/members`, v.v.).
   * *Nginx Request Rate & Connections:* Tốc độ yêu cầu qua Reverse Proxy và số lượng kết nối Client hoạt động (`active`, `reading`, `writing`, `waiting`).

3. **Row C - MySQL Database (Cơ sở Dữ liệu MySQL):**
   * *MySQL Instance Status:* Trạng thái kết nối của cơ sở dữ liệu (`mysql_up`).
   * *MySQL Connected Threads:* Số lượng kết nối đồng thời tới MySQL (`mysql_global_status_threads_connected`).
   * *MySQL Queries Rate:* Tốc độ thực thi câu lệnh SQL QPS (`rate(mysql_global_status_questions[5m])`).
   * *MySQL Uptime:* Thời gian hoạt động liên tục của instance MySQL (`mysql_global_status_uptime`).

4. **Row D - Docker Containers Resources (Tài nguyên Container):**
   * *Container CPU Usage:* Tải CPU thực tế theo từng container thu thập bởi cAdvisor (`rate(container_cpu_usage_seconds_total[5m])`).
   * *Container Memory Working Set:* Bộ nhớ RAM thực tế đang tiêu thụ theo container (`container_memory_working_set_bytes`).
   * *Container Network I/O:* Băng thông mạng truyền nhận theo container (`rate(container_network_receive_bytes_total[5m])`).

---

## 5. Yêu cầu môi trường
* Hệ điều hành: Linux (Ubuntu 22.04 LTS / 24.04 LTS / 26.04 LTS).
* Docker Engine: >= 24.0.
* Docker Compose: >= v2.20.

---

## 6. Hướng dẫn cài đặt và khởi chạy

### Bước 1: Chuẩn bị biến môi trường
Sao chép file cấu hình mẫu `.env.example` thành `.env`:
```bash
cp .env.example .env
```
Cấu hình các biến môi trường trong file `.env` (bao gồm `SESSION_SECRET`, `MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD`, `MYSQL_EXPORTER_PASSWORD`, `ADMIN_PASSWORD`, `GRAFANA_ADMIN_PASSWORD`).

### Bước 2: Khởi chạy cụm dịch vụ bằng Docker Compose
```bash
docker compose up -d --build
```

### Bước 3: Kiểm tra trạng thái các container
```bash
docker compose ps
```
Đảm bảo tất cả 9 container (`attendance-nginx`, `attendance-app`, `attendance-mysql`, `attendance-phpmyadmin`, `attendance-prometheus`, `attendance-grafana`, `attendance-cadvisor`, `attendance-mysqld-exporter`, `attendance-nginx-exporter`) đều ở trạng thái `healthy` hoặc `Up`.

---

## 7. Đường dẫn truy cập dịch vụ

* **Website Điểm danh:** `http://<IP_MÁY_CHỦ>` (Ví dụ: `http://192.168.203.128`)
  * Đăng nhập với tài khoản Quản trị viên (`ADMIN_USERNAME` và `ADMIN_PASSWORD` trong `.env`).
* **Grafana Dashboards:** `http://<IP_MÁY_CHỦ>:3000` (Ví dụ: `http://192.168.203.128:3000`)
  * Tên đăng nhập: Giá trị `GRAFANA_ADMIN_USER` trong `.env` (Mặc định: `admin`).
  * Mật khẩu: Xem trên máy chủ qua lệnh:
    ```bash
    grep '^GRAFANA_ADMIN_PASSWORD=' /home/ubuntu/projects/attendance-system/.env
    ```
  * Sau khi đăng nhập, truy cập ngay mục **Dashboards -> Attendance Monitoring -> Attendance System Monitoring** để xem biểu đồ thời gian thực.
* **phpMyAdmin:** `http://<IP_MÁY_CHỦ>:8088` (Ví dụ: `http://192.168.203.128:8088`)
  * Đăng nhập với tài khoản người dùng ứng dụng `attendance_app` và mật khẩu `DB_PASSWORD` trong `.env`.
* **Prometheus UI & Metrics:** `http://<IP_MÁY_CHỦ>:9090` (Ví dụ: `http://192.168.203.128:9090`)
  * Tra cứu trực tiếp mục **Status -> Targets** để kiểm tra độ sẵn sàng của 5 scrape targets.

---

## 8. Dừng hệ thống
```bash
docker compose down
```
*(Dữ liệu MySQL, chuỗi thời gian Prometheus và cài đặt Grafana được lưu trữ bền vững tại các named volumes: `mysql_data`, `prometheus_data`, `grafana_data`).*
