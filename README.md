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
* **Thu thập & Quản lý Nhật ký tập trung (Centralized Logging):**
  * Grafana Loki 3.7 (`grafana/loki:3.7.0`).
  * Promtail 3.6 (`grafana/promtail:3.6.11`).
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

## 5. Hệ thống Nhật ký tập trung (Centralized Logging - Loki & Promtail)

Hệ thống triển khai pipeline thu thập nhật ký tập trung theo chuẩn Grafana:
```text
Docker Container Logs (JSON-file)
              │
              ▼
   Promtail 3.6.11 (docker_sd_configs)
              │ (HTTP Push: http://loki:3100/loki/api/v1/push)
              ▼
     Loki 3.7.0 (TSDB + Filesystem single-binary)
              │ (Data source: http://loki:3100)
              ▼
   Grafana 13.2 (Explore / LogQL)
```

* **Công nghệ sử dụng:**
  * **Loki:** `grafana/loki:3.7.0` (Single-binary, TSDB schema v13, lưu trữ dữ liệu bền vững trên named volume `loki_data`).
  * **Promtail:** `grafana/promtail:3.6.11` (Mount `/var/run/docker.sock` và `/var/lib/docker/containers` dưới chế độ Read-Only, lưu trữ con trỏ đọc trên named volume `promtail_positions`).
  * *Ghi chú kiến trúc:* Promtail đã bước vào giai đoạn EOL (End of Life) trong thực tế và dự án sản xuất (production) mới nên cân nhắc chuyển sang Grafana Alloy. Tuy nhiên, ở đề tài này Promtail 3.6.11 được sử dụng hoàn toàn chuẩn mực nhằm đáp ứng rubric yêu cầu cụm Loki + Promtail.
* **Định dạng Log & Bảo mật:**
  * Toàn bộ log của **Attendance App** và **Nginx** được chuẩn hóa dưới dạng JSON có cấu trúc ghi ra `stdout`/`stderr`.
  * Promtail sử dụng stage `docker: {}` để bóc tách vỏ bọc Docker json-file.
  * Giữ mức cardinality nhãn (labels) thấp và ổn định (`container_name`, `compose_service`), không đưa timestamp, IP, mật khẩu hay dữ liệu nhạy cảm vào label; toàn bộ trường chi tiết được bóc tách linh hoạt tại query-time bằng cú pháp LogQL `| json`.
  * Không log thông tin nhạy cảm: `password`, `cookie`, `session_secret`, mã phiên làm việc.
* **Tự động nạp Nguồn dữ liệu Loki vào Grafana:**
  * File cấu hình [`monitoring/grafana/provisioning/datasources/loki.yml`](monitoring/grafana/provisioning/datasources/loki.yml).
  * UID: `loki-main`, URL nội bộ: `http://loki:3100` (kết nối qua mạng `logging_net`).
* **Các câu truy vấn LogQL minh chứng hệ thống:**
  1. **Truy vấn toàn bộ log có cấu trúc của Attendance App:**
     ```logql
     {compose_service="app"} | json
     ```
  2. **Truy vấn lỗi HTTP từ Attendance App (HTTP Status >= 400):**
     *(Sau khi chuẩn hóa schema sang trường số `status_code`, câu truy vấn không còn bị lỗi kiểu dữ liệu và không cần lọc `__error__`)*
     ```logql
     {compose_service="app"} | json | status_code >= 400
     ```
  3. **Truy vấn sự kiện nghiệp vụ Điểm danh (Check-in & Check-out):**
     ```logql
     {compose_service="app"} | json | action=~"CHECK_IN|CHECK_OUT"
     ```
  4. **Truy vấn lượt điểm danh đi muộn (Late Check-in):**
     ```logql
     {compose_service="app"} | json | action="CHECK_IN" | attendance_status="late"
     ```
  5. **Truy vấn lỗi HTTP từ Nginx Reverse Proxy (HTTP Status >= 400):**
     ```logql
     {compose_service="nginx"} | json | status >= 400
     ```

---

## 6. Biện pháp Tăng cường Bảo mật (System Hardening)

