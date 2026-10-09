const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

// Rà soát biến môi trường Database: Fail-fast nếu thiếu cấu hình bắt buộc
const requiredDbEnv = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
for (const envKey of requiredDbEnv) {
    if (!process.env[envKey]) {
        console.error(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'FATAL',
            message: `Thieu bien moi truong bat buoc cho co so du lieu: ${envKey}`
        }));
        process.exit(1);
    }
}

const dbConfig = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: '+07:00'
};

const pool = mysql.createPool(dbConfig);

/**
 * Kiểm tra kết nối cơ sở dữ liệu
 */
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        await connection.query('SELECT 1');
        connection.release();
        return true;
    } catch (error) {
        console.error(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'ERROR',
            message: 'Database connection failed',
            error: error.message
        }));
        return false;
    }
}

/**
 * Khởi tạo tài khoản Admin đầu tiên nếu bảng users chưa có bản ghi nào
 * Tuyệt đối không hard-code mật khẩu fallback
 */
async function initAdminAccount() {
    try {
        const [rows] = await pool.query('SELECT COUNT(*) AS total FROM users');
        if (rows[0].total === 0) {
            const username = process.env.ADMIN_USERNAME || 'admin';
            const rawPassword = process.env.ADMIN_PASSWORD;
            const fullName = process.env.ADMIN_FULL_NAME || 'Quản trị viên Hệ thống';

            if (!rawPassword) {
                console.error(JSON.stringify({
                    timestamp: new Date().toISOString(),
                    level: 'ERROR',
                    message: 'Khong the khoi tao Admin: Thieu bien moi truong ADMIN_PASSWORD'
                }));
                return;
            }

            const passwordHash = await bcrypt.hash(rawPassword, 10);

            await pool.query(
                'INSERT INTO users (username, password_hash, full_name) VALUES (?, ?, ?)',
                [username.trim(), passwordHash, fullName.trim()]
            );

            console.log(JSON.stringify({
                timestamp: new Date().toISOString(),
                level: 'INFO',
                message: `Tai khoan Admin ban dau da duoc tao thanh cong: ${username}`
            }));
        } else {
            console.log(JSON.stringify({
                timestamp: new Date().toISOString(),
                level: 'INFO',
                message: 'Admin account already exists, skipping initialization.'
            }));
        }
    } catch (error) {
        console.error(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'ERROR',
            message: 'Failed to initialize admin account',
            error: error.message
        }));
    }
}

module.exports = {
    pool,
    testConnection,
    initAdminAccount
};
