const client = require('@prometheus-io/client');

const register = new client.Registry();

client.collectDefaultMetrics({
    register,
    prefix: 'attendance_'
});

const httpRequestsTotal = new client.Counter({
    name: 'attendance_http_requests_total',
    help: 'Total number of HTTP requests processed',
    labelNames: ['method', 'route', 'status_code'],
    registers: [register]
});

const httpRequestDurationSeconds = new client.Histogram({
    name: 'attendance_http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
    registers: [register]
});

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
