# Bằng Chứng Thực Nghiệm Cảnh Báo An Toàn Thông Tin & Truy Vết Nhật Ký (Security Incident Alert & Log Tracing Evidence)

**Dự án:** Hệ thống Điểm danh (Attendance System) - Đề tài 27
**Thời gian thực nghiệm:** 22:45:18 - 22:49:10 (Giờ địa phương GMT+7, tức 15:45:18Z - 15:49:10Z ngày 19/10/2026)
**Mục tiêu:** Trình bày một sự cố an toàn thông tin, hệ thống tự động phát hiện và kích hoạt cảnh báo Alerting, truy vết toàn bộ bản ghi nhật ký (log) liên quan và tự động trở về trạng thái bình thường sau khi sự cố kết thúc.

---

## 1. Kịch Bản Sự Cố & Cơ Chế Phát Hiện

### 1.1 Kịch bản
Mô phỏng hành vi tấn công CSRF hoặc gửi request độc hại tự động: kẻ tấn công liên tục gửi các yêu cầu `POST` tới endpoint xác thực `/login` mà không kèm CSRF token hợp lệ.
- Ứng dụng Express được bảo vệ bởi `csrfMiddleware.js`: Khi phát hiện thiếu token, middleware lập tức từ chối và phản hồi HTTP `403 Forbidden`.
- Tầng ghi log `loggingMiddleware.js`: Ghi nhận log cảnh báo mức `WARN` định dạng Structured JSON, đồng thời tăng counter metric Prometheus `attendance_http_requests_total{method="POST",route="/login",status_code="403"}`.

### 1.2 Quy tắc Cảnh báo (Alert Rule)
- **Tên quy tắc:** `AttendanceRepeatedPost403`
- **File cấu hình provisioning:** `monitoring/grafana/provisioning/alerting/alert-rules.yml`
- **Nguồn dữ liệu:** Prometheus (`prometheus-main`)
- **Truy vấn PromQL (Query A):**
  ```promql
  sum(increase(attendance_http_requests_total{method="POST",route="/login",status_code="403"}[2m])) or vector(0)
  ```
- **Điều kiện kích hoạt (Threshold B):** Giá trị `Input A` $\ge 5$ (phát hiện có từ 5 yêu cầu POST 403 tới `/login` trong vòng 2 phút).
- **Chu kỳ đánh giá (Evaluation interval):** Mỗi 10 giây (`interval: 10s`).
- **Thời gian chờ (For):** `0s` (kích hoạt ngay khi điều kiện thỏa mãn).
- **Ý nghĩa kỹ thuật:** Dấu hiệu nghi ngờ tấn công CSRF hoặc lỗi gửi thiếu CSRF token từ client.

---

## 2. Nhật Ký Tiến Trình Thực Nghiệm Thực Tế

### Bước 1: Trạng thái ban đầu (Baseline)
- Thời điểm: `2026-10-19T15:45:18Z`
- Metric hiện tại: `attendance_http_requests_total{method="POST",route="/login",status_code="403"} = 1`
- Trạng thái Grafana Alert: **`Normal`** (`rule_state: "inactive"`, `totals: { "normal": 1 }`)

### Bước 2: Mô phỏng phát sinh sự cố (Fault Simulation)
Gửi 6 yêu cầu `POST /login` không có CSRF token qua localhost:
```bash
for i in $(seq 1 6); do
  ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1/login)
  echo "Request $i at $ts: HTTP $code"
  sleep 1
done
```
**Kết quả thực tế ghi nhận:**
- Request 1 at `2026-10-19T15:45:31Z`: HTTP 403
- Request 2 at `2026-10-19T15:45:32Z`: HTTP 403
- Request 3 at `2026-10-19T15:45:33Z`: HTTP 403
- Request 4 at `2026-10-19T15:45:34Z`: HTTP 403
- Request 5 at `2026-10-19T15:45:35Z`: HTTP 403
- Request 6 at `2026-10-19T15:45:36Z`: HTTP 403

### Bước 3: Metric Prometheus tăng tương ứng
- Sau chu kỳ cào (scrape) 15 giây:
```bash
curl -s -G "http://127.0.0.1:9090/api/v1/query" \
  --data-urlencode 'query=attendance_http_requests_total{method="POST",route="/login",status_code="403"}'
```
- Giá trị metric: **`7`** (tăng đúng 6 đơn vị từ 1 lên 7).

