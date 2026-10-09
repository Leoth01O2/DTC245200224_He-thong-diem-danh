const { pool } = require('../config/db');
const { getVietnamDateString } = require('../utils/timezone');

/**
 * Hiển thị Dashboard với số liệu thống kê thời gian thực từ MySQL
 */
async function showDashboard(req, res) {
    try {
        const today = getVietnamDateString();

        // 1. Tổng số thành viên
        const [membersResult] = await pool.query('SELECT COUNT(*) AS total_members FROM members');
        const totalMembers = membersResult[0].total_members || 0;

        // 2. Tổng số ca
        const [shiftsResult] = await pool.query('SELECT COUNT(*) AS total_shifts FROM shifts');
        const totalShifts = shiftsResult[0].total_shifts || 0;

        // 3. Thống kê điểm danh hôm nay
        const [attendanceStats] = await pool.query(`
            SELECT 
                COUNT(*) AS total_checked_in,
                SUM(CASE WHEN status = 'on_time' THEN 1 ELSE 0 END) AS total_on_time,
                SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) AS total_late,
                SUM(CASE WHEN check_out IS NOT NULL THEN 1 ELSE 0 END) AS total_checked_out,
                SUM(CASE WHEN check_out IS NULL THEN 1 ELSE 0 END) AS total_not_checked_out
            FROM attendance
            WHERE attendance_date = ?
        `, [today]);

        const stats = {
            totalMembers,
            totalShifts,
            checkedInToday: attendanceStats[0].total_checked_in || 0,
            onTimeToday: attendanceStats[0].total_on_time || 0,
            lateToday: attendanceStats[0].total_late || 0,
            checkedOutToday: attendanceStats[0].total_checked_out || 0,
            notCheckedOutToday: attendanceStats[0].total_not_checked_out || 0
        };

        // 4. Lấy 10 lượt điểm danh gần nhất hôm nay
        const [recentAttendances] = await pool.query(`
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
                s.name AS shift_name
            FROM attendance a
            JOIN members m ON a.member_id = m.id
            JOIN shifts s ON a.shift_id = s.id
            WHERE a.attendance_date = ?
            ORDER BY a.created_at DESC
            LIMIT 10
        `, [today]);

        res.render('dashboard/index', {
            today,
            stats,
            recentAttendances
        });
    } catch (error) {
        console.error(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'ERROR',
            action: 'DASHBOARD_QUERY_ERROR',
            error: error.message
        }));
        res.status(500).render('error', { message: 'Không thể tải dữ liệu thống kê từ cơ sở dữ liệu!' });
    }
}

module.exports = {
    showDashboard
};
