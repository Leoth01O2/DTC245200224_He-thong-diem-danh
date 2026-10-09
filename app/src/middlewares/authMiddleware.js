/**
 * Middleware xác thực phiên đăng nhập
 */
function requireAuth(req, res, next) {
    if (req.session && req.session.user) {
        res.locals.currentUser = req.session.user;
        res.locals.currentPath = req.path;
        return next();
    }
    return res.redirect('/login');
}

/**
 * Middleware cho trang khách (chưa đăng nhập mới vào được, ví dụ /login)
 */
function requireGuest(req, res, next) {
    if (req.session && req.session.user) {
        return res.redirect('/dashboard');
    }
    next();
}

module.exports = {
    requireAuth,
    requireGuest
};
