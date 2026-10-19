# Hệ thống Điểm danh (Attendance System) - Đề tài 27

Bài thi kết thúc học phần: **Triển khai và Quản trị Hệ thống Phần mềm**

---

## 1. Giới thiệu tổng quan
Hệ thống Điểm danh (Attendance System) là ứng dụng web cho phép quản lý nhân sự (sinh viên / nhân viên), thiết lập các ca học / ca làm việc và thực hiện điểm danh ra/vào (Check-in / Check-out) thời gian thực. Hệ thống tự động đối chiếu thời gian điểm danh thực tế với quy định ca để xác định trạng thái **Đúng giờ (on_time)** hoặc **Đi muộn (late)**, đồng thời lưu trữ lịch sử điểm danh bền vững trong cơ sở dữ liệu MySQL thật.

---

## 2. Công nghệ sử dụng (Stack)

* **Backend & Web Application:** Node.js 24 LTS (`node:24.21.0-alpine`), Express 5, EJS Template Engine. Ứng dụng được đóng gói qua Docker image build nội bộ `attendance-system-app` từ `app/Dockerfile`.
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
* **Phương thức triển khai:** Docker Engine & Docker Compose (toàn bộ 10 image bên thứ ba đều được pin phiên bản cụ thể, không sử dụng `:latest`; `attendance-system-app` là image build nội bộ từ Dockerfile).

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
  * **Nginx Security Headers chuẩn OWASP:** Cấu hình đầy đủ `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, và `Content-Security-Policy` (`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self';`). Ẩn thông tin phiên bản máy chủ bằng `server_tokens off`.
  * **Cơ chế bảo vệ CSRF Token:**
    * Sử dụng middleware `initCsrf` với cơ chế lazy-load getter (`Object.defineProperty(res.locals, 'csrfToken', ...)`): chỉ sinh mã CSRF token ngẫu nhiên an toàn 32-byte hex (`crypto.randomBytes(32).toString('hex')`) khi view thực sự render form cần token. Cơ chế này ngăn chặn tạo session rác không cần thiết trong database đối với các request GET tĩnh hoặc endpoint giám sát (`/healthz`, `/metrics`).
    * Middleware `verifyCsrf` kiểm tra bắt buộc CSRF token trên toàn bộ các phương thức thay đổi trạng thái (POST). Hỗ trợ nhận token qua trường form `_csrf` hoặc HTTP header (`X-CSRF-Token`, `CSRF-Token`).
    * So sánh token an toàn bằng `crypto.timingSafeEqual` nhằm phòng chống rủi ro Timing Attack.
    * Cơ chế xoay vòng token (`rotateCsrf`): Tự động tạo token mới sau các thao tác nhạy cảm (như đăng nhập thành công).
  * **Tái tạo phiên đăng nhập (Session Regeneration):**
    * Khi người dùng đăng nhập thành công (`authController.login`), hệ thống gọi `req.session.regenerate()` để hủy phiên cũ và cấp phát session ID hoàn toàn mới trước khi lưu thông tin người dùng vào CSDL MySQL. Cơ chế này giúp ngăn ngừa nguy cơ tấn công cố định phiên (Session Fixation).
    * Khi đăng xuất (`POST /logout`), phiên làm việc bị xóa vĩnh viễn trên server (`req.session.destroy()`) và xóa cookie phía client.
  * **Chống lưu đệm trình duyệt (Anti-Browser Cache / BFCache Mitigation):**
    * Thiết lập đồng bộ các tiêu đề HTTP trên các trang yêu cầu xác thực (`authMiddleware.requireAuth`) và trang đăng nhập (`authController.showLogin`):
      * `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate`
      * `Pragma: no-cache`
      * `Expires: 0`
    * Đảm bảo sau khi đăng xuất, người dùng không thể bấm nút "Back" trên trình duyệt để xem lại dữ liệu nội bộ được lưu trong bộ nhớ đệm (Back-Forward Cache).
  * **Bảo mật Cookie:** Cookie phiên làm việc `attendance_sid` được thiết lập `HttpOnly: true`, `SameSite: 'lax'`.
  * **Lưu trữ phiên bền vững:** Phiên làm việc được lưu trữ server-side trên bảng `sessions` của MySQL thông qua `express-mysql-session`.
