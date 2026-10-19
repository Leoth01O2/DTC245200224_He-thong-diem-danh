require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);

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
const { initCsrf, verifyCsrf } = require('./middlewares/csrfMiddleware');

const authRoutes = require('./routes/authRoutes');
const memberRoutes = require('./routes/memberRoutes');
const shiftRoutes = require('./routes/shiftRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const dashboardController = require('./controllers/dashboardController');

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.set('trust proxy', 1);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

app.use(requestLogger);

app.use(express.static(path.join(__dirname, '../public')));

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

app.get('/metrics', async (req, res) => {
    try {
        res.set('Content-Type', register.contentType);
        const metricsData = await register.metrics();
        res.end(metricsData);
    } catch (err) {
        res.status(500).end(err.message);
    }
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const sessionStore = new MySQLStore({
    clearExpired: true,
    checkExpirationInterval: 900000,
    expiration: 86400000,
    createDatabaseTable: false,
    schema: {
        tableName: 'sessions',
        columnNames: {
            session_id: 'session_id',
            expires: 'expires',
            data: 'data'
        }
    }
}, pool);

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
        maxAge: 24 * 60 * 60 * 1000
    }
}));

app.use(initCsrf);
app.use(verifyCsrf);

const { formatDateVN, formatTimeVN } = require('./utils/timezone');
app.use((req, res, next) => {
    res.locals.formatDateVN = formatDateVN;
    res.locals.formatTimeVN = formatTimeVN;
    next();
});

app.get('/', (req, res) => {
    res.redirect('/dashboard');
});

app.use('/', authRoutes);
app.get('/dashboard', requireAuth, dashboardController.showDashboard);
app.use('/members', memberRoutes);
app.use('/shifts', shiftRoutes);
app.use('/attendance', attendanceRoutes);

app.use((req, res) => {
    res.status(404).render('error', {
        currentUser: req.session?.user || null,
        message: 'Trang bạn tìm kiếm không tồn tại (404 Not Found)'
    });
});

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
