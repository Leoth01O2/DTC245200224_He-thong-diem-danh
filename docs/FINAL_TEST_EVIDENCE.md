# Bằng chứng Kiểm thử Toàn diện Hệ thống (Final Test Evidence)

**Dự án:** Hệ thống Điểm danh (Attendance System) - Đề tài 27
**Môi trường triển khai chính:** Ubuntu Linux máy ảo (`192.168.203.128`)
**Trạng thái triển khai hiện tại:** Commit `3e39fd7` (`fix: harden attendance security and business validation`)

---

## 1. Nguồn Dữ liệu & Ba Nhóm Bằng chứng Kiểm thử

Tài liệu này tổng hợp bằng chứng kiểm thử của hệ thống dựa trên nguyên tắc trung thực kỹ thuật, minh bạch về nguồn dữ liệu và phân định ranh giới rõ ràng giữa ba nhóm bằng chứng:

> [!NOTE]
> **Lưu ý quan trọng về nguồn dữ liệu 163 test case:**
> File Excel gốc gồm 163 test case chưa được cung cấp cho Antigravity. Toàn bộ số liệu về đợt kiểm thử 163 test case dưới đây được người dùng cung cấp sau khi đối chiếu file Excel gốc, không phải do Antigravity tự đọc file Excel hay tự động chạy toàn bộ.

### Nhóm 1: Đợt kiểm thử 163 test case ban đầu (15–17/10/2026)
* **Nguồn dữ liệu:** Do người dùng cung cấp từ file Excel theo dõi tiến độ kiểm thử của dự án.
* **Thời gian ghi nhận:** Từ ngày 15/10/2026 đến ngày 17/10/2026.
* **Người kiểm thử ghi trong Excel:**
  * **Hưng:** 143 test cases.
  * **Antigravity:** 20 test cases.
* **Phạm vi môi trường ghi trong Excel:** Có **19 test cases** được đánh dấu phạm vi "Clone riêng" (phục vụ các bài test sự cố hoặc dữ liệu biên nặng). Các test case còn lại được thực hiện trên môi trường phát triển / kiểm thử thông thường; không tuyên bố toàn bộ 163 case đều chạy trên clone hoặc đều là test tự động.
* **Kết quả ghi nhận ban đầu trong Excel:**
  * **145 PASS**
  * **16 BLOCKED** (chủ yếu do thiếu CSRF token trong harness kiểm thử, thiếu phân trang khi test > 100 bản ghi, tranh chấp race condition check-in đồng thời, chưa chặn check-in sau khi ca kết thúc, v.v.)
  * **1 FAIL**
  * **1 N/A**
* **Nguyên tắc đánh giá:** Bản sửa lỗi commit `3e39fd7` đã hoàn thành cài đặt mã nguồn nhằm giải quyết nguyên nhân gốc của các ca BLOCKED và FAIL. Tuy nhiên, **tài liệu KHÔNG tuyên bố cả 163 test case đã PASS 100% khi chưa có bằng chứng chạy lại đầy đủ trọn bộ test suite (re-run full suite)**.

