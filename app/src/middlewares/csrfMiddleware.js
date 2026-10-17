const crypto = require('crypto');

/**
 * Khởi tạo CSRF token theo cơ chế lazy-load (chỉ tạo khi view thực sự truy xuất res.locals.csrfToken)
 * Tránh tạo session rác trong CSDL đối với các yêu cầu không có form hoặc endpoint monitoring
 */
function initCsrf(req, res, next) {
    if (!req.session) {
        res.locals.csrfToken = '';
        return next();
    }

    Object.defineProperty(res.locals, 'csrfToken', {
        get() {
            if (!req.session.csrfToken) {
                req.session.csrfToken = crypto.randomBytes(32).toString('hex');
            }
            return req.session.csrfToken;
        },
        enumerable: true,
        configurable: true
    });

    next();
}

/**
 * Kiểm tra tính hợp lệ của CSRF token đối với các phương thức thay đổi trạng thái
 */
function verifyCsrf(req, res, next) {
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(req.method)) {
        return next();
    }

    const sessionToken = req.session && req.session.csrfToken;
    const requestToken = (req.body && req.body._csrf) ||
                         req.headers['x-csrf-token'] ||
                         req.headers['csrf-token'];

    if (!sessionToken || !requestToken || typeof requestToken !== 'string') {
        if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
            return res.status(403).json({ error: 'CSRF token không hợp lệ hoặc bị thiếu' });
        }
        return res.status(403).render('error', {
            currentUser: req.session?.user || null,
            message: 'Yêu cầu bị từ chối do thiếu hoặc sai CSRF Token (403 Forbidden). Vui lòng thử lại.'
        });
    }

    const bufSession = Buffer.from(sessionToken, 'utf8');
    const bufRequest = Buffer.from(requestToken, 'utf8');

    if (bufSession.length !== bufRequest.length || !crypto.timingSafeEqual(bufSession, bufRequest)) {
        if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
            return res.status(403).json({ error: 'CSRF token không hợp lệ' });
        }
        return res.status(403).render('error', {
            currentUser: req.session?.user || null,
            message: 'Yêu cầu bị từ chối do CSRF Token không khớp (403 Forbidden). Vui lòng thử lại.'
        });
    }

    next();
}

/**
 * Làm mới CSRF token sau các thao tác nhạy cảm (như đăng nhập thành công)
 */
function rotateCsrf(req) {
    if (req.session) {
        req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    }
}

module.exports = {
    initCsrf,
    verifyCsrf,
    rotateCsrf
};
