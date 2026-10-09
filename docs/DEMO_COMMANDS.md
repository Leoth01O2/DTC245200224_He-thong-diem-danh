# Bảng Tra cứu Lệnh Demo Nhanh (Demo Command Cheatsheet)

Tài liệu cung cấp các câu lệnh dòng lệnh ngắn gọn phục vụ trình diễn và nghiệm thu đồ án cùng Giảng viên.

> **Lưu ý:** Địa chỉ IP máy ảo demo hiện tại là `http://192.168.203.128` (có thể kiểm tra linh hoạt bằng lệnh `hostname -I`).  
> Tài liệu này **tuyệt đối không in mật khẩu thực tế**. Để lấy mật khẩu phục vụ đăng nhập, xem trực tiếp trên máy chủ qua lệnh tra cứu an toàn bên dưới.

---

## 1. Kiểm tra Địa chỉ IP & Cổng Dịch vụ
```bash
# Kiểm tra địa chỉ IP của máy ảo
hostname -I | awk '{print $1}'

# Kiểm tra các cổng đang lắng nghe trên máy chủ
ss -lntp
```
* **Website Điểm danh:** `http://<VM-IP>` (Port 80)
* **Grafana Dashboards & Logs:** `http://<VM-IP>:3000` (Port 3000)
* **phpMyAdmin:** `http://<VM-IP>:8088` (Port 8088)
* **Prometheus UI:** `http://<VM-IP>:9090` (Port 9090)

---

## 2. Lấy Thông tin Đăng nhập (Xem trực tiếp trên Server)
```bash
# Lấy mật khẩu Quản trị viên Website (tài khoản: admin)
grep '^ADMIN_PASSWORD=' .env

# Lấy mật khẩu Quản trị viên Grafana (tài khoản: admin)
grep '^GRAFANA_ADMIN_PASSWORD=' .env

# Lấy mật khẩu MySQL App User (tài khoản: attendance_app)
grep '^DB_PASSWORD=' .env
```

---

## 3. Kiểm tra Trạng thái Cụm Container Docker
```bash
# Kiểm tra toàn bộ 11 container đang chạy
docker compose ps

# Kiểm tra tài nguyên CPU/RAM tiêu thụ theo thời gian thực
docker stats --no-stream
```

---

## 4. Kiểm tra Nhật ký Ứng dụng & Nginx (Structured JSON Logs)
```bash
# Xem 20 dòng log JSON mới nhất từ Express App
docker compose logs app --tail 20

# Xem 20 dòng log JSON mới nhất từ Nginx Reverse Proxy
docker compose logs nginx --tail 20

# Xem log thu thập của Promtail
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

# 3. Chứng minh quyền hạn tối thiểu của CSDL (chỉ SELECT, INSERT, UPDATE, DELETE)
docker compose exec mysql mysql -uattendance_app -p$(grep '^DB_PASSWORD=' .env | cut -d= -f2) attendance_db -e "SHOW GRANTS FOR CURRENT_USER();"

# 4. Kiểm tra phân quyền an toàn của file biến môi trường
stat -c '%a %n' .env
# Kết quả mong đợi: 600 .env

# 5. Kiểm tra tiêu đề an ninh HTTP từ Nginx
curl -I http://127.0.0.1/
```

---

## 6. Kiểm tra Hệ thống Giám sát (Prometheus)
```bash
# Kiểm tra trạng thái 5/5 targets giám sát đều ở trạng thái UP
docker exec attendance-prometheus wget -qO- 'http://127.0.0.1:9090/api/v1/targets' | jq '.data.activeTargets[] | {job: .labels.job, health: .health}'

# Thử nghiệm truy vấn PromQL: Số lượng request HTTP
curl -s 'http://127.0.0.1:9090/api/v1/query?query=attendance_http_requests_total' | jq .
```

---

## 7. Kiểm tra Truy vấn Nhật ký Tập trung (LogQL qua Grafana/Loki)
*Truy cập Grafana: **Explore** -> Chọn nguồn dữ liệu **Loki**:*
```logql
# 1. Xem toàn bộ log có cấu trúc của Attendance App:
{compose_service="app"} | json

# 2. Lọc nhanh các lỗi HTTP (Status >= 400):
{compose_service="app"} | json | status_code >= 400

# 3. Theo dõi sự kiện nghiệp vụ điểm danh:
{compose_service="app"} | json | action=~"CHECK_IN|CHECK_OUT"

# 4. Lọc các lượt nhân sự đi muộn:
{compose_service="app"} | json | action="CHECK_IN" | attendance_status="late"

# 5. Theo dõi lỗi trên Reverse Proxy Nginx:
{compose_service="nginx"} | json | status >= 400
```

---

## 8. Lịch sử Phiên bản Git (Commit History)
```bash
# Xem danh sách các commit đã thực hiện theo quy chuẩn đồ án
git log --oneline -n 5
```
