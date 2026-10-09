const { pool } = require('../config/db');

/**
 * Hiển thị danh sách thành viên kèm tìm kiếm
 */
async function listMembers(req, res) {
    try {
        const searchQuery = (req.query.q || '').trim();
        let query = 'SELECT id, code, full_name, email, department, created_at FROM members';
        let params = [];

        if (searchQuery) {
            query += ' WHERE code LIKE ? OR full_name LIKE ? OR department LIKE ?';
            const likeStr = `%${searchQuery}%`;
            params = [likeStr, likeStr, likeStr];
        }

        query += ' ORDER BY created_at DESC';

        const [members] = await pool.query(query, params);

        res.render('members/index', {
            members,
            searchQuery,
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
 * Thêm thành viên mới
 */
async function createMember(req, res) {
    const { code, full_name, email, department } = req.body;

    if (!code || !full_name || !department) {
        return res.redirect('/members?error=' + encodeURIComponent('Mã số, họ tên và khoa/phòng ban là bắt buộc!'));
    }

    // Validate email đơn giản nếu có nhập
    if (email && email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return res.redirect('/members?error=' + encodeURIComponent('Địa chỉ email không đúng định dạng!'));
    }

    try {
        await pool.query(
            'INSERT INTO members (code, full_name, email, department) VALUES (?, ?, ?, ?)',
            [code.trim().toUpperCase(), full_name.trim(), email ? email.trim() : null, department.trim()]
        );

        console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'INFO',
            action: 'MEMBER_CREATED',
            code: code.trim().toUpperCase()
        }));

        res.redirect('/members?success=' + encodeURIComponent('Thêm thành viên thành công!'));
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.redirect('/members?error=' + encodeURIComponent(`Mã thành viên "${code.trim().toUpperCase()}" đã tồn tại!`));
        }
        console.error(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'ERROR',
            action: 'MEMBER_CREATE_ERROR',
            error: error.message
        }));
        res.redirect('/members?error=' + encodeURIComponent('Lỗi hệ thống khi thêm thành viên!'));
    }
}

/**
 * Cập nhật thông tin thành viên
 */
async function updateMember(req, res) {
    const { id } = req.params;
    const { code, full_name, email, department } = req.body;

    if (!code || !full_name || !department) {
        return res.redirect('/members?error=' + encodeURIComponent('Vui lòng điền đầy đủ thông tin bắt buộc!'));
    }

    if (email && email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return res.redirect('/members?error=' + encodeURIComponent('Địa chỉ email không đúng định dạng!'));
    }

    try {
        await pool.query(
            'UPDATE members SET code = ?, full_name = ?, email = ?, department = ? WHERE id = ?',
            [code.trim().toUpperCase(), full_name.trim(), email ? email.trim() : null, department.trim(), id]
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
            return res.redirect('/members?error=' + encodeURIComponent(`Mã thành viên "${code.trim().toUpperCase()}" đã trùng với thành viên khác!`));
        }
        console.error(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'ERROR',
            action: 'MEMBER_UPDATE_ERROR',
            error: error.message
        }));
        res.redirect('/members?error=' + encodeURIComponent('Lỗi cập nhật thành viên!'));
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
        // Mã lỗi MySQL khi vi phạm khóa ngoại ON DELETE RESTRICT
        if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.errno === 1451) {
            return res.redirect('/members?error=' + encodeURIComponent('Không thể xóa: Thành viên này đã có dữ liệu lịch sử điểm danh trong hệ thống!'));
        }
        console.error(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'ERROR',
            action: 'MEMBER_DELETE_ERROR',
            error: error.message
        }));
        res.redirect('/members?error=' + encodeURIComponent('Lỗi hệ thống khi xóa thành viên!'));
    }
}

module.exports = {
    listMembers,
    createMember,
    updateMember,
    deleteMember
};