* **Giới hạn kích thước Log (Log Rotation):**
  * Toàn bộ 11 dịch vụ được cấu hình Docker logging driver `json-file` với giới hạn `max-size: "10m"` và `max-file: "3"`, ngăn chặn tình trạng cạn kiệt dung lượng ổ đĩa.
* **Các trường hợp ngoại lệ an ninh (Security Exceptions & Rationale):**
  * `cadvisor`: Cần cờ `privileged: true` và mount `/sys`, `/dev/kmsg`, `/var/lib/docker` để thu thập số liệu phần cứng và tài nguyên của các container Docker trên host.
  * `promtail`: Cần mount read-only `/var/run/docker.sock` và `/var/lib/docker/containers` để thực hiện Docker Service Discovery và đọc log container theo yêu cầu bài thi.
  * `COOKIE_SECURE=false`: Do môi trường bài thi triển khai trên HTTP IP nội bộ (`http://192.168.203.128`). Khi triển khai trên môi trường sản xuất có chứng chỉ TLS/HTTPS, biến này sẽ được bật thành `true`.
  * `Promtail EOL`: Promtail đã EOL nhưng tiếp tục được sử dụng trong phạm vi đề tài để đáp ứng tiêu chí bài thi (hệ thống thực tế nên cân nhắc Grafana Alloy).

---

## 7. Cấu trúc Cơ sở Dữ liệu (Database Schema)

Cơ sở dữ liệu `attendance_db` được chuẩn hóa với 5 bảng chính, khóa ngoại có tính toàn vẹn tham chiếu (`ON DELETE RESTRICT`). Script khởi tạo [`database/init/01-schema-and-seed.sql`](database/init/01-schema-and-seed.sql) thiết lập `SET NAMES utf8mb4;` nhằm đảm bảo client MySQL sử dụng đúng bảng mã khi import dữ liệu mẫu tiếng Việt:

1. **`users`:** Quản trị viên hệ thống
   * `id`: INT AUTO_INCREMENT PRIMARY KEY
   * `username`: VARCHAR(50) NOT NULL UNIQUE (Tên đăng nhập quản trị viên)
   * `password_hash`: VARCHAR(255) NOT NULL (Mật khẩu băm an toàn bằng bcrypt; tên cột thực tế là `password_hash`)
   * `full_name`: VARCHAR(100) NOT NULL (Họ và tên quản trị viên)
   * `created_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   * *Engine / Charset / Collation:* InnoDB, UTF8MB4 (`utf8mb4_unicode_ci`)
2. **`members`:** Thành viên / Nhân sự điểm danh
   * `id`: INT AUTO_INCREMENT PRIMARY KEY
   * `code`: VARCHAR(20) NOT NULL UNIQUE (Mã nhân sự / sinh viên, ví dụ: DTC101)
   * `full_name`: VARCHAR(100) NOT NULL (Họ và tên thành viên; tên cột thực tế là `full_name`)
   * `email`: VARCHAR(100) NULL (Địa chỉ email liên hệ)
   * `department`: VARCHAR(100) NOT NULL (Khoa / Phòng ban)
   * `created_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   * *Chỉ mục (Indexes):* `INDEX idx_member_name (full_name)`, `INDEX idx_member_department (department)`
   * *Engine / Charset / Collation:* InnoDB, UTF8MB4 (`utf8mb4_unicode_ci`)
