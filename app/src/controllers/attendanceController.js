const { pool } = require('../config/db');
const { getVietnamDateString, getVietnamTimeString, getVietnamDateTime, timeToMinutes } = require('../utils/timezone');
const { attendanceActionsTotal } = require('../config/metrics');

/**
 * Hiển thị trang điểm danh hôm nay
 */
async function showAttendancePage(req, res) {
    try {
        const { dateStr: today, timeStr: currentTime } = getVietnamDateTime();

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
 * Đảm bảo: đồng bộ ngày giờ từ 1 nguồn duy nhất, giới hạn khung giờ [start - 30, end),
 * transaction khóa hàng FOR UPDATE bảo vệ chống tranh chấp đồng thời, và quy tắc single active attendance.
 */
async function checkIn(req, res) {
    const rawMemberCode = req.body.member_code;
    const rawShiftId = req.body.shift_id;
    const rawNotes = req.body.notes;

    const member_code = typeof rawMemberCode === 'string' ? rawMemberCode.trim() : '';
    const shift_id = rawShiftId !== undefined && rawShiftId !== null ? String(rawShiftId).trim() : '';
    const notes = typeof rawNotes === 'string' ? rawNotes.trim() : '';

    if (!member_code || !shift_id) {
        return res.redirect('/attendance?error=' + encodeURIComponent('Vui lòng chọn hoặc nhập mã thành viên và ca điểm danh!'));
    }

    if (notes && notes.length > 255) {
        return res.redirect('/attendance?error=' + encodeURIComponent('Ghi chú không được vượt quá 255 ký tự!'));
    }

    let conn;

    try {
        conn = await pool.getConnection();
        await conn.beginTransaction();

        // 1. Khóa và kiểm tra thông tin thành viên (FOR UPDATE trên bảng members bảo vệ tính duy nhất và chống race condition cho cùng member)
        const [memberRows] = await conn.query(
            'SELECT id, code, full_name FROM members WHERE code = ? FOR UPDATE',
            [member_code.toUpperCase()]
        );

        if (memberRows.length === 0) {
            await conn.rollback();
            return res.redirect('/attendance?error=' + encodeURIComponent(`Không tìm thấy thành viên có mã "${member_code}"!`));
        }

        const member = memberRows[0];

        // 2. Đọc thông tin ca (không dùng FOR UPDATE để tránh khóa cả hàng shifts, loại bỏ tranh chấp không cần thiết giữa các thành viên khác nhau)
        const [shiftRows] = await conn.query('SELECT * FROM shifts WHERE id = ?', [shift_id]);
        if (shiftRows.length === 0) {
            await conn.rollback();
            return res.redirect('/attendance?error=' + encodeURIComponent('Ca làm việc không hợp lệ!'));
        }

        const shift = shiftRows[0];

        // 3. Thời gian thực tế theo giờ Việt Nam từ 1 thời điểm Date duy nhất
        const { dateStr: today, timeStr: nowTime } = getVietnamDateTime();
        const currentMinutes = timeToMinutes(nowTime);
        const shiftStartMinutes = timeToMinutes(shift.start_time);
        const shiftEndMinutes = timeToMinutes(shift.end_time);

        // Khung giờ cho phép check-in: từ 30 phút trước start_time đến trước end_time
        const earliestCheckInMinutes = Math.max(0, shiftStartMinutes - 30);

        if (currentMinutes < earliestCheckInMinutes) {
            await conn.rollback();
            const startFormatted = shift.start_time.substring(0, 5);
            return res.redirect('/attendance?error=' + encodeURIComponent(
                `Chưa đến thời gian cho phép điểm danh ca "${shift.name}" (chỉ cho phép từ 30 phút trước giờ bắt đầu ${startFormatted})!`
            ));
        }

        if (currentMinutes >= shiftEndMinutes) {
            await conn.rollback();
            const endFormatted = shift.end_time.substring(0, 5);
            return res.redirect('/attendance?error=' + encodeURIComponent(
                `Ca làm việc "${shift.name}" đã kết thúc lúc ${endFormatted}, không thể điểm danh!`
            ));
        }

        // 4. Kiểm tra thành viên đã check-in ca này trong ngày hôm nay chưa
        const [existing] = await conn.query(
            'SELECT id FROM attendance WHERE member_id = ? AND shift_id = ? AND attendance_date = ?',
            [member.id, shift.id, today]
        );

        if (existing.length > 0) {
            await conn.rollback();
            return res.redirect('/attendance?error=' + encodeURIComponent(
                `Thành viên ${member.code} - ${member.full_name} đã check-in ca này trong ngày hôm nay!`
            ));
        }

        // 5. Kiểm tra quy tắc Single Active Attendance (TC-081)
        // Không cho phép check-in ca mới nếu đang có ca khác trong ngày chưa check-out và ca đó chưa kết thúc
        const [activeAttendances] = await conn.query(`
            SELECT a.id, a.check_in, s.name AS shift_name, s.end_time
            FROM attendance a
            JOIN shifts s ON a.shift_id = s.id
            WHERE a.member_id = ? AND a.attendance_date = ? AND a.check_out IS NULL
        `, [member.id, today]);

        const ongoingShift = activeAttendances.find(att => currentMinutes < timeToMinutes(att.end_time));
        if (ongoingShift) {
            await conn.rollback();
            return res.redirect('/attendance?error=' + encodeURIComponent(
                `Thành viên ${member.code} đang trong ca "${ongoingShift.shift_name}" (chưa check-out). Vui lòng check-out ca trước khi điểm danh ca mới!`
            ));
        }

        // 6. Xác định trạng thái Đúng giờ hay Đi muộn
        const lateThresholdMinutes = shiftStartMinutes + (shift.late_after_minutes || 0);
        let status = 'on_time';
        if (currentMinutes > lateThresholdMinutes) {
            status = 'late';
        }

        // 7. Lưu vào cơ sở dữ liệu
        await conn.query(`
            INSERT INTO attendance (member_id, shift_id, attendance_date, check_in, status, notes)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [member.id, shift.id, today, nowTime, status, notes || null]);

        await conn.commit();

        // 8. Ghi Log JSON nghiệp vụ và Prometheus Metric sau khi commit thành công
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
            attendance_status: status
        }));

        attendanceActionsTotal.inc({ action: 'CHECK_IN', status });

        const statusLabel = status === 'on_time' ? 'Đúng giờ' : 'Đi muộn';
        res.redirect('/attendance?success=' + encodeURIComponent(
            `Check-in thành công: ${member.full_name} (${member.code}) - Trạng thái: ${statusLabel} lúc ${nowTime}`
        ));
    } catch (error) {
        if (conn) {
            try { await conn.rollback(); } catch (_) {}
        }
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
    } finally {
        if (conn) conn.release();
    }
}

/**
 * Xử lý Check-out điểm danh (Chống double-click bằng atomic UPDATE và affectedRows)
 */
async function checkOut(req, res) {
    const rawAttendanceId = req.body.attendance_id;
    const attendance_id = rawAttendanceId !== undefined && rawAttendanceId !== null ? String(rawAttendanceId).trim() : '';

    if (!attendance_id) {
        return res.redirect('/attendance?error=' + encodeURIComponent('Mã bản ghi điểm danh không hợp lệ!'));
    }

    try {
        const { timeStr: nowTime } = getVietnamDateTime();

        // Cập nhật nguyên tử: chỉ update khi check_out đang là NULL
        const [result] = await pool.query(
            'UPDATE attendance SET check_out = ? WHERE id = ? AND check_out IS NULL',
            [nowTime, attendance_id]
        );

        if (result.affectedRows === 0) {
            // Kiểm tra xem đã check-out từ trước hay bản ghi không tồn tại
            const [existingRows] = await pool.query(`
                SELECT a.id, a.check_out, m.full_name
                FROM attendance a
                JOIN members m ON a.member_id = m.id
                WHERE a.id = ?
            `, [attendance_id]);

            if (existingRows.length > 0 && existingRows[0].check_out) {
                return res.redirect('/attendance?error=' + encodeURIComponent(
                    `Thành viên ${existingRows[0].full_name} đã check-out lúc ${existingRows[0].check_out} rồi!`
                ));
            }
            return res.redirect('/attendance?error=' + encodeURIComponent('Không tìm thấy bản ghi điểm danh!'));
        }

        // Lấy thông tin bản ghi để ghi log và phản hồi
        const [rows] = await pool.query(`
            SELECT m.code, m.full_name, s.name AS shift_name
            FROM attendance a
            JOIN members m ON a.member_id = m.id
            JOIN shifts s ON a.shift_id = s.id
            WHERE a.id = ?
        `, [attendance_id]);

        const record = rows[0] || { code: 'N/A', full_name: 'Thành viên', shift_name: 'Ca' };

        // Ghi Log JSON nghiệp vụ
        console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'INFO',
            action: 'CHECK_OUT',
            member_code: record.code,
            member_name: record.full_name,
            shift_name: record.shift_name,
            attendance_id,
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
 * Xem lịch sử điểm danh với bộ lọc kết hợp và phân trang server-side (TC-093)
 */
async function showHistory(req, res) {
    try {
        const { date, member_id, status } = req.query;

        // Chuẩn hóa tham số page thành số nguyên dương hợp lệ
        let requestedPage = 1;
        const rawPage = req.query.page;
        if (typeof rawPage === 'string' && /^\d+$/.test(rawPage.trim())) {
            const parsed = parseInt(rawPage.trim(), 10);
            if (parsed >= 1) {
                requestedPage = parsed;
            }
        }

        const limit = 100;

        let whereClause = 'WHERE 1=1';
        const params = [];

        if (date && typeof date === 'string' && date.trim()) {
            whereClause += ' AND a.attendance_date = ?';
            params.push(date.trim());
        }

        if (member_id && typeof member_id === 'string' && member_id.trim()) {
            whereClause += ' AND a.member_id = ?';
            params.push(member_id.trim());
        }

        if (status && typeof status === 'string' && (status.trim() === 'on_time' || status.trim() === 'late')) {
            whereClause += ' AND a.status = ?';
            params.push(status.trim());
        }

        // 1. Đếm tổng số bản ghi phù hợp bộ lọc
        const countQuery = `
            SELECT COUNT(*) AS total
            FROM attendance a
            JOIN members m ON a.member_id = m.id
            JOIN shifts s ON a.shift_id = s.id
            ${whereClause}
        `;
        const [countResult] = await pool.query(countQuery, params);
        const totalRecords = countResult[0].total || 0;
        const totalPages = Math.max(1, Math.ceil(totalRecords / limit));

        // Clamp page nếu vượt quá totalPages về trang cuối cùng
        let page = requestedPage;
        if (page > totalPages) {
            page = totalPages;
        }

        const offset = (page - 1) * limit;

        // 2. Lấy dữ liệu trang hiện tại với khóa sắp xếp phụ a.id DESC
        const dataQuery = `
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
            ${whereClause}
            ORDER BY a.attendance_date DESC, a.check_in DESC, a.id DESC
            LIMIT ? OFFSET ?
        `;
        const [historyList] = await pool.query(dataQuery, [...params, limit, offset]);

        // 3. Lấy danh sách members để hiển thị trong dropdown filter
        const [members] = await pool.query('SELECT id, code, full_name FROM members ORDER BY full_name ASC');

        // Tạo chuỗi truy vấn giữ nguyên bộ lọc khi chuyển trang
        const queryParams = new URLSearchParams();
        if (date && typeof date === 'string' && date.trim()) queryParams.set('date', date.trim());
        if (member_id && typeof member_id === 'string' && member_id.trim()) queryParams.set('member_id', member_id.trim());
        if (status && typeof status === 'string' && (status.trim() === 'on_time' || status.trim() === 'late')) {
            queryParams.set('status', status.trim());
        }
        const filterQueryStr = queryParams.toString() ? '&' + queryParams.toString() : '';

        res.render('attendance/history', {
            historyList,
            members,
            filterDate: typeof date === 'string' ? date.trim() : '',
            filterMemberId: typeof member_id === 'string' ? member_id.trim() : '',
            filterStatus: typeof status === 'string' ? status.trim() : '',
            filterQueryStr,
            currentPage: page,
            totalPages,
            totalRecords,
            limit
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