Hệ thống được thiết kế và cấu hình tuân thủ nguyên tắc đặc quyền tối thiểu (Least Privilege), cô lập mạng và bảo vệ dữ liệu toàn diện:

* **Bảo mật Container & Ứng dụng (Application & Container Hardening):**
  * **Non-root execution:** Attendance App chạy dưới tài khoản unprivileged `node` (UID: 1000). Toàn bộ file source code được phân quyền `node:node`.
  * **Cấm nâng quyền (`no-new-privileges:true`):** Áp dụng nhất quán trên toàn bộ các service Compose (`app`, `nginx`, `mysql`, `phpmyadmin`, `prometheus`, `grafana`, `nginx-exporter`, `mysqld-exporter`, `loki`, `promtail`).
  * **Hạ bỏ đặc quyền Linux (`cap_drop: ALL`):** Ứng dụng App bị loại bỏ toàn bộ Linux capabilities thừa, giảm thiểu tối đa rủi ro container breakout.
  * **Read-only Root Filesystem (`read_only: true`):** Hệ thống tệp gốc của App là chỉ đọc; các tiến trình chỉ được ghi tạm vào vùng nhớ tạm thời `tmpfs: /tmp`.
  * **Tiến trình Init (`init: true`):** Quản lý tiến trình trong container thông qua tini / init để dọn dẹp zombie process đúng chuẩn POSIX.
  * **Zero dependency vulnerabilities:** Đã quét và xác nhận `npm audit --omit=dev` đạt **0 vulnerabilities**.
* **Bảo mật Mạng & Quản lý Cổng (Network Isolation & Port Exposure):**
  * **Phân tách 4 mạng cô lập:** `frontend_net`, `backend_net`, `monitoring_net`, `logging_net`.
  * **Cổng dịch vụ công khai tối thiểu:** Chỉ mở duy nhất 4 cổng trên host: `80` (Website), `3000` (Grafana), `8088` (phpMyAdmin), `9090` (Prometheus).
  * **Đóng hoàn toàn cổng nội bộ:** MySQL `3306`, Loki `3100`, App `3000`, Nginx monitor `8080`, Exporters (`9104`, `9113`), cAdvisor `8080` không bind ra host bên ngoài.
* **Bảo mật Cơ sở dữ liệu & Phân quyền (Database Hardening):**
  * Không dùng quyền `root` cho hoạt động ứng dụng.
  * Tài khoản `attendance_app` áp dụng triệt để nguyên tắc Least Privilege: chỉ được cấp các quyền thao tác dữ liệu cần thiết (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) trên `attendance_db.*`, hoàn toàn không có quyền DDL (`CREATE`, `ALTER`, `DROP`) hay quyền quản trị máy chủ (`GRANT OPTION`, `SUPER`, `PROCESS`). Khởi tạo tự động qua script [`database/init/03-harden-app-user.sh`](database/init/03-harden-app-user.sh).
  * Tài khoản `attendance_exporter` chỉ có các quyền đọc hạn chế (`SELECT`, `PROCESS`, `REPLICATION CLIENT`) với `MAX_USER_CONNECTIONS 3`.
* **Bảo mật Tệp cấu hình & Quản lý Bí mật (Secret Management):**
  * Tệp `.env` được phân quyền nghiêm ngặt `chmod 600` (chỉ user sở hữu có quyền đọc/ghi).
  * `.env` được đưa vào `.gitignore`, ngăn chặn rủi ro vô tình commit bí mật vào mã nguồn.
  * Tệp mẫu `.env.example` chỉ chứa biến mẫu placeholder `change_me`, không chứa giá trị thực tế.
  * Toàn bộ mật khẩu nhạy cảm (`ADMIN_PASSWORD`, `GRAFANA_ADMIN_PASSWORD`) được định kỳ rotate bằng chuỗi ngẫu nhiên mạnh.