3. **`shifts`:** Ca học / Ca làm việc
   * `id`: INT AUTO_INCREMENT PRIMARY KEY
   * `name`: VARCHAR(50) NOT NULL (Tên ca, giới hạn tối đa 50 ký tự)
   * `start_time`: TIME NOT NULL (Giờ bắt đầu ca, định dạng `HH:mm:ss`)
   * `end_time`: TIME NOT NULL (Giờ kết thúc ca, định dạng `HH:mm:ss`)
   * `late_after_minutes`: INT NOT NULL DEFAULT 15 (Số phút cho phép đi muộn hợp lệ; tên cột thực tế là `late_after_minutes`)
   * `created_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   * *Engine / Charset / Collation:* InnoDB, UTF8MB4 (`utf8mb4_unicode_ci`)
   * *(Lưu ý: Bảng shifts trên database chính hiện CHƯA áp dụng ràng buộc UNIQUE cho tên ca; tính duy nhất hiện được bảo vệ ở tầng ứng dụng).*
4. **`attendance`:** Bản ghi điểm danh thời gian thực
   * `id`: INT AUTO_INCREMENT PRIMARY KEY
   * `member_id`: INT NOT NULL, `CONSTRAINT fk_attendance_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE RESTRICT`
   * `shift_id`: INT NOT NULL, `CONSTRAINT fk_attendance_shift FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE RESTRICT`
   * `attendance_date`: DATE NOT NULL (Ngày điểm danh, định dạng `YYYY-MM-DD`)
   * `check_in`: TIME NULL (Giờ Check-in thực tế, định dạng `HH:mm:ss`)
   * `check_out`: TIME NULL (Giờ Check-out thực tế, định dạng `HH:mm:ss`)
   * `status`: ENUM('on_time', 'late') NOT NULL DEFAULT 'on_time' (Trạng thái Đúng giờ hoặc Đi muộn)
   * `notes`: VARCHAR(255) NULL (Ghi chú điểm danh)
   * `created_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   * *Ràng buộc duy nhất (Unique Constraint):* `CONSTRAINT uq_member_shift_date UNIQUE (member_id, shift_id, attendance_date)`: Ngăn chặn check-in trùng lặp cho cùng thành viên, cùng ca trong một ngày.
   * *Chỉ mục (Indexes):* `INDEX idx_attendance_date (attendance_date)`, `INDEX idx_attendance_member (member_id)`, `INDEX idx_attendance_shift (shift_id)`
   * *Engine / Charset / Collation:* InnoDB, UTF8MB4 (`utf8mb4_unicode_ci`)
5. **`sessions`:** Bảng lưu trữ phiên đăng nhập (`express-mysql-session`)
   * `session_id`: VARCHAR(128) COLLATE utf8mb4_bin NOT NULL PRIMARY KEY
   * `expires`: INT(11) UNSIGNED NOT NULL (Thời điểm hết hạn phiên theo Unix Epoch time)
   * `data`: MEDIUMTEXT COLLATE utf8mb4_bin (Dữ liệu phiên làm việc được tuần tự hóa)
   * *Chỉ mục (Indexes):* `INDEX idx_sessions_expires (expires)`
   * *Engine / Charset / Collation:* InnoDB, UTF8MB4 (`utf8mb4_bin`)

---

## 8. Quy tắc Nghiệp vụ Điểm danh & Quản trị Ca (Business Validation & Attendance Rules)

Hệ thống triển khai chặt chẽ các quy tắc nghiệp vụ tại tầng Application Controllers nhằm đảm bảo tính toàn vẹn dữ liệu, kiểm soát thời gian điểm danh thực tế và ngăn ngừa các lỗi tranh chấp đồng thời:

