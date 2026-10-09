const { pool } = require('../config/db');
const { getVietnamDateString, getVietnamTimeString, timeToMinutes } = require('../utils/timezone');
const { attendanceActionsTotal } = require('../config/metrics');

/**
 * Hiển thị trang điểm danh hôm nay
 */
async function showAttendancePage(req, res) {
    try {
        const today = getVietnamDateString();
        const currentTime = getVietnamTimeString();

        // Lấy danh sách thành viên và các ca để đưa vào form chọn
        const [members] = await pool.query('SELECT id, code, full_name, department FROM members ORDER BY code ASC');
        const [shifts] = await pool.query('SELECT * FROM shifts ORDER BY start_time ASC');

        // Lấy danh sách đã điểm danh hôm nay
        const [todayAttendances] = await pool.query(`
            SELECT 
                a.id,
                a.attendance_date,
                a.check_in,
                a.check_out,
                a.status,
                a.notes,
                m.code AS member_code,
                m.full_name AS member_name,
                m.department,
                s.name AS shift_name,
                s.start_time,
                s.end_time
            FROM attendance a
            JOIN members m ON a.member_id = m.id
            JOIN shifts s ON a.shift_id = s.id
            WHERE a.attendance_date = ?
            ORDER BY a.created_at DESC
        `, [today]);

        res.render('attendance/checkin', {
            today,
            currentTime,
            members,
            shifts,
            todayAttendances,
            success: req.query.success || null,
            error: req.query.error || null
        });
    } catch (error) {
        console.error(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'ERROR',
            action: 'ATTENDANCE_PAGE_ERROR',
            error: error.message
        }));
        res.status(500).render('error', { message: 'Lỗi tải trang điểm danh!' });
    }
}

/**
 * Xử lý Check-in điểm danh
 */