* **Bảo mật Phiên & Tiêu đề HTTP (Session & Security Headers):**
  * Nginx cấu hình đầy đủ Security Headers chuẩn OWASP: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Content-Security-Policy`. Ẩn thông tin phiên bản bằng `server_tokens off`.
  * Cookie phiên làm việc `attendance_sid` được thiết lập `HttpOnly: true`, `SameSite: 'lax'` (giúp giảm rủi ro CSRF đối với một số cross-site request).
  * Phiên làm việc được lưu trữ bền vững trên bảng `sessions` của MySQL qua `express-mysql-session`.
* **Giới hạn kích thước Log (Log Rotation):**
  * Toàn bộ 11 dịch vụ được cấu hình Docker logging driver `json-file` với giới hạn `max-size: "10m"` và `max-file: "3"`, ngăn chặn tình trạng cạn kiệt dung lượng ổ đĩa.
* **Các trường hợp ngoại lệ an ninh (Security Exceptions & Rationale):**
  * `cadvisor`: Cần cờ `privileged: true` và mount `/sys`, `/dev/kmsg`, `/var/lib/docker` để thu thập số liệu phần cứng và tài nguyên của các container Docker trên host.
  * `promtail`: Cần mount read-only `/var/run/docker.sock` và `/var/lib/docker/containers` để thực hiện Docker Service Discovery và đọc log container theo yêu cầu bài thi.
  * `COOKIE_SECURE=false`: Do môi trường bài thi triển khai trên HTTP IP nội bộ (`http://192.168.203.128`). Khi triển khai trên môi trường sản xuất có chứng chỉ TLS/HTTPS, biến này sẽ được bật thành `true`.
  * `Promtail EOL`: Promtail đã EOL nhưng tiếp tục được sử dụng trong phạm vi đề tài để đáp ứng tiêu chí bài thi (hệ thống thực tế nên cân nhắc Grafana Alloy).

---

---

## 7. Cấu trúc Cơ sở Dữ liệu (Database Schema)

Cơ sở dữ liệu `attendance_db` được chuẩn hóa với 5 bảng chính, khóa ngoại có tính toàn vẹn tham chiếu (`ON DELETE RESTRICT`):

1. **`users`:** Quản trị viên hệ thống
   * `id`: INT AUTO_INCREMENT PRIMARY KEY
   * `username`: VARCHAR(50) NOT NULL UNIQUE
   * `password`: VARCHAR(255) NOT NULL (mã hóa bcrypt)
   * `full_name`: VARCHAR(100) NOT NULL
   * `created_at`, `updated_at`: TIMESTAMP
2. **`members`:** Thành viên / Nhân sự điểm danh
   * `id`: INT AUTO_INCREMENT PRIMARY KEY
   * `code`: VARCHAR(20) NOT NULL UNIQUE (ví dụ: NV001, SV001)
   * `name`: VARCHAR(100) NOT NULL
   * `department`: VARCHAR(100) NOT NULL
   * `status`: ENUM('active', 'inactive') NOT NULL DEFAULT 'active'
   * `created_at`, `updated_at`: TIMESTAMP
3. **`shifts`:** Ca học / Ca làm việc
   * `id`: INT AUTO_INCREMENT PRIMARY KEY
   * `name`: VARCHAR(100) NOT NULL
   * `start_time`: TIME NOT NULL (Giờ bắt đầu ca)
   * `end_time`: TIME NOT NULL (Giờ kết thúc ca)
   * `grace_period_minutes`: INT NOT NULL DEFAULT 15 (Số phút cho phép đi muộn hợp lệ)
   * `created_at`, `updated_at`: TIMESTAMP
4. **`attendance`:** Bản ghi điểm danh thời gian thực
   * `id`: INT AUTO_INCREMENT PRIMARY KEY
   * `member_id`: INT NOT NULL, FOREIGN KEY REFERENCES `members(id)` ON DELETE RESTRICT
   * `shift_id`: INT NOT NULL, FOREIGN KEY REFERENCES `shifts(id)` ON DELETE RESTRICT
   * `attendance_date`: DATE NOT NULL
   * `check_in`: DATETIME NOT NULL
   * `check_out`: DATETIME NULL
   * `status`: ENUM('on_time', 'late') NOT NULL
   * **Constraint:** `UNIQUE KEY uq_member_shift_date (member_id, shift_id, attendance_date)`: Ngăn chặn check-in trùng lặp cho cùng thành viên, cùng ca trong một ngày (thành viên vẫn được phép check-in ca khác hợp lệ trong cùng ngày).
