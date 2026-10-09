const client = require('@prometheus-io/client');

// Khởi tạo Prometheus Register chính thức
const register = new client.Registry();

// Thu thập default metrics của Node.js process (Memory, CPU, Event Loop, v.v.)
client.collectDefaultMetrics({
    register,
    prefix: 'attendance_'
});

// Custom metric: Đếm tổng số HTTP requests
const httpRequestsTotal = new client.Counter({
    name: 'attendance_http_requests_total',
    help: 'Total number of HTTP requests processed',
    labelNames: ['method', 'route', 'status_code'],
    registers: [register]
});

// Custom metric: Thời gian phản hồi HTTP request (Histogram)
const httpRequestDurationSeconds = new client.Histogram({
    name: 'attendance_http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
    registers: [register]
});

// Custom metric: Đếm các hành vi nghiệp vụ điểm danh (CHECK_IN, CHECK_OUT)
const attendanceActionsTotal = new client.Counter({
    name: 'attendance_actions_total',
    help: 'Total number of attendance actions executed',
    labelNames: ['action', 'status'],
    registers: [register]
});

module.exports = {
    register,
    httpRequestsTotal,
    httpRequestDurationSeconds,
    attendanceActionsTotal
};