### Nhóm 2: Regression bổ sung của Antigravity (17–18/10/2026)
Ghi nhận các nội dung kiểm thử bổ sung do Antigravity thực hiện từ worktree `attendance-system-fix` (nhánh `fix/post-test-review`), bao gồm cả các kiểm thử truy cập cổng 80 của hệ thống chính và các kịch bản chạy trên môi trường clone cô lập:
* **3 test case P0:** TC-076 (kiểm tra phân quyền Least Privilege MySQL của `attendance_app`), TC-077 (bảo toàn dữ liệu volume qua restart), TC-127 (quét mã nguồn working tree không rò rỉ secret).
* **4 test case P2:** TC-013 (kiểm thử hết hạn phiên session và cookie), TC-080 (chặn check-in khi ca làm việc đã kết thúc), TC-093 (lịch sử điểm danh phân trang server-side > 100 bản ghi), TC-124 (kiểm thử từ chối khi thiếu hoặc sai CSRF token).
* **Batch test 9 test case biên & bảo mật:** TC-034, TC-035, TC-052, TC-053 (validation dữ liệu thành viên và ca làm việc), TC-074 (chống trùng lặp ca cùng ngày), TC-078, TC-079 (tính toán đi muộn và thời gian ân hạn), TC-119, TC-120 (bảo mật header HTTP và cookie flags).
* **3 test case sự cố & ngoại lệ (Fault Injection):** TC-132 (kiểm tra nạp dữ liệu tiếng Việt seed UTF-8), TC-159 (Nginx trả về 502 khi App container không sẵn sàng), TC-160 (App xử lý và phục hồi khi MySQL mất kết nối ngắn).
* **Kiểm chứng logic nghiệp vụ mới:** Khóa MySQL Advisory Lock (`attendance:shifts:name_unique`) chống tạo/sửa trùng tên ca, validation thời lượng ca tối thiểu 30 phút tính theo giây, Single Active Attendance (TC-081) chống điểm danh đồng thời nhiều ca.

### Nhóm 3: Kiểm tra Website chính sau triển khai commit 3e39fd7 (18/10/2026)
Chỉ ghi nhận các nội dung đã thực sự được xác nhận trên Website chính (`http://192.168.203.128`) chạy cụm Docker Compose chuẩn:
* **Xác thực & Phiên làm việc:** Đăng nhập quản trị viên (`POST /login` với session regeneration chống Session Fixation), Đăng xuất (`POST /logout` hủy session CSDL và cookie).
* **Chống quay lại sau đăng xuất (Anti-BFCache):** Tiêu đề `Cache-Control: no-store, no-cache, must-revalidate`, `Pragma: no-cache`, `Expires: 0` ngăn trình duyệt hiển thị lại Dashboard khi bấm nút "Back" sau logout.
* **Giao diện người dùng:** Thông báo flash tự động ẩn sau 4 giây, typography nhúng nội bộ Be Vietnam Pro, hiển thị định dạng ngày giờ chuẩn Việt Nam.
* **Chống trùng tên ca:** Kiểm tra xử lý từ chối khi nhập tên ca trùng lặp ở tầng ứng dụng qua form.
* **11/11 container Docker:** Tất cả ở trạng thái `healthy` hoặc `Up`.
* **Prometheus:** 5/5 scrape targets UP (`attendance-app`, `cadvisor`, `mysql`, `nginx`, `prometheus`).
* **Grafana & Giám sát:** Dashboard được cấu hình 18 panels qua 4 Rows; đã kiểm tra Grafana database OK (`HTTP 200`, version `13.2.2`), Prometheus 5/5 targets UP và Loki có log (không khẳng định đã trực tiếp nghiệm thu từng panel riêng lẻ nếu chưa có bằng chứng).
* **Loki + Promtail:** Truy vấn thành công log JSON có cấu trúc của Attendance App qua range query `{compose_service="app"}`.

---

## 2. Danh mục Dịch vụ Container (Docker Service Inventory - Website Chính)

