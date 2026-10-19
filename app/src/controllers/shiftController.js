const { pool } = require('../config/db');
const { timeToMinutes, timeToSeconds } = require('../utils/timezone');

/**
 * Chuẩn hóa tên ca: cắt khoảng trắng đầu/cuối, gom nhiều khoảng trắng liên tiếp và chuyển chữ thường
 */
function normalizeShiftName(str) {
    return (str || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function safeString(v) {
    if (typeof v === 'string') return v.trim();
    if (typeof v === 'number') return String(v).trim();
    return '';
}

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
function isValidTime(t) {
    return typeof t === 'string' && TIME_REGEX.test(t.trim());
}

const SHIFT_LOCK_NAME = 'attendance:shifts:name_unique';
const SHIFT_LOCK_TIMEOUT_SECONDS = 5;

/**
 * Danh sách ca làm / ca học kèm khôi phục form nếu có lỗi
 */
async function listShifts(req, res) {
    try {
        const [shifts] = await pool.query('SELECT * FROM shifts ORDER BY start_time ASC');

        const formData = req.session?.shiftFlashFormData || {};
        if (req.session?.shiftFlashFormData) {
            delete req.session.shiftFlashFormData;
        }

        res.render('shifts/index', {
            shifts,
            formData,
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
 * Thêm ca mới với đầy đủ quy tắc nghiệp vụ: độ dài <= 50, thời lượng >= 30p, grace < duration, chống trùng tên
 */
async function createShift(req, res) {
    const { name, start_time, end_time, late_after_minutes } = req.body;

    function returnWithError(errMsg) {
        if (req.session) {
            req.session.shiftFlashFormData = {
                name: safeString(name),
                start_time: safeString(start_time),
                end_time: safeString(end_time),
                late_after_minutes: (late_after_minutes !== undefined && late_after_minutes !== null) ? String(late_after_minutes) : '15',
                openForm: 'createShiftForm'
            };
        }
        return res.redirect('/shifts?error=' + encodeURIComponent(errMsg));
    }

    const trimmedName = safeString(name);
    const safeStartTime = safeString(start_time);
    const safeEndTime = safeString(end_time);

    if (!trimmedName || !safeStartTime || !safeEndTime) {
        return returnWithError('Vui lòng điền tên ca, giờ bắt đầu và giờ kết thúc!');
    }

    if (trimmedName.length > 50) {
        return returnWithError('Tên ca không được vượt quá 50 ký tự!');
    }

    if (!isValidTime(safeStartTime) || !isValidTime(safeEndTime)) {
        return returnWithError('Giờ bắt đầu và giờ kết thúc phải là định dạng giờ hợp lệ (HH:mm hoặc HH:mm:ss)!');
    }

    const startSec = timeToSeconds(safeStartTime);
    const endSec = timeToSeconds(safeEndTime);

    if (endSec <= startSec) {
        return returnWithError('Giờ kết thúc ca phải lớn hơn giờ bắt đầu ca!');
    }

    const durationSeconds = endSec - startSec;
    if (durationSeconds < 30 * 60) {
        return returnWithError('Thời lượng ca phải tối thiểu 30 phút!');
    }

    const rawLate = (late_after_minutes !== undefined && late_after_minutes !== null) ? String(late_after_minutes).trim() : '';
    if (!/^\d+$/.test(rawLate)) {
        return returnWithError('Số phút cho phép đi muộn phải là số nguyên không âm hợp lệ!');
    }

    const lateMinutes = parseInt(rawLate, 10);
    if (!Number.isSafeInteger(lateMinutes) || lateMinutes < 0) {
        return returnWithError('Số phút cho phép đi muộn phải là số nguyên không âm hợp lệ!');
    }

    if (lateMinutes * 60 >= durationSeconds) {
        return returnWithError('Số phút cho phép đi muộn phải nhỏ hơn tổng thời lượng ca!');
    }

    let conn;
    let lockAcquired = false;
    const targetNorm = normalizeShiftName(trimmedName);

    try {
        conn = await pool.getConnection();
        const [lockRows] = await conn.query('SELECT GET_LOCK(?, ?) AS lock_status', [
            SHIFT_LOCK_NAME,
            SHIFT_LOCK_TIMEOUT_SECONDS
        ]);
        const lockStatus = lockRows && lockRows[0] ? lockRows[0].lock_status : null;

        if (lockStatus !== 1) {
            console.warn(JSON.stringify({
                timestamp: new Date().toISOString(),
                level: 'WARN',
                action: 'SHIFT_CREATE_LOCK_TIMEOUT',
                lock_name: SHIFT_LOCK_NAME,
                lock_status: lockStatus
            }));
            return returnWithError('Hệ thống đang bận xử lý thao tác ca khác, vui lòng thử lại sau giây lát!');
        }

        lockAcquired = true;

        const [existingShifts] = await conn.query('SELECT id, name FROM shifts');
        const isDuplicate = existingShifts.some(s => normalizeShiftName(s.name) === targetNorm);

        if (isDuplicate) {
            return returnWithError(`Tên ca "${trimmedName}" đã tồn tại trong hệ thống!`);
        }

        await conn.query(
            'INSERT INTO shifts (name, start_time, end_time, late_after_minutes) VALUES (?, ?, ?, ?)',
            [trimmedName, safeStartTime, safeEndTime, lateMinutes]
        );

        console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'INFO',
            action: 'SHIFT_CREATED',
            name: trimmedName
        }));

        res.redirect('/shifts?success=' + encodeURIComponent('Thêm ca thành công!'));
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return returnWithError(`Tên ca "${trimmedName}" đã tồn tại trong hệ thống!`);
        }
        console.error(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'ERROR',
            action: 'SHIFT_CREATE_ERROR',
            error: error.message
        }));
        returnWithError('Lỗi hệ thống khi tạo ca!');
    } finally {
        if (conn) {
            if (lockAcquired) {
                try {
                    await conn.query('SELECT RELEASE_LOCK(?)', [SHIFT_LOCK_NAME]);
                } catch (relErr) {
                    console.error('RELEASE_LOCK error:', relErr);
                }
            }
            conn.release();
        }
    }
}

