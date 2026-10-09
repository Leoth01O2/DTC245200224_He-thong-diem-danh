require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);

// Fail-fast nếu thiếu SESSION_SECRET
if (!process.env.SESSION_SECRET) {
    console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'FATAL',
        message: 'Thieu bien moi truong bat buoc: SESSION_SECRET'
    }));
    process.exit(1);
}

const { pool, testConnection, initAdminAccount } = require('./config/db');
const { register } = require('./config/metrics');
const { requestLogger } = require('./middlewares/loggingMiddleware');
const { requireAuth } = require('./middlewares/authMiddleware');

const authRoutes = require('./routes/authRoutes');
const memberRoutes = require('./routes/memberRoutes');
const shiftRoutes = require('./routes/shiftRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const dashboardController = require('./controllers/dashboardController');

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Cấu hình tin cậy proxy phía trước (Nginx reverse proxy 1 hop)
app.set('trust proxy', 1);

// Cấu hình View Engine EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Static assets
app.use(express.static(path.join(__dirname, '../public')));

// Parse form body & JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Cấu hình MySQL Session Store an toàn và minh bạch
const sessionStore = new MySQLStore({
    clearExpired: true,
    checkExpirationInterval: 900000, // 15 phút quét và dọn session hết hạn
    expiration: 86400000,            // Thời hạn session 1 ngày (86,400,000 ms)
    createDatabaseTable: false,      // Sử dụng bảng sessions đã khai báo trong schema SQL
    schema: {
        tableName: 'sessions',
        columnNames: {
            session_id: 'session_id',
            expires: 'expires',
            data: 'data'
        }
    }
}, pool);

// Cấu hình Express Session
const isSecureCookie = process.env.COOKIE_SECURE === 'true';
app.use(session({
    key: 'attendance_sid',
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: isSecureCookie,
        maxAge: 24 * 60 * 60 * 1000 // 1 ngày
    }
}));

// Gắn Logging và Metrics Middleware
app.use(requestLogger);

// Gắn helper định dạng ngày giờ tiếng Việt toàn cục cho tất cả EJS template
const { formatDateVN, formatTimeVN } = require('./utils/timezone');
app.use((req, res, next) => {
    res.locals.formatDateVN = formatDateVN;
    res.locals.formatTimeVN = formatTimeVN;
    next();
});

// Endpoint Healthcheck
app.get('/healthz', async (req, res) => {
    const isDbAlive = await testConnection();
    if (isDbAlive) {
        return res.status(200).json({
            status: 'healthy',
            uptime_seconds: Math.round(process.uptime()),
            database: 'connected',
            timestamp: new Date().toISOString()
        });
    } else {
        return res.status(503).json({
            status: 'unhealthy',
            uptime_seconds: Math.round(process.uptime()),
            database: 'disconnected',
            timestamp: new Date().toISOString()
        });
    }
});

// Endpoint Prometheus Metrics (@prometheus-io/client)
app.get('/metrics', async (req, res) => {
    try {
        res.set('Content-Type', register.contentType);
        const metricsData = await register.metrics();
        res.end(metricsData);
    } catch (err) {
        res.status(500).end(err.message);
    }
});

// Chuyển hướng gốc sang /dashboard
app.get('/', (req, res) => {
    res.redirect('/dashboard');
});

// Gắn các route nghiệp vụ
app.use('/', authRoutes);
app.get('/dashboard', requireAuth, dashboardController.showDashboard);
app.use('/members', memberRoutes);
app.use('/shifts', shiftRoutes);
app.use('/attendance', attendanceRoutes);

// Xử lý 404
app.use((req, res) => {
    res.status(404).render('error', {
        currentUser: req.session?.user || null,
        message: 'Trang bạn tìm kiếm không tồn tại (404 Not Found)'
    });
});

// Xử lý lỗi toàn cục 500
app.use((err, req, res, next) => {
    console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        message: 'Unhandled Exception',
        error: err.message,
        stack: err.stack
    }));

    res.status(500).render('error', {
        currentUser: req.session?.user || null,
        message: 'Đã xảy ra lỗi máy chủ nội bộ (500 Internal Server Error)'
    });
});

// Khởi chạy ứng dụng
async function startServer() {
    try {
        const dbConnected = await testConnection();
        if (dbConnected) {
            await initAdminAccount();
        } else {
            console.warn(JSON.stringify({
                timestamp: new Date().toISOString(),
                level: 'WARN',
                message: 'Database is not yet ready at startup. Will retry on demand.'
            }));
        }

        app.listen(PORT, '0.0.0.0', () => {
            console.log(JSON.stringify({
                timestamp: new Date().toISOString(),
                level: 'INFO',
                message: `Attendance System Server is running on port ${PORT}`
            }));
        });
    } catch (error) {
        console.error(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'FATAL',
            message: 'Failed to start server',
            error: error.message
        }));
        process.exit(1);
    }
}

startServer();