| Service Name | Container Name | Image Nguồn / Base Image | Status | Port Exposure | Đánh giá |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `nginx` | `attendance-nginx` | `nginx:1.30.5-alpine` | Up (healthy) | `0.0.0.0:80->80/tcp` (Public) | **PASS** (Website chính 18/10) |
| `app` | `attendance-app` | `attendance-system-app` (Build nội bộ từ `node:24.21.0-alpine`) | Up (healthy) | `3000/tcp` (Private internal) | **PASS** (Website chính 18/10) |
| `mysql` | `attendance-mysql` | `mysql:8.4.11` | Up (healthy) | `3306/tcp, 33060/tcp` (Private internal) | **PASS** (Website chính 18/10) |
| `phpmyadmin` | `attendance-phpmyadmin` | `phpmyadmin:5.2.3-apache` | Up | `0.0.0.0:8088->80/tcp` (Public) | **PASS** (Website chính 18/10) |
| `prometheus` | `attendance-prometheus` | `prom/prometheus:v3.14.0` | Up | `0.0.0.0:9090->9090/tcp` (Public) | **PASS** (Website chính 18/10) |
| `grafana` | `attendance-grafana` | `grafana/grafana:13.2.2` | Up (healthy) | `0.0.0.0:3000->3000/tcp` (Public) | **PASS** (Website chính 18/10) |
| `cadvisor` | `attendance-cadvisor` | `ghcr.io/google/cadvisor:v0.60.6` | Up (healthy) | `8080/tcp` (Private internal) | **PASS** (Website chính 18/10) |
| `mysqld-exporter`| `attendance-mysqld-exporter` | `prom/mysqld-exporter:v0.20.0` | Up | `9104/tcp` (Private internal) | **PASS** (Website chính 18/10) |
| `nginx-exporter` | `attendance-nginx-exporter` | `nginx/nginx-prometheus-exporter:1.5.1` | Up | `9113/tcp` (Private internal) | **PASS** (Website chính 18/10) |
| `loki` | `attendance-loki` | `grafana/loki:3.7.0` | Up | `3100/tcp` (Private internal) | **PASS** (Website chính 18/10) |
| `promtail` | `attendance-promtail` | `grafana/promtail:3.6.11` | Up | Không mở cổng | **PASS** (Website chính 18/10) |

*Toàn bộ 10 image bên thứ ba đều được pin phiên bản cụ thể (không sử dụng `:latest`). Riêng `attendance-system-app` là image build nội bộ từ Dockerfile của dự án (sử dụng base image `node:24.21.0-alpine`).*

---

## 3. Bằng chứng Kiểm thử Nghiệp vụ Ứng dụng (Application Test Evidence)

*Bảng đối chiếu kết quả kiểm thử nghiệp vụ với môi trường và thời điểm kiểm chứng cụ thể:*