### A. Quy tắc Check-in Điểm danh
1. **Khung giờ cho phép Check-in:**
   * **Giới hạn Check-in sớm tối đa 30 phút:** Hệ thống chỉ cho phép thành viên check-in trong khoảng thời gian từ tối đa 30 phút trước giờ bắt đầu ca đến trước giờ kết thúc ca (`[start_time - 30 phút, end_time)`). Nếu thực hiện check-in trước mốc này, hệ thống từ chối và thông báo: *"Chưa đến thời gian cho phép điểm danh ca ... (chỉ cho phép từ 30 phút trước giờ bắt đầu ...)"*.
   * **Không cho phép Check-in khi ca đã kết thúc:** Nếu thời điểm điểm danh đã chạm hoặc vượt quá giờ kết thúc ca (`currentMinutes >= shiftEndMinutes`), hệ thống lập tức từ chối với thông báo: *"Ca làm việc ... đã kết thúc lúc ..., không thể điểm danh!"*.
   * **Đồng bộ thời gian Việt Nam:** Ngày (`dateStr`) và giờ (`timeStr`) được trích xuất từ cùng một thời điểm `Date` duy nhất qua hàm tiện ích `getVietnamDateTime()`, hạn chế tối đa rủi ro lệch giây khi chuyển giao ngày/giờ.
2. **Quy tắc Chống điểm danh đồng thời (Single Active Attendance) & Chuyển ca:**
   * **Bảo vệ bằng Transaction ACID & Khóa bi quan:** Quá trình check-in thực thi trong một MySQL Transaction với câu lệnh `SELECT ... FROM members WHERE code = ? FOR UPDATE` nhằm khóa dòng thành viên, ngăn ngừa race condition khi có nhiều yêu cầu check-in gửi đồng thời cho cùng một người.
   * **Quy tắc Single Active Attendance (TC-081):** Trong cùng một ngày (`attendance_date`), hệ thống không cho phép thành viên check-in vào một ca mới nếu đang có một ca khác chưa check-out (`check_out IS NULL`) VÀ ca đó vẫn chưa kết thúc thời gian ca (`currentMinutes < end_time`). Hệ thống sẽ yêu cầu: *"Thành viên ... đang trong ca ... (chưa check-out). Vui lòng check-out ca trước khi điểm danh ca mới!"*.
   * **Quy tắc chuyển ca:** Nếu thành viên đã hoàn thành check-out ca trước HOẶC ca trước đó đã kết thúc thời gian quy định (`currentMinutes >= end_time`), hệ thống cho phép thành viên check-in vào ca mới tiếp theo trong ngày.
   * **Chống trùng lặp theo ca trong ngày:** Ràng buộc `UNIQUE KEY uq_member_shift_date (member_id, shift_id, attendance_date)` đảm bảo mỗi thành viên chỉ được ghi nhận 1 bản ghi điểm danh duy nhất cho mỗi ca trong ngày.

### B. Quy tắc Check-out Điểm danh
* **Cập nhật nguyên tử (Atomic UPDATE):** Câu lệnh check-out được thực thi dưới dạng nguyên tử:
  ```sql
  UPDATE attendance SET check_out = ? WHERE id = ? AND check_out IS NULL;
  ```
* **Chống double-click & Race condition:** Hệ thống kiểm tra `result.affectedRows === 0`. Nếu số dòng bị ảnh hưởng bằng 0, hệ thống phân biệt rõ giữa trường hợp bản ghi không tồn tại với trường hợp thành viên đã check-out từ trước để trả về thông báo lỗi thân thiện, ngăn ngừa rủi ro race condition khi người dùng click check-out liên tiếp nhiều lần.

### C. Quy tắc Cấu hình Ca làm việc (Shifts Management)
1. **Ràng buộc thời lượng và thông số ca:**
   * **Thời lượng tối thiểu 30 phút:** Tổng thời lượng ca (`end_time - start_time`) bắt buộc phải từ 30 phút trở lên (`durationSeconds >= 1800`), được tính toán chính xác tới từng giây qua hàm `timeToSeconds()`.
   * **Tính hợp lệ của khung giờ:** Giờ kết thúc bắt buộc phải lớn hơn giờ bắt đầu (`end_time > start_time`). Giờ bắt đầu và kết thúc phải đúng định dạng thời gian (`HH:mm` hoặc `HH:mm:ss`).
   * **Độ dài tên ca:** Tên ca không được để trống và không vượt quá 50 ký tự (`trimmedName.length <= 50`).
   * **Số phút cho phép đi muộn (`late_after_minutes`):** Bắt buộc là số nguyên không âm và phải nhỏ hơn tổng thời lượng của ca.
