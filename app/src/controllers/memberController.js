const { pool } = require('../config/db');

function safeString(v) {
    if (typeof v === 'string') return v.trim();
    if (typeof v === 'number') return String(v).trim();
    return '';
}

/**
 * Hiển thị danh sách thành viên kèm tìm kiếm và khôi phục form nếu có lỗi
 */
async function listMembers(req, res) {
    try {
        const searchQuery = safeString(req.query.q);
        let query = 'SELECT id, code, full_name, email, department, created_at FROM members';
        let params = [];

        if (searchQuery) {
            query += ' WHERE code LIKE ? OR full_name LIKE ? OR department LIKE ?';
            const likeStr = `%${searchQuery}%`;
            params = [likeStr, likeStr, likeStr];
        }

        query += ' ORDER BY created_at DESC';

        const [members] = await pool.query(query, params);

        const formData = req.session?.memberFlashFormData || {};
        if (req.session?.memberFlashFormData) {
            delete req.session.memberFlashFormData;
        }

        res.render('members/index', {
            members,
            searchQuery,
            formData,
            success: req.query.success || null,
            error: req.query.error || null
        });
    } catch (error) {
        console.error(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'ERROR',
            action: 'MEMBERS_LIST_ERROR',
            error: error.message
        }));
        res.status(500).render('error', { message: 'Lỗi tải danh sách thành viên!' });
    }
}

/**
 * Thêm thành viên mới với kiểm tra độ dài và bảo toàn dữ liệu khi có lỗi
 */
async function createMember(req, res) {
    const { code, full_name, email, department } = req.body;

    function returnWithError(errMsg) {
        if (req.session) {
            req.session.memberFlashFormData = {
                code: safeString(code),
                full_name: safeString(full_name),
                email: safeString(email),
                department: safeString(department),
                openForm: 'createMemberForm'
            };
        }
        return res.redirect('/members?error=' + encodeURIComponent(errMsg));
    }

    const trimmedCode = safeString(code).toUpperCase();
    const trimmedName = safeString(full_name);
    const trimmedDept = safeString(department);
    const trimmedEmail = safeString(email) || null;

    if (!trimmedCode || !trimmedName || !trimmedDept) {
        return returnWithError('Mã số, họ tên và khoa/phòng ban là bắt buộc!');
    }

    if (trimmedCode.length > 20) {
        return returnWithError('Mã thành viên không được vượt quá 20 ký tự!');
    }

    if (trimmedName.length > 100) {
        return returnWithError('Họ và tên không được vượt quá 100 ký tự!');
    }

    if (trimmedDept.length > 100) {
        return returnWithError('Khoa / Phòng ban không được vượt quá 100 ký tự!');
    }

    if (trimmedEmail) {
        if (trimmedEmail.length > 100) {
            return returnWithError('Địa chỉ email không được vượt quá 100 ký tự!');
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
            return returnWithError('Địa chỉ email không đúng định dạng!');
        }
    }

    try {
        await pool.query(
            'INSERT INTO members (code, full_name, email, department) VALUES (?, ?, ?, ?)',
            [trimmedCode, trimmedName, trimmedEmail, trimmedDept]
        );

        console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'INFO',
            action: 'MEMBER_CREATED',
            code: trimmedCode
        }));

        res.redirect('/members?success=' + encodeURIComponent('Thêm thành viên thành công!'));
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return returnWithError(`Mã thành viên "${trimmedCode}" đã tồn tại!`);
        }
        console.error(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'ERROR',
            action: 'MEMBER_CREATE_ERROR',
            error: error.message
        }));
        returnWithError('Lỗi hệ thống khi thêm thành viên!');
    }
}

/**
 * Cập nhật thông tin thành viên với khôi phục dữ liệu vào đúng Edit modal khi lỗi
 */
async function updateMember(req, res) {
    const { id } = req.params;
    const { code, full_name, email, department } = req.body;

    function returnWithError(errMsg) {
        if (req.session) {
            req.session.memberFlashFormData = {
                id,
                code: safeString(code),
                full_name: safeString(full_name),
                email: safeString(email),
                department: safeString(department),
                openForm: 'editMemberModal'
            };
        }
        return res.redirect('/members?error=' + encodeURIComponent(errMsg));
    }

    const trimmedCode = safeString(code).toUpperCase();
    const trimmedName = safeString(full_name);
    const trimmedDept = safeString(department);
    const trimmedEmail = safeString(email) || null;

    if (!trimmedCode || !trimmedName || !trimmedDept) {
        return returnWithError('Vui lòng điền đầy đủ thông tin bắt buộc!');
    }

    if (trimmedCode.length > 20) {
        return returnWithError('Mã thành viên không được vượt quá 20 ký tự!');
    }

    if (trimmedName.length > 100) {
        return returnWithError('Họ và tên không được vượt quá 100 ký tự!');
    }

    if (trimmedDept.length > 100) {
        return returnWithError('Khoa / Phòng ban không được vượt quá 100 ký tự!');
    }

    if (trimmedEmail) {
        if (trimmedEmail.length > 100) {
            return returnWithError('Địa chỉ email không được vượt quá 100 ký tự!');
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
            return returnWithError('Địa chỉ email không đúng định dạng!');
        }
    }

    try {
        await pool.query(
            'UPDATE members SET code = ?, full_name = ?, email = ?, department = ? WHERE id = ?',
            [trimmedCode, trimmedName, trimmedEmail, trimmedDept, id]
        );

        console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'INFO',
            action: 'MEMBER_UPDATED',
            id
        }));

        res.redirect('/members?success=' + encodeURIComponent('Cập nhật thành viên thành công!'));
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return returnWithError(`Mã thành viên "${trimmedCode}" đã trùng với thành viên khác!`);
        }
        console.error(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'ERROR',
            action: 'MEMBER_UPDATE_ERROR',
            error: error.message
        }));
        return returnWithError('Lỗi cập nhật thành viên!');
    }
}

/**
 * Xóa thành viên (với ràng buộc toàn vẹn RESTRICT)
 */
async function deleteMember(req, res) {
    const { id } = req.params;

    try {
        await pool.query('DELETE FROM members WHERE id = ?', [id]);

        console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'INFO',
            action: 'MEMBER_DELETED',
            id
        }));

        res.redirect('/members?success=' + encodeURIComponent('Đã xóa thành viên thành công!'));
    } catch (error) {
        if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.errno === 1451) {
            return res.redirect('/members?error=' + encodeURIComponent('Không thể xóa: Thành viên này đã có dữ liệu lịch sử điểm danh trong hệ thống!'));
        }
        console.error(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'ERROR',
            action: 'MEMBER_DELETE_ERROR',
            error: error.message
        }));
        res.redirect('/members?error=' + encodeURIComponent('Lỗi xóa thành viên!'));
    }
}

module.exports = {
    listMembers,
    createMember,
    updateMember,
    deleteMember
};
