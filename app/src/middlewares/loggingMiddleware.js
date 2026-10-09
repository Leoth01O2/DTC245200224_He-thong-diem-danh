const { httpRequestsTotal, httpRequestDurationSeconds } = require('../config/metrics');

/**
 * Chuẩn hóa route path để tránh high cardinality trong Prometheus
 * Thay thế các ID dạng số hoặc UUID bằng :id
 */
function normalizeRoute(req) {
    if (req.route && req.route.path) {
        return (req.baseUrl || '') + req.route.path;
    }
    const path = req.path || '/';
    return path.replace(/\/\d+/g, '/:id');
}

/**
 * Middleware ghi log JSON cấu trúc và cập nhật Prometheus metrics
 */
function requestLogger(req, res, next) {
    const startTime = process.hrtime();

    res.on('finish', () => {
        const diff = process.hrtime(startTime);
        const durationSeconds = diff[0] + diff[1] / 1e9;
        const latencyMs = Math.round(durationSeconds * 1000);
        const statusCode = res.statusCode;
        const method = req.method;
        const route = normalizeRoute(req);

        // Cập nhật Prometheus metrics (trừ chính route /metrics để tránh loop dữ liệu)
        if (req.path !== '/metrics') {
            httpRequestsTotal.inc({
                method,
                route,
                status_code: statusCode.toString()
            });

            httpRequestDurationSeconds.observe({
                method,
                route,
                status_code: statusCode.toString()
            }, durationSeconds);
        }

        // Định dạng Structured JSON Log cho Promtail / Loki thu thập
        const level = statusCode >= 500 ? 'ERROR' : (statusCode >= 400 ? 'WARN' : 'INFO');
        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            method,
            route,
            path: req.originalUrl || req.url,
            status_code: statusCode,
            latency_ms: latencyMs,
            ip: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress
        };

        const logString = JSON.stringify(logEntry);
        if (level === 'ERROR') {
            console.error(logString);
        } else {
            console.log(logString);
        }
    });

    next();
}

module.exports = {
    requestLogger
};