/**
 * Cập nhật thông tin ca với khôi phục form Edit modal khi lỗi và chống race condition
 */
async function updateShift(req, res) {
    const { id } = req.params;
    const { name, start_time, end_time, late_after_minutes } = req.body;

    function returnWithError(errMsg) {
        if (req.session) {
            req.session.shiftFlashFormData = {
                id,
                name: safeString(name),
                start_time: safeString(start_time),
                end_time: safeString(end_time),
                late_after_minutes: (late_after_minutes !== undefined && late_after_minutes !== null) ? String(late_after_minutes) : '15',
                openForm: 'editShiftModal'
            };
        }
        return res.redirect('/shifts?error=' + encodeURIComponent(errMsg));
    }

    const trimmedName = safeString(name);
    const safeStartTime = safeString(start_time);
    const safeEndTime = safeString(end_time);

    if (!trimmedName || !safeStartTime || !safeEndTime) {
        return returnWithError('Vui lòng điền đầy đủ thông tin ca!');
    }

    if (trimmedName.length > 50) {
        return returnWithError('Tên ca không được vượt quá 50 ký tự!');
    }

    if (!isValidTime(safeStartTime) || !isValidTime(safeEndTime)) {
        return returnWithError('Giờ bắt đầu và giờ kết thúc phải là định dạng giờ hợp lệ (HH:mm hoặc HH:mm:ss)!');
    }

    const startSec = timeToSeconds(safeStartTime);
    const endSec = timeToSeconds(safeEndTime);

    if (endSec <= startSec) {
        return returnWithError('Giờ kết thúc ca phải lớn hơn giờ bắt đầu ca!');
    }

    const durationSeconds = endSec - startSec;
    if (durationSeconds < 30 * 60) {
        return returnWithError('Thời lượng ca phải tối thiểu 30 phút!');
    }

    const rawLate = (late_after_minutes !== undefined && late_after_minutes !== null) ? String(late_after_minutes).trim() : '';
    if (!/^\d+$/.test(rawLate)) {
        return returnWithError('Số phút cho phép đi muộn phải là số nguyên không âm hợp lệ!');
    }

    const lateMinutes = parseInt(rawLate, 10);
    if (!Number.isSafeInteger(lateMinutes) || lateMinutes < 0) {
        return returnWithError('Số phút cho phép đi muộn phải là số nguyên không âm hợp lệ!');
    }

    if (lateMinutes * 60 >= durationSeconds) {
        return returnWithError('Số phút cho phép đi muộn phải nhỏ hơn tổng thời lượng ca!');
    }

    let conn;
    let lockAcquired = false;
    const targetNorm = normalizeShiftName(trimmedName);

    try {
        conn = await pool.getConnection();
        const [lockRows] = await conn.query('SELECT GET_LOCK(?, ?) AS lock_status', [
            SHIFT_LOCK_NAME,
            SHIFT_LOCK_TIMEOUT_SECONDS
        ]);
        const lockStatus = lockRows && lockRows[0] ? lockRows[0].lock_status : null;

        if (lockStatus !== 1) {
            console.warn(JSON.stringify({
                timestamp: new Date().toISOString(),
                level: 'WARN',
                action: 'SHIFT_UPDATE_LOCK_TIMEOUT',
                lock_name: SHIFT_LOCK_NAME,
                lock_status: lockStatus
            }));
            return returnWithError('Hệ thống đang bận xử lý thao tác ca khác, vui lòng thử lại sau giây lát!');
        }

        lockAcquired = true;

        const [otherShifts] = await conn.query('SELECT id, name FROM shifts WHERE id != ?', [id]);
        const isDuplicate = otherShifts.some(s => normalizeShiftName(s.name) === targetNorm);

        if (isDuplicate) {
            return returnWithError(`Tên ca "${trimmedName}" đã trùng với ca khác trong hệ thống!`);
        }

        await conn.query(
            'UPDATE shifts SET name = ?, start_time = ?, end_time = ?, late_after_minutes = ? WHERE id = ?',
            [trimmedName, safeStartTime, safeEndTime, lateMinutes, id]
        );

        console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'INFO',
            action: 'SHIFT_UPDATED',
            id
        }));

        res.redirect('/shifts?success=' + encodeURIComponent('Cập nhật ca thành công!'));
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return returnWithError(`Tên ca "${trimmedName}" đã trùng với ca khác trong hệ thống!`);
        }
        console.error(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'ERROR',
            action: 'SHIFT_UPDATE_ERROR',
            error: error.message
        }));
        return returnWithError('Lỗi hệ thống khi cập nhật ca!');
    } finally {
        if (conn) {
            if (lockAcquired) {
                try {
                    await conn.query('SELECT RELEASE_LOCK(?)', [SHIFT_LOCK_NAME]);
                } catch (relErr) {
                    console.error('RELEASE_LOCK error:', relErr);
                }
            }
            conn.release();
        }
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
        res.redirect('/shifts?error=' + encodeURIComponent('Lỗi xóa ca làm việc!'));
    }
}

module.exports = {
    listShifts,
    createShift,
    updateShift,
    deleteShift
};