async function checkIn(req, res) {
    const { member_code, shift_id, notes } = req.body;

    if (!member_code || !shift_id) {
        return res.redirect('/attendance?error=' + encodeURIComponent('Vui lòng chọn hoặc nhập mã thành viên và ca điểm danh!'));
    }

    try {
        // 1. Kiểm tra thành viên có tồn tại không
        const [memberRows] = await pool.query(
            'SELECT id, code, full_name FROM members WHERE code = ?',
            [member_code.trim().toUpperCase()]
        );

        if (memberRows.length === 0) {
            return res.redirect('/attendance?error=' + encodeURIComponent(`Không tìm thấy thành viên có mã "${member_code.trim()}"!`));
        }

        const member = memberRows[0];

        // 2. Lấy thông tin ca
        const [shiftRows] = await pool.query('SELECT * FROM shifts WHERE id = ?', [shift_id]);
        if (shiftRows.length === 0) {
            return res.redirect('/attendance?error=' + encodeURIComponent('Ca làm việc không hợp lệ!'));
        }

        const shift = shiftRows[0];

        // 3. Thời gian thực tế theo giờ Việt Nam
        const today = getVietnamDateString();
        const nowTime = getVietnamTimeString();

        // 4. Kiểm tra đã check-in ca này trong ngày hôm nay chưa
        const [existing] = await pool.query(
            'SELECT id FROM attendance WHERE member_id = ? AND shift_id = ? AND attendance_date = ?',
            [member.id, shift.id, today]
        );

        if (existing.length > 0) {
            return res.redirect('/attendance?error=' + encodeURIComponent(`Thành viên ${member.code} - ${member.full_name} đã check-in ca này trong ngày hôm nay!`));
        }

        // 5. Xác định trạng thái Đúng giờ hay Đi muộn
        const currentMinutes = timeToMinutes(nowTime);
        const shiftStartMinutes = timeToMinutes(shift.start_time);
        const lateThresholdMinutes = shiftStartMinutes + (shift.late_after_minutes || 0);

        let status = 'on_time';
        if (currentMinutes > lateThresholdMinutes) {
            status = 'late';
        }

        // 6. Lưu vào cơ sở dữ liệu
        await pool.query(`
            INSERT INTO attendance (member_id, shift_id, attendance_date, check_in, status, notes)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [member.id, shift.id, today, nowTime, status, notes ? notes.trim() : null]);

        // 7. Ghi Log JSON nghiệp vụ chuẩn xác ra stdout
        console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'INFO',
            action: 'CHECK_IN',
            member_code: member.code,
            member_name: member.full_name,
            shift_id: shift.id,
            shift_name: shift.name,
            attendance_date: today,
            check_in_time: nowTime,
            status: status
        }));

        // 8. Tăng Prometheus metric
        attendanceActionsTotal.inc({ action: 'CHECK_IN', status });

        const statusLabel = status === 'on_time' ? 'Đúng giờ' : 'Đi muộn';
        res.redirect('/attendance?success=' + encodeURIComponent(`Check-in thành công: ${member.full_name} (${member.code}) - Trạng thái: ${statusLabel} lúc ${nowTime}`));
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.redirect('/attendance?error=' + encodeURIComponent('Thành viên này đã có bản ghi điểm danh trong ca này hôm nay!'));
        }
        console.error(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'ERROR',
            action: 'CHECK_IN_ERROR',
            error: error.message
        }));
        res.redirect('/attendance?error=' + encodeURIComponent('Lỗi hệ thống khi check-in!'));
    }
}

/**
 * Xử lý Check-out điểm danh
 */
async function checkOut(req, res) {
    const { attendance_id } = req.body;

    if (!attendance_id) {
        return res.redirect('/attendance?error=' + encodeURIComponent('Mã bản ghi điểm danh không hợp lệ!'));
    }

    try {
        const [rows] = await pool.query(`
            SELECT a.id, a.check_out, m.code, m.full_name, s.name AS shift_name
            FROM attendance a
            JOIN members m ON a.member_id = m.id
            JOIN shifts s ON a.shift_id = s.id
            WHERE a.id = ?
        `, [attendance_id]);

        if (rows.length === 0) {
            return res.redirect('/attendance?error=' + encodeURIComponent('Không tìm thấy bản ghi điểm danh!'));
        }

        const record = rows[0];

        if (record.check_out) {
            return res.redirect('/attendance?error=' + encodeURIComponent(`Thành viên ${record.full_name} đã check-out lúc ${record.check_out} rồi!`));
        }

        const nowTime = getVietnamTimeString();

        await pool.query('UPDATE attendance SET check_out = ? WHERE id = ?', [nowTime, attendance_id]);

        // Ghi Log JSON nghiệp vụ chuẩn xác ra stdout
        console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'INFO',
            action: 'CHECK_OUT',
            member_code: record.code,
            member_name: record.full_name,
            shift_name: record.shift_name,
            attendance_id: record.id,
            check_out_time: nowTime
        }));

        // Tăng Prometheus metric
        attendanceActionsTotal.inc({ action: 'CHECK_OUT', status: 'success' });

        res.redirect('/attendance?success=' + encodeURIComponent(`Check-out thành công cho ${record.full_name} lúc ${nowTime}`));
    } catch (error) {
        console.error(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'ERROR',
            action: 'CHECK_OUT_ERROR',
            error: error.message
        }));
        res.redirect('/attendance?error=' + encodeURIComponent('Lỗi hệ thống khi check-out!'));
    }
}

/**
 * Xem lịch sử điểm danh với bộ lọc kết hợp
 */
async function showHistory(req, res) {
    try {
        const { date, member_id, status } = req.query;

        let query = `
            SELECT 
                a.id,
                a.attendance_date,
                a.check_in,
                a.check_out,
                a.status,
                a.notes,
                m.id AS member_id,
                m.code AS member_code,
                m.full_name AS member_name,
                m.department,
                s.name AS shift_name
            FROM attendance a
            JOIN members m ON a.member_id = m.id
            JOIN shifts s ON a.shift_id = s.id
            WHERE 1=1
        `;
        const params = [];

        if (date && date.trim()) {
            query += ' AND a.attendance_date = ?';
            params.push(date.trim());
        }

        if (member_id && member_id.trim()) {
            query += ' AND a.member_id = ?';
            params.push(member_id.trim());
        }

        if (status && (status === 'on_time' || status === 'late')) {
            query += ' AND a.status = ?';
            params.push(status.trim());
        }

        query += ' ORDER BY a.attendance_date DESC, a.check_in DESC LIMIT 100';

        const [historyList] = await pool.query(query, params);

        // Lấy danh sách members để hiển thị trong dropdown filter
        const [members] = await pool.query('SELECT id, code, full_name FROM members ORDER BY full_name ASC');

        res.render('attendance/history', {
            historyList,
            members,
            filterDate: date || '',
            filterMemberId: member_id || '',
            filterStatus: status || ''
        });
    } catch (error) {
        console.error(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'ERROR',
            action: 'ATTENDANCE_HISTORY_ERROR',
            error: error.message
        }));
        res.status(500).render('error', { message: 'Lỗi tải lịch sử điểm danh!' });
    }
}

module.exports = {
    showAttendancePage,
    checkIn,
    checkOut,
    showHistory
};