### Bước 4: Grafana Alert chuyển trạng thái Firing
- Thời điểm chuyển trạng thái: `2026-10-19T15:45:50Z`
- Trạng thái kiểm tra qua API:
```json
{
  "rule_state": "firing",
  "totals": {
    "alerting": 1
  },
  "alert": {
    "labels": {
      "alertname": "AttendanceRepeatedPost403",
      "category": "security",
      "severity": "warning"
    },
    "state": "Alerting",
    "activeAt": "2026-10-19T15:45:50Z"
  }
}
```
- Đánh giá: **PASS (Firing thực tế)**

### Bước 5: Truy vết bản ghi nhật ký trong Loki (Log Tracing)
- Câu truy vấn LogQL trên Grafana Explore:
  ```logql
  {compose_service="app"} | json | route="/login" | status_code=403
  ```
- Kết quả thu thập: Trên giao diện Grafana Explore, toàn bộ khoảng thời gian truy vấn 15 phút hiển thị tổng cộng **7 dòng log** (khớp với giá trị metric counter Prometheus tăng lên 7):
  * **1 dòng log ban đầu:** Thuộc lượt gửi thử nghiệm kiểm tra kết nối lúc `15:38:43Z` (22:38:43 GMT+7).
  * **6 dòng log mô phỏng sự cố:** Ghi nhận chính xác 6 request từ chối trong đợt mô phỏng từ `15:45:31Z` đến `15:45:36Z` (22:45:31 đến 22:45:36 GMT+7).
- Chi tiết các trường dữ liệu JSON có cấu trúc được bóc tách:
  * `timestamp`: Khớp với từng thời điểm gửi yêu cầu
  * `level`: `WARN`
  * `method`: `POST`
  * `route`: `/login`
  * `path`: `/login`
  * `status_code`: `403`
  * `ip`: `172.19.0.1`
  * Trong phạm vi các bản ghi log và ảnh chụp được kiểm tra, không ghi nhận thông tin nhạy cảm như password, token hay session ID.
- Đánh giá: **PASS (Truy vết chính xác)**

### Bước 6: Tự động phục hồi về trạng thái Normal (Recovery)
- Sau khi kết thúc việc gửi yêu cầu và cửa sổ trượt 2 phút trôi qua (`> 2m`), số lượng request 403 trong 2 phút giảm về 0 (< 5).
- Thời điểm ghi nhận phục hồi: `2026-10-19T15:47:30Z`
- Trạng thái API:
```json
{
  "rule_state": "inactive",
  "totals": {
    "normal": 1
  },
  "alert": {
    "state": "Normal"
  }
}
```
- Đánh giá: **PASS (Tự động phục hồi)**

---

## 3. Danh Mục Ảnh Minh Chứng Thực Tế

Toàn bộ ảnh chụp màn hình độ phân giải cao được lưu trữ tại thư mục `docs/evidence/alerting/`:

| STT | Tên file ảnh | Nội dung minh chứng |
| :---: | :--- | :--- |
| 1 | `01_grafana_alert_rule_config.png` | Cấu hình quy tắc cảnh báo Grafana: Query PromQL, Threshold $\ge 5$, chu kỳ 10s, annotations bảo mật |
| 2 | `02_grafana_alert_firing.png` | Trạng thái **Firing** thực tế trên Grafana Alerting với biểu đồ số lượng vượt ngưỡng màu đỏ |
| 3 | `03_prometheus_metric_increase.png` | Biểu đồ Prometheus chứng minh metric `attendance_http_requests_total` tăng bước nhảy từ 1 lên 7 |
| 4 | `04_loki_explore_trace_logs.png` | Giao diện Grafana Explore truy vết dòng log JSON có cấu trúc trong Loki tương ứng với 6 request bị từ chối |
| 5 | `05_grafana_alert_normal_recovered.png` | Trạng thái phục hồi về **Normal** sau khi hết cửa sổ trượt 2 phút |

---

## 4. Phương Án Khôi Phục (Rollback Plan)

Trong trường hợp cần gỡ bỏ quy tắc cảnh báo này khỏi hệ thống:
1. Xóa file provisioning cấu hình Alert:
   ```bash
   rm -f monitoring/grafana/provisioning/alerting/alert-rules.yml
   ```
2. Gọi endpoint reload của Grafana để gỡ bỏ rule ngay lập tức (Grafana sẽ yêu cầu nhập mật khẩu tương tác qua terminal, không lưu mật khẩu trong lệnh hoặc script):
   ```bash
   curl -s -u admin -X POST http://127.0.0.1:3000/api/admin/provisioning/alerting/reload
   ```
*(Lưu ý: Giữ nguyên thư mục `docs/evidence/alerting/` và tài liệu này làm bằng chứng kỹ thuật phục vụ báo cáo).*
