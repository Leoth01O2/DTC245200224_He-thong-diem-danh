const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

/**
 * Hiển thị trang đăng nhập
 */
function showLogin(req, res) {
    const error = req.query.error || null;
    res.render('auth/login', { error });
}

/**
 * Xử lý đăng nhập
 */
async function login(req, res) {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.render('auth/login', { error: 'Vui long nhap day du ten dang nhap va mat khau!' });
    }

    try {
        const [rows] = await pool.query(
            'SELECT id, username, password_hash, full_name FROM users WHERE username = ?',
            [username.trim()]
        );

        if (rows.length === 0) {
            return res.render('auth/login', { error: 'Ten dang nhap hoac mat khau khong chinh xac!' });
        }

        const user = rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.render('auth/login', { error: 'Ten dang nhap hoac mat khau khong chinh xac!' });
        }

        // Lưu thông tin vào session
        req.session.user = {
            id: user.id,
            username: user.username,
            full_name: user.full_name
        };

        console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'INFO',
            action: 'AUTH_LOGIN_SUCCESS',
            username: user.username
        }));

        res.redirect('/dashboard');
    } catch (error) {
        console.error(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'ERROR',
            action: 'AUTH_LOGIN_ERROR',
            error: error.message
        }));
        res.render('auth/login', { error: 'Da xay ra loi he thong, vui long thu lai sau!' });
    }
}

/**
 * Xử lý đăng xuất qua POST /logout
 */
function logout(req, res) {
    const username = req.session?.user?.username || 'anonymous';
    req.session.destroy((err) => {
        if (err) {
            console.error(JSON.stringify({
                timestamp: new Date().toISOString(),
                level: 'ERROR',
                message: 'Failed to destroy session',
                error: err.message
            }));
        } else {
            console.log(JSON.stringify({
                timestamp: new Date().toISOString(),
                level: 'INFO',
                action: 'AUTH_LOGOUT_SUCCESS',
                username
            }));
        }
        res.clearCookie('attendance_sid');
        res.redirect('/login');
    });
}

module.exports = {
    showLogin,
    login,
    logout
};