5. **`sessions`:** Bảng lưu trữ phiên đăng nhập (`express-mysql-session`)
   * `session_id`: VARCHAR(128) PRIMARY KEY
   * `expires`: INT UNSIGNED NOT NULL
   * `data`: MEDIUMTEXT

---

## 8. Danh mục Named Volumes (Data Persistence)

Toàn bộ trạng thái và dữ liệu của hệ thống được bảo toàn khi dừng hoặc tạo lại container:
* `mysql_data`: Dữ liệu bảng, người dùng và chỉ mục MySQL 8.4.
* `prometheus_data`: Dữ liệu chuỗi thời gian (time-series TSDB).
* `grafana_data`: Cấu hình người dùng, trạng thái giao diện Grafana.
* `loki_data`: Khối dữ liệu nhật ký (chunks TSDB schema v13) của Grafana Loki.
* `promtail_positions`: Vị trí offset đọc log container của Promtail (`positions.yaml`).

---

## 9. Yêu cầu môi trường & Khởi chạy

### A. Yêu cầu tiên quyết
* Hệ điều hành: Linux (Ubuntu 22.04 LTS / 24.04 LTS / 26.04 LTS khuyến nghị).
* Docker Engine: >= 24.0.
* Docker Compose: >= v2.20.

### B. Hướng dẫn khởi chạy
1. **Chuẩn bị file môi trường:**
   ```bash
   cp .env.example .env
   chmod 600 .env
   ```
   Chỉnh sửa các mật khẩu trong file `.env` bằng các chuỗi ngẫu nhiên an toàn.

2. **Khởi chạy toàn bộ cụm dịch vụ:**
   ```bash
   docker compose up -d --build
   ```

3. **Kiểm tra trạng thái:**
   ```bash
   docker compose ps
   ```
   Đảm bảo tất cả 11 container (`attendance-nginx`, `attendance-app`, `attendance-mysql`, `attendance-phpmyadmin`, `attendance-prometheus`, `attendance-grafana`, `attendance-cadvisor`, `attendance-mysqld-exporter`, `attendance-nginx-exporter`, `attendance-loki`, `attendance-promtail`) đều ở trạng thái `healthy` hoặc `Up`.

### C. Dừng và Quản lý hệ thống
* **Tạm dừng hệ thống (giữ nguyên container):**
  ```bash
  docker compose stop
  ```
* **Khởi động lại hệ thống đang dừng:**
  ```bash
  docker compose start
  ```
* **Dừng và xóa container (vẫn giữ nguyên dữ liệu trong named volumes):**
  ```bash
  docker compose down
  ```

---

## 10. Đường dẫn truy cập & Tài khoản mặc định

> **Lưu ý về IP:** Thay `<IP_MÁY_CHỦ>` bằng địa chỉ IP máy ảo thực tế của bạn (lấy nhanh bằng lệnh `hostname -I | awk '{print $1}'`). Địa chỉ IP máy ảo demo trong quá trình phát triển là `192.168.203.128`.

* **Website Điểm danh:** `http://<IP_MÁY_CHỦ>` (Port 80)
  * Tài khoản: Quản trị viên cấu hình tại `ADMIN_USERNAME` và `ADMIN_PASSWORD` trong `.env`.
* **Grafana Dashboards & Logs:** `http://<IP_MÁY_CHỦ>:3000` (Port 3000)
  * Tài khoản: `GRAFANA_ADMIN_USER` (mặc định: `admin`) và `GRAFANA_ADMIN_PASSWORD` trong `.env`.
  * Đường dẫn Dashboard: **Dashboards -> Attendance Monitoring -> Attendance System Monitoring**.
  * Đường dẫn LogQL: **Explore -> Datasource "Loki"**.