| Kịch bản kiểm thử | Thao tác / Endpoint | Môi trường & Thời điểm kiểm chứng | Kết quả thực tế | Đánh giá |
| :--- | :--- | :--- | :--- | :--- |
| **Đăng nhập (Login)** | `POST /login` với credentials quản trị viên | Website chính (18/10) & Regression Antigravity | Trả về HTTP 302 chuyển hướng về `/dashboard`, tái tạo session ID chống Session Fixation | **PASS** |
| **Bảng điều khiển** | `GET /dashboard` | Website chính (18/10) | Trả về HTTP 200, hiển thị đầy đủ thẻ thống kê tổng quan | **PASS** |
| **Chống quay lại sau Logout** | Bấm nút "Back" trên trình duyệt sau logout | Website chính (18/10) | Bị chặn bởi `Cache-Control: no-store`, buộc chuyển hướng về `/login` | **PASS** |
| **Thông báo tự ẩn** | Hiển thị flash message (success/error) | Website chính (18/10) | Alert message tự động mờ dần và ẩn sau 4 giây | **PASS** |
| **Thêm nhân sự** | `POST /members/create` (kèm CSRF token) | Đợt test ban đầu & Regression Antigravity (17–18/10) | Tạo mới nhân sự thành công, ghi vào CSDL MySQL | **PASS** |
| **Tìm kiếm nhân sự** | `GET /members?q=DTC...` | Đợt test ban đầu & Regression Antigravity (17–18/10) | Tìm kiếm chính xác theo mã, họ tên và phòng ban | **PASS** |
| **Sửa nhân sự** | `POST /members/:id/edit` (kèm CSRF token) | Đợt test ban đầu & Regression Antigravity (17–18/10) | Cập nhật thông tin nhân sự thành công, bảo toàn form khi lỗi | **PASS** |
| **Xóa nhân sự test**| `POST /members/:id/delete` (kèm CSRF token) | Đợt test ban đầu & Regression Antigravity (17–18/10) | Xóa bản ghi test an toàn khi chưa có dữ liệu điểm danh | **PASS** |
| **Thêm ca làm việc**| `POST /shifts/create` (kèm CSRF token) | Đợt test ban đầu & Regression Antigravity (17–18/10) | Tạo mới ca làm việc (kiểm tra thời lượng >= 30p, tên ca <= 50 ký tự) | **PASS** |
| **Chống trùng tên ca**| `POST /shifts/create` với tên ca đã tồn tại | Website chính (18/10) & Regression Antigravity | Bị chặn ở tầng ứng dụng bằng Advisory Lock, trả lỗi trùng tên | **PASS** |
| **Giới hạn thời lượng ca**| Tạo ca có thời lượng < 30 phút | Regression Antigravity (17/10) | Hệ thống từ chối và báo lỗi: Thời lượng ca phải tối thiểu 30 phút | **PASS** |
| **Sửa ca làm việc** | `POST /shifts/:id/edit` (kèm CSRF token) | Đợt test ban đầu & Regression Antigravity (17–18/10) | Cập nhật thông số ca làm việc thành công | **PASS** |
| **Xóa ca test** | `POST /shifts/:id/delete` (kèm CSRF token) | Đợt test ban đầu & Regression Antigravity (17–18/10) | Xóa ca làm việc test thành công khi chưa có dữ liệu điểm danh | **PASS** |
| **Điểm danh vào (Check-in)** | `POST /attendance/check-in` (kèm CSRF token) | Đợt test ban đầu & Regression Antigravity (17–18/10) | Ghi nhận Check-in, kiểm tra khung giờ [start - 30p, end), tính đúng giờ/muộn | **PASS** |
| **Chặn check-in ngoài giờ (TC-080)** | `POST /attendance/check-in` sớm > 30p hoặc sau ca kết thúc | Regression Antigravity (17/10) | Hệ thống từ chối và hiển thị thông báo lỗi rõ ràng | **PASS** |
| **Chống trùng Check-in** | `POST /attendance/check-in` cùng ca trong ngày cho cùng thành viên | Đợt test ban đầu & Regression Antigravity (17–18/10) | Hệ thống chặn và báo lỗi (bảo vệ bởi `uq_member_shift_date` và `FOR UPDATE`) | **PASS** |
| **Chống điểm danh đồng thời (TC-081)** | Check-in ca mới khi đang trong ca cũ chưa check-out | Regression Antigravity (17/10) | Hệ thống chặn và yêu cầu check-out ca trước (Single Active Attendance) | **PASS** |
| **Điểm danh ra (Check-out)** | `POST /attendance/check-out` (kèm CSRF token) | Đợt test ban đầu & Regression Antigravity (17–18/10) | Cập nhật `check_out` nguyên tử qua câu lệnh `UPDATE ... WHERE check_out IS NULL` | **PASS** |
| **Chống trùng Check-out**| `POST /attendance/check-out` lần 2 (double-click) | Regression Antigravity (17/10) | Hệ thống phát hiện `affectedRows === 0` và báo lỗi thân thiện | **PASS** |
| **Lọc & Phân trang Lịch sử (TC-093)** | `GET /attendance/history?date=...&member_id=...&page=...` | Đợt test ban đầu & Regression Antigravity (17–18/10) | Bộ lọc kết hợp và phân trang server-side (100 bản ghi/trang) hoạt động chuẩn xác | **PASS** |
| **Từ chối CSRF (TC-124)** | Gửi request POST không có token hoặc token sai | Regression Antigravity (17/10) | Trả về HTTP 403 Forbidden | **PASS** |
| **Đăng xuất (Logout)** | `POST /logout` (kèm CSRF token) | Website chính (18/10) & Regression Antigravity | Xóa phiên làm việc trong CSDL, hủy cookie, chuyển hướng login | **PASS** |

---

## 4. Bằng chứng Cơ sở Dữ liệu & Ràng buộc (Database Evidence)

