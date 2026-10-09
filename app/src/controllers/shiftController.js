const { pool } = require('../config/db');
const { timeToMinutes } = require('../utils/timezone');

/**
 * Danh sách ca làm / ca học
 */
async function listShifts(req, res) {
    try {
        const [shifts] = await pool.query('SELECT * FROM shifts ORDER BY start_time ASC');
        res.render('shifts/index', {
            shifts,
            success: req.query.success || null,
            error: req.query.error || null
        });
    } catch (error) {
        console.error(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'ERROR',
            action: 'SHIFTS_LIST_ERROR',
            error: error.message
        }));
        res.status(500).render('error', { message: 'Lỗi tải danh sách ca!' });
    }
}

/**
 * Thêm ca mới
 */
async function createShift(req, res) {
    const { name, start_time, end_time, late_after_minutes } = req.body;

    if (!name || !start_time || !end_time) {
        return res.redirect('/shifts?error=' + encodeURIComponent('Vui lòng điền tên ca, giờ bắt đầu và giờ kết thúc!'));
    }

    const startMin = timeToMinutes(start_time);
    const endMin = timeToMinutes(end_time);

    if (endMin <= startMin) {
        return res.redirect('/shifts?error=' + encodeURIComponent('Giờ kết thúc ca phải lớn hơn giờ bắt đầu ca!'));
    }

    const lateMinutes = parseInt(late_after_minutes, 10);
    if (isNaN(lateMinutes) || lateMinutes < 0) {
        return res.redirect('/shifts?error=' + encodeURIComponent('Số phút cho phép đi muộn phải là số không âm!'));
    }

    try {
        await pool.query(
            'INSERT INTO shifts (name, start_time, end_time, late_after_minutes) VALUES (?, ?, ?, ?)',
            [name.trim(), start_time, end_time, lateMinutes]
        );

        console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'INFO',
            action: 'SHIFT_CREATED',
            name: name.trim()
        }));

        res.redirect('/shifts?success=' + encodeURIComponent('Thêm ca thành công!'));
    } catch (error) {
        console.error(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'ERROR',
            action: 'SHIFT_CREATE_ERROR',
            error: error.message
        }));
        res.redirect('/shifts?error=' + encodeURIComponent('Lỗi hệ thống khi tạo ca!'));
    }
}

/**
 * Cập nhật thông tin ca
 */
async function updateShift(req, res) {
    const { id } = req.params;
    const { name, start_time, end_time, late_after_minutes } = req.body;

    if (!name || !start_time || !end_time) {
        return res.redirect('/shifts?error=' + encodeURIComponent('Vui lòng điền đầy đủ thông tin ca!'));
    }

    const startMin = timeToMinutes(start_time);
    const endMin = timeToMinutes(end_time);

    if (endMin <= startMin) {
        return res.redirect('/shifts?error=' + encodeURIComponent('Giờ kết thúc ca phải lớn hơn giờ bắt đầu ca!'));
    }

    const lateMinutes = parseInt(late_after_minutes, 10);
    if (isNaN(lateMinutes) || lateMinutes < 0) {
        return res.redirect('/shifts?error=' + encodeURIComponent('Số phút cho phép đi muộn phải là số không âm!'));
    }

    try {
        await pool.query(
            'UPDATE shifts SET name = ?, start_time = ?, end_time = ?, late_after_minutes = ? WHERE id = ?',
            [name.trim(), start_time, end_time, lateMinutes, id]
        );

        console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'INFO',
            action: 'SHIFT_UPDATED',
            id
        }));

        res.redirect('/shifts?success=' + encodeURIComponent('Cập nhật ca thành công!'));
    } catch (error) {
        console.error(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'ERROR',
            action: 'SHIFT_UPDATE_ERROR',
            error: error.message
        }));
        res.redirect('/shifts?error=' + encodeURIComponent('Lỗi hệ thống khi cập nhật ca!'));
    }
}

/**
 * Xóa ca (với ràng buộc RESTRICT)
 */
async function deleteShift(req, res) {
    const { id } = req.params;

    try {
        await pool.query('DELETE FROM shifts WHERE id = ?', [id]);

        console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'INFO',
            action: 'SHIFT_DELETED',
            id
        }));

        res.redirect('/shifts?success=' + encodeURIComponent('Đã xóa ca thành công!'));
    } catch (error) {
        if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.errno === 1451) {
            return res.redirect('/shifts?error=' + encodeURIComponent('Không thể xóa: Ca này đã có dữ liệu điểm danh trong hệ thống!'));
        }
        console.error(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'ERROR',
            action: 'SHIFT_DELETE_ERROR',
            error: error.message
        }));
        res.redirect('/shifts?error=' + encodeURIComponent('Lỗi hệ thống khi xóa ca!'));
    }
}

module.exports = {
    listShifts,
    createShift,
    updateShift,
    deleteShift
};