* **phpMyAdmin:** `http://<IP_MÁY_CHỦ>:8088` (Port 8088)
  * Tài khoản CSDL: `attendance_app` và mật khẩu `DB_PASSWORD` trong `.env`.
* **Prometheus Web UI:** `http://<IP_MÁY_CHỦ>:9090` (Port 9090)
  * Kiểm tra mục **Status -> Targets** để xác minh 5/5 targets UP.

---

## 11. Xử lý sự cố thường gặp (Troubleshooting)

1. **Không mở được Website trên Port 80:**
   * Kiểm tra port xung đột: `sudo ss -lntp | grep :80`
   * Kiểm tra container Nginx: `docker compose logs nginx --tail 50`
   * Kiểm tra App container: `docker compose logs app --tail 50`
2. **Prometheus báo Target `mysqld-exporter` DOWN:**
   * Kiểm tra tài khoản `attendance_exporter` trong MySQL:
     ```bash
     docker compose exec mysql mysql -uroot -p$MYSQL_ROOT_PASSWORD -e "SELECT User, Host FROM mysql.user WHERE User='attendance_exporter';"
     ```
   * Kiểm tra biến `MYSQL_EXPORTER_PASSWORD` trong `.env` có trùng khớp cấu hình.
3. **Grafana không hiển thị Log từ Loki:**
   * Kiểm tra Promtail đã gửi log thành công: `docker compose logs promtail --tail 30`
   * Kiểm tra Loki container: `docker compose logs loki --tail 30`
   * Kiểm tra mạng `logging_net` giữa Grafana, Loki và Promtail:
     ```bash
     docker network inspect attendance-system_logging_net
     ```
4. **App báo lỗi phân quyền Database (ER_TABLEACCESS_DENIED_ERROR):**
   * Quyền của `attendance_app` chỉ gồm `SELECT, INSERT, UPDATE, DELETE`. Nếu có script di chuyển schema mới, cần chạy dưới quyền `root` qua container `attendance-mysql`.

---

## 12. Chiến lược Git Commit (Git Commit Strategy)

Lịch sử Git được tổ chức chuẩn hóa theo Conventional Commits, phản ánh từng bước phát triển của dự án:
1. `c87690f feat: deploy attendance app with MySQL and Nginx reverse proxy`: Khởi tạo ứng dụng Express, MySQL, Nginx, Dockerfile, Docker Compose cơ bản.
2. `dc04834 fix: polish Vietnamese UI and date formatting`: Hoàn thiện giao diện tiếng Việt, định dạng ngày giờ chuẩn Việt Nam, font Be Vietnam Pro.
3. `ea2684b feat: add Prometheus and Grafana monitoring stack`: Triển khai Prometheus, Grafana, 3 exporter, cAdvisor và auto-provisioning dashboard.
4. `cc48516 feat: add centralized logging and system hardening`: Tích hợp cụm Loki + Promtail, chuẩn hóa log JSON, áp dụng system hardening (no-new-privileges, cap_drop, read_only, log rotation).
5. `7c3506b fix: restrict application database privileges`: Tinh chỉnh phân quyền MySQL cho tài khoản `attendance_app` tuân thủ nghiêm ngặt Least Privilege (SELECT, INSERT, UPDATE, DELETE).
6. *(Commit tài liệu bàn giao cuối)*: Bổ sung tài liệu kiểm thử toàn diện `FINAL_TEST_EVIDENCE.md` và `DEMO_COMMANDS.md`.

---

## 13. Tài liệu Kiểm thử & Kịch bản Demo

* **Bằng chứng kiểm thử chi tiết:** Xem tại [`docs/FINAL_TEST_EVIDENCE.md`](docs/FINAL_TEST_EVIDENCE.md) (bao gồm bảng tổng hợp kiểm thử E2E, metrics Prometheus, panel Grafana, truy vấn LogQL, kiểm tra phân quyền MySQL, test khôi phục dữ liệu).
* **Bảng tra cứu lệnh demo nhanh:** Xem tại [`docs/DEMO_COMMANDS.md`](docs/DEMO_COMMANDS.md) (dành cho giảng viên và sinh viên khi báo cáo đề tài).