* **Danh sách bảng CSDL:** `users`, `members`, `shifts`, `attendance`, `sessions`.
* **Ràng buộc duy nhất:** `UNIQUE KEY uq_member_shift_date (member_id, shift_id, attendance_date)` trên bảng `attendance`.
* **Khóa ngoại bảo vệ:** `fk_attendance_member` và `fk_attendance_shift` đều có hành vi `ON DELETE RESTRICT`, ngăn ngừa xóa nhầm dữ liệu gốc khi đã có lịch sử điểm danh.
* **Lưu ý Migration:** Script `database/migrations/20261017_add_unique_shift_name.sql` chưa áp dụng lên database chính (Review Only) do CSDL chính đang có 2 ca trùng tên lịch sử (`id = 10` và `id = 15`) cần xử lý riêng.
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

* **Trạng thái Scrape Targets (5/5 UP - Kiểm chứng thực tế trên Website chính):**
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
  * Dashboard được cấu hình 18 panels chia thành 4 Row chuyên sâu (System Overview, Application Traffic, MySQL Database, Container Resources); đã kiểm tra Grafana database OK, Prometheus 5/5 targets UP và Loki có log (không khẳng định đã trực tiếp nghiệm thu từng panel riêng lẻ nếu chưa có bằng chứng).
* **Đánh giá:** **PASS** (Trong phạm vi cấu hình provisioned dashboard và trạng thái dữ liệu nền tảng)

---

## 9. Bằng chứng Thu thập Nhật ký Tập trung (Loki + Promtail + LogQL Evidence)

* **Loki Readiness:** `GET http://loki:3100/ready` từ mạng nội bộ trả về `HTTP 200 ready`.
* **Promtail Discovery:** Thu thập log tự động từ Docker daemon qua socket và bóc tách cấu trúc JSON qua pipeline `docker: {}`.
* **Kiểm chứng truy vấn LogQL từ App Log (Commit `3e39fd7`):**
  * Đã xác nhận truy vấn thành công qua Loki Range Query API `{compose_service="app"}`: Trích xuất chính xác log JSON có cấu trúc gồm các trường `timestamp`, `level`, `method`, `route`, `path`, `status_code`, `latency_ms`, `ip`.
* **Minh chứng 5 câu truy vấn LogQL chuẩn hóa trên Grafana:**
  1. **Toàn bộ log ứng dụng:**
     `{compose_service="app"} | json` -> Trả về log JSON có cấu trúc đầy đủ.
  2. **Truy vấn lỗi HTTP ứng dụng:**
     `{compose_service="app"} | json | status_code >= 400` -> Trích xuất chính xác log lỗi HTTP, không gặp lỗi `LabelFilterErr`.
  3. **Truy vấn sự kiện nghiệp vụ điểm danh:**
     `{compose_service="app"} | json | action=~"CHECK_IN|CHECK_OUT"` -> Bắt được cả hai sự kiện CHECK_IN và CHECK_OUT.
  4. **Truy vấn điểm danh đi muộn:**
     `{compose_service="app"} | json | action="CHECK_IN" | attendance_status="late"` -> Lọc chính xác các lượt check-in muộn.
  5. **Truy vấn lỗi Nginx reverse proxy:**
     `{compose_service="nginx"} | json | status >= 400` -> Trích xuất toàn bộ yêu cầu lỗi từ Nginx access log.
* **Đánh giá:** **PASS**

---

## 10. Bằng chứng Bền vững Dữ liệu (Persistence Evidence)

* **Quy trình kiểm thử:** Đã kiểm thử qua restart cụm dịch vụ.
* **Kết quả:**
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

* **Quét mã nguồn ở commit hiện tại (Working Tree / HEAD):**
  * Lệnh `git grep` xác nhận không có bất kỳ mật khẩu hoặc chuỗi secret thực tế nào tồn tại trong mã nguồn hiện tại của dự án. Tệp `.env.example` chỉ chứa placeholder `change_me_*`.
  * *(Lưu ý về phạm vi kiểm toán: Kết quả kiểm tra này chỉ xác nhận trong phạm vi mã nguồn hiện tại ở commit `3e39fd7`; chưa thực hiện quét kiểm toán tự động toàn bộ lịch sử Git commit cũ bằng các công cụ chuyên sâu như TruffleHog hay Gitleaks).*