2. **Cơ chế chống trùng tên ca & Trạng thái Migration CSDL:**
   * **Tầng ứng dụng (Application Level):** Hàm `createShift` và `updateShift` sử dụng MySQL Advisory Lock (`GET_LOCK('attendance:shifts:name_unique', 5)`) và chuẩn hóa chuỗi `normalizeShiftName` (loại bỏ khoảng trắng thừa đầu/cuối, gom nhiều khoảng trắng liên tiếp và so sánh không phân biệt hoa/thường) nhằm chống xung đột tranh chấp khi tạo hoặc cập nhật ca.
   * **Migration CSDL (`database/migrations/20261017_add_unique_shift_name.sql`):** Được thiết kế theo cơ chế DDL Atomic để bổ sung cột sinh `normalized_name VARCHAR(50) GENERATED ALWAYS AS (REGEXP_REPLACE(TRIM(name), '[[:space:]]+', ' ')) STORED` và ràng buộc `UNIQUE KEY uq_shifts_normalized_name (normalized_name)`.
   * **TÌNH TRẠNG HIỆN TẠI (LƯU Ý QUAN TRỌNG):** Migration UNIQUE tên ca **CHƯA ĐƯỢC ÁP DỤNG LÊN DATABASE CHÍNH** (trạng thái Review Only). Lý do: Trên database chính hiện đang tồn tại 2 ca làm việc trùng tên từ dữ liệu kiểm thử lịch sử cũ (`id = 10`: 'Ca test' và `id = 15`: 'Ca test'). Nếu chạy DDL trực tiếp, MySQL sẽ báo lỗi vi phạm khóa duy nhất `ERROR 1062 (23000): Duplicate entry 'Ca test'`. Cần có quy trình DBA xử lý riêng (đổi tên ca cũ, ví dụ đổi tên ca `id = 15` thành 'Ca test (lịch sử)') trước khi chính thức áp dụng script migration này.

### D. Phân trang Lịch sử Điểm danh (History Pagination)
* **Phân trang server-side chuẩn hóa (TC-093):** Route `GET /attendance/history` hỗ trợ phân trang phía máy chủ với kích thước cố định 100 bản ghi/trang (`limit = 100`).
* **Chuẩn hóa tham số truy vấn:** Tham số `page` được chuẩn hóa thành số nguyên dương (mặc định là trang 1). Nếu người dùng nhập số trang vượt quá tổng số trang (`page > totalPages`), hệ thống tự động đưa về trang cuối cùng khả dụng (`clamp page = totalPages`).
* **Sắp xếp ổn định (Stable Sort):** Kết hợp 3 khóa sắp xếp `ORDER BY a.attendance_date DESC, a.check_in DESC, a.id DESC` để đảm bảo thứ tự hiển thị không bị nhảy vị trí giữa các trang.
* **Bảo toàn bộ lọc khi chuyển trang:** Toàn bộ tham số lọc (`date`, `member_id`, `status`) được tự động mã hóa và duy trì qua URL query string khi người dùng điều hướng qua các trang.

---

## 9. Danh mục Named Volumes (Data Persistence)

Toàn bộ trạng thái và dữ liệu của hệ thống được bảo toàn khi dừng hoặc tạo lại container:
* `mysql_data`: Dữ liệu bảng, người dùng và chỉ mục MySQL 8.4.
* `prometheus_data`: Dữ liệu chuỗi thời gian (time-series TSDB).
* `grafana_data`: Cấu hình người dùng, trạng thái giao diện Grafana.
* `loki_data`: Khối dữ liệu nhật ký (chunks TSDB schema v13) của Grafana Loki.
* `promtail_positions`: Vị trí offset đọc log container của Promtail (`positions.yaml`).

---

