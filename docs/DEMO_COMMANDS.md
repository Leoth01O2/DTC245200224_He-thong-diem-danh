# Bảng Tra cứu Lệnh Demo Nhanh (Demo Command Cheatsheet)

Tài liệu cung cấp các câu lệnh dòng lệnh ngắn gọn phục vụ trình diễn và nghiệm thu đồ án cùng Giảng viên.

> **Lưu ý an ninh quan trọng:**
> - Địa chỉ IP máy ảo demo hiện tại là `http://192.168.203.128` (kiểm tra động bằng lệnh `hostname -I`).
> - Tài liệu này **tuyệt đối không in mật khẩu hay chuỗi bí mật thực tế ra màn hình terminal**.
> - Mọi thao tác truy vấn cơ sở dữ liệu có xác thực đều **ưu tiên nhập mật khẩu tương tác (interactive prompt)** hoặc kiểm tra gián tiếp, tuyệt đối không truyền mật khẩu vào tham số dòng lệnh CLI.

---

## 1. Kiểm tra Địa chỉ IP & Cổng Dịch vụ
```bash
# Kiểm tra địa chỉ IP của máy ảo
hostname -I | awk '{print $1}'

# Kiểm tra các cổng đang lắng nghe công khai trên máy chủ
ss -lntp
```
* **Website Điểm danh:** `http://<VM-IP>` (Port 80)
* **Grafana Dashboards & Logs:** `http://<VM-IP>:3000` (Port 3000)
* **phpMyAdmin:** `http://<VM-IP>:8088` (Port 8088)
* **Prometheus UI:** `http://<VM-IP>:9090` (Port 9090)

---

## 2. Kiểm tra Cấu hình Môi trường An toàn (Secret Management)
```bash
# 1. Kiểm tra phân quyền an toàn của file biến môi trường (chỉ user sở hữu có quyền đọc/ghi)
stat -c '%a %n' .env
# Kết quả mong đợi: 600 .env

# 2. Kiểm tra danh sách các biến môi trường bắt buộc đã được cấu hình (KHÔNG in giá trị mật khẩu)
cut -d= -f1 .env

# 3. Kiểm tra file mẫu không chứa dữ liệu thực tế
grep -v '^#' .env.example
```

---

## 3. Kiểm tra Trạng thái Cụm Container Docker
```bash
# Kiểm tra toàn bộ 11 container đang chạy và trạng thái sức khỏe
docker compose ps

# Kiểm tra tài nguyên CPU/RAM tiêu thụ theo thời gian thực của các container
docker stats --no-stream
```

---

## 4. Kiểm tra Nhật ký Ứng dụng & Nginx (Structured JSON Logs)
```bash
# Xem 20 dòng log JSON mới nhất từ Express App (có cấu trúc: method, route, status_code, latency_ms)
docker compose logs app --tail 20

# Xem 20 dòng log JSON mới nhất từ Nginx Reverse Proxy
docker compose logs nginx --tail 20

# Xem log thu thập của Promtail (xác nhận gửi log sang Loki thành công)
docker compose logs promtail --tail 20
```

---

## 5. Kiểm tra Tăng cường An ninh (System Hardening)
```bash
# 1. Chứng minh ứng dụng chạy dưới tài khoản non-root
docker compose exec app whoami
# Kết quả mong đợi: node

# 2. Chứng minh hệ thống tệp gốc của ứng dụng là chỉ đọc (Read-only rootfs)
docker compose exec app touch /root-test.txt
# Kết quả mong đợi: touch: /root-test.txt: Read-only file system

# 3. Chứng minh quyền hạn tối thiểu của CSDL (nhập mật khẩu tương tác khi được nhắc; KHÔNG đưa mật khẩu vào CLI)
docker compose exec mysql mysql -u attendance_app -p attendance_db -e "SHOW GRANTS FOR CURRENT_USER();"
# Kết quả mong đợi: Chỉ gồm SELECT, INSERT, UPDATE, DELETE trên database attendance_db

# 4. Kiểm tra tiêu đề an ninh HTTP từ Nginx Reverse Proxy và Anti-cache headers
curl -I http://127.0.0.1/login
# Kết quả mong đợi: X-Frame-Options, X-Content-Type-Options, CSP, Cache-Control: no-store
```

---

## 6. Kiểm tra Hệ thống Giám sát (Prometheus)
```bash
# Kiểm tra trạng thái 5/5 targets giám sát đều ở trạng thái UP
curl -s 'http://127.0.0.1:9090/api/v1/targets' | jq '.data.activeTargets[] | {job: .labels.job, health: .health}'

# Thử nghiệm truy vấn PromQL: Số lượng request HTTP thu thập từ Express App
curl -s 'http://127.0.0.1:9090/api/v1/query?query=attendance_http_requests_total' | jq .

# Kiểm tra tình trạng sức khỏe của Grafana qua HTTP API
curl -s 'http://127.0.0.1:3000/api/health' | jq .
# Kết quả mong đợi: {"database": "ok", "version": "13.2.2"}
```

---

## 7. Kiểm tra Truy vấn Nhật ký Tập trung (LogQL qua Grafana/Loki)
*Truy cập Grafana: **Explore** -> Chọn nguồn dữ liệu **Loki**:*
```logql
# 1. Xem toàn bộ log có cấu trúc của Attendance App:
{compose_service="app"} | json

# 2. Lọc nhanh các lỗi HTTP từ App (Status >= 400):
{compose_service="app"} | json | status_code >= 400

# 3. Theo dõi sự kiện nghiệp vụ điểm danh (Check-in & Check-out):
{compose_service="app"} | json | action=~"CHECK_IN|CHECK_OUT"

# 4. Lọc các lượt nhân sự đi muộn:
{compose_service="app"} | json | action="CHECK_IN" | attendance_status="late"

# 5. Theo dõi lỗi trên Reverse Proxy Nginx:
{compose_service="nginx"} | json | status >= 400
```

---

## 8. Danh mục Đường dẫn Demo Nghiệp vụ trên Trình duyệt
* **Trang chủ / Tổng quan Dashboard:** `http://<VM-IP>/dashboard`
* **Điểm danh hôm nay (Check-in / Check-out):** `http://<VM-IP>/attendance`
* **Quản lý Ca làm việc (Shifts):** `http://<VM-IP>/shifts`
* **Quản lý Nhân sự & Tìm kiếm (`?q=...`):** `http://<VM-IP>/members?q=DTC101`
* **Lịch sử Điểm danh (Bộ lọc & Phân trang 100 bản ghi/trang):** `http://<VM-IP>/attendance/history?date=2026-10-18&status=on_time&page=1`
* **Màn hình Đăng nhập:** `http://<VM-IP>/login`
* **Thao tác Đăng xuất:** Bấm nút **Đăng xuất** trên thanh điều hướng (gửi request `POST /logout` kèm CSRF Token bảo vệ).

---

## 9. Lịch sử Phiên bản Git (Commit History)
```bash
# Xem danh sách các commit đã thực hiện theo quy chuẩn đồ án (bao gồm commit 3e39fd7)
git log --oneline -n 10
```