* **Quét lỗ hổng thư viện phụ thuộc:**
  * Lệnh `npm audit --omit=dev` trên môi trường container Node 24 LTS (`attendance-app`) trả về **`found 0 vulnerabilities`** đối với toàn bộ production dependencies ở thời điểm kiểm tra.
* **Đánh giá:** **PASS** (Trong phạm vi mã nguồn hiện tại và production dependencies)

---

## 13. Kiểm thử Giao diện Người dùng (UI Regression)

* **Ngôn ngữ:** 100% tiếng Việt chuẩn có dấu, không sử dụng emoji trong giao diện nghiệp vụ.
* **Phông chữ:** Nhúng cục bộ `Be Vietnam Pro`, không phụ thuộc Google Fonts bên ngoài.
* **Định dạng ngày giờ:** Hiển thị chuẩn Việt Nam `DD/MM/YYYY` và `HH:mm:ss`, không lộ chuỗi JavaScript raw Date.
* **Tương thích:** Bố cục responsive, không phát sinh lỗi CSP (Content Security Policy).
* **Đánh giá:** **PASS**

---

## 14. Bảng Tổng kết Đánh giá (Final Summary & Status)

| STT | Hạng mục kiểm thử | Trạng thái | Ghi chú minh chứng |
| :---: | :--- | :---: | :--- |
| 1 | Khởi động & Độ ổn định 11 Containers | **PASS** | 11/11 container Healthy / Up trên Website chính (commit `3e39fd7`) |
| 2 | Nghiệp vụ Điểm danh & Quản trị Nhân sự / Ca | **PASS** | E2E CRUD, Check-in/Check-out, chống trùng lặp (Đợt test ban đầu & Regression Antigravity) |
| 3 | Cơ sở dữ liệu MySQL & Quyền tối thiểu | **PASS** | Chỉ cấp SELECT, INSERT, UPDATE, DELETE cho App, 5 bảng chuẩn hóa |
| 4 | Quản lý Phiên & Cookie an toàn | **PASS** | HttpOnly, SameSite=Lax, Session Regeneration, Anti-BFCache headers |
| 5 | Nginx Reverse Proxy & Security Headers | **PASS** | OWASP Headers, server_tokens off, font Be Vietnam Pro nội bộ |
| 6 | Giám sát Prometheus (5/5 targets UP) | **PASS** | 5/5 targets UP thực tế: App, Nginx, MySQL, cAdvisor, Prometheus |
| 7 | Dashboard Grafana tự động nạp | **PASS** | Cấu hình 18 panels; Grafana database OK, Prometheus 5/5 UP, Loki có log |
| 8 | Quản lý Nhật ký tập trung Loki + Promtail | **PASS** | Đã truy vấn thành công log JSON của App qua LogQL range query |
| 9 | Bền vững Dữ liệu sau Restart | **PASS** | Toàn bộ 5 named volumes giữ nguyên vẹn dữ liệu sau restart |
| 10 | Gia cố An ninh (Hardening) | **PASS** | Non-root `node`, cap_drop ALL, read-only rootfs, .env 600, log rotation |
| 11 | Mã nguồn hiện tại sạch secret & npm audit sạch | **PASS** | 0 vulnerabilities, working tree hiện tại không có secret |
| 12 | Giao diện chuẩn Tiếng Việt & Typography | **PASS** | DD/MM/YYYY, HH:mm:ss, Be Vietnam Pro nhúng nội bộ, không emoji |
| 13 | Regression bổ sung của Antigravity (17–18/10) | **PASS** | Thực hiện từ worktree `attendance-system-fix`: P0, P2, fault injection, biên, Single Active Attendance |
| 14 | Đợt kiểm thử 163 Test Cases (15–17/10) | **Ghi nhận lịch sử (từ Excel)** | 145 PASS, 16 BLOCKED, 1 FAIL, 1 N/A (Hưng 143 case, Antigravity 20 case, 19 case clone riêng). Commit `3e39fd7` đã khắc phục nguyên nhân gốc; chưa tuyên bố 163/163 PASS khi chưa chạy lại toàn bộ test harness |