## 10. Yêu cầu môi trường & Khởi chạy

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

## 11. Đường dẫn truy cập & Tài khoản mặc định

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

## 12. Xử lý sự cố thường gặp (Troubleshooting)

1. **Không mở được Website trên Port 80:**
   * Kiểm tra port xung đột: `sudo ss -lntp | grep :80`
   * Kiểm tra container Nginx: `docker compose logs nginx --tail 50`
   * Kiểm tra App container: `docker compose logs app --tail 50`
2. **Prometheus báo Target `mysqld-exporter` DOWN:**
   * Kiểm tra tài khoản `attendance_exporter` trong MySQL:
     ```bash
     docker compose exec mysql mysql -uroot -p -e "SELECT User, Host FROM mysql.user WHERE User='attendance_exporter';"
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

## 13. Chiến lược Git Commit (Git Commit Strategy)

Lịch sử Git được tổ chức chuẩn hóa theo Conventional Commits, phản ánh từng bước phát triển của dự án:
1. `c87690f feat: deploy attendance app with MySQL and Nginx reverse proxy`: Khởi tạo ứng dụng Express, MySQL, Nginx, Dockerfile, Docker Compose cơ bản.
2. `dc04834 fix: polish Vietnamese UI and date formatting`: Hoàn thiện giao diện tiếng Việt, định dạng ngày giờ chuẩn Việt Nam, font Be Vietnam Pro.
3. `ea2684b feat: add Prometheus and Grafana monitoring stack`: Triển khai Prometheus, Grafana, 3 exporter, cAdvisor và auto-provisioning dashboard.
4. `cc48516 feat: add centralized logging and system hardening`: Tích hợp cụm Loki + Promtail, chuẩn hóa log JSON, áp dụng system hardening (no-new-privileges, cap_drop, read_only, log rotation).
5. `7c3506b fix: restrict application database privileges`: Tinh chỉnh phân quyền MySQL cho tài khoản `attendance_app` tuân thủ nghiêm ngặt Least Privilege (SELECT, INSERT, UPDATE, DELETE).
6. `701e255 docs: add final test evidence and demo guide`: Bổ sung tài liệu kiểm thử toàn diện `FINAL_TEST_EVIDENCE.md` và bảng tra cứu lệnh demo `DEMO_COMMANDS.md`.
7. `5c52470 chore: refresh demo member data`: Cập nhật dữ liệu danh sách thành viên demo.
8. `75234db fix: replace inline event handlers for CSP compatibility`: Loại bỏ inline event handler để tương thích CSP.
9. `489881d fix: ensure UTF-8 encoding during database initialization`: Đảm bảo encoding UTF-8 khi khởi tạo CSDL.
10. `3e39fd7 fix: harden attendance security and business validation`: Gia cố an ninh toàn diện (CSRF lazy-load, session regeneration, anti-cache headers), chuẩn hóa quy tắc nghiệp vụ (giới hạn check-in sớm tối đa 30p, cấm check-in ca đã kết thúc, ca tối thiểu 30p, quy tắc chuyển ca và single active attendance, phân trang lịch sử 100 bản ghi/trang, advisory lock chống trùng tên ca).

---

## 14. Tài liệu Kiểm thử & Kịch bản Demo

* **Bằng chứng kiểm thử chi tiết:** Xem tại [`docs/FINAL_TEST_EVIDENCE.md`](docs/FINAL_TEST_EVIDENCE.md) (bao gồm kết quả đợt test 163 ca ban đầu, phân định môi trường clone vs website chính, trạng thái deployment commit 3e39fd7, metrics Prometheus, panel Grafana, truy vấn LogQL, kiểm tra phân quyền MySQL, test khôi phục dữ liệu).
* **Bảng tra cứu lệnh demo nhanh:** Xem tại [`docs/DEMO_COMMANDS.md`](docs/DEMO_COMMANDS.md) (dành cho giảng viên và sinh viên khi báo cáo đề tài).
