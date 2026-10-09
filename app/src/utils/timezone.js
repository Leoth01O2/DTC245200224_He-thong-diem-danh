/**
 * Helper xử lý múi giờ Việt Nam (Asia/Ho_Chi_Minh - UTC+7)
 * Đảm bảo ngày giờ điểm danh luôn nhất quán, không phụ thuộc vào timezone của máy chủ hay container.
 */

const VIETNAM_TZ = 'Asia/Ho_Chi_Minh';

/**
 * Lấy đối tượng ngày giờ hiện tại theo giờ Việt Nam
 * @returns {Date}
 */
function getVietnamNow() {
    return new Date();
}

/**
 * Định dạng ngày theo YYYY-MM-DD theo giờ Việt Nam
 * @param {Date} [date=new Date()]
 * @returns {string} ví dụ "2026-10-09"
 */
function getVietnamDateString(date = new Date()) {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: VIETNAM_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    return formatter.format(date);
}

/**
 * Định dạng giờ theo HH:mm:ss theo giờ Việt Nam
 * @param {Date} [date=new Date()]
 * @returns {string} ví dụ "08:15:30"
 */
function getVietnamTimeString(date = new Date()) {
    const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: VIETNAM_TZ,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    return formatter.format(date);
}

/**
 * Chuyển chuỗi giờ "HH:mm" hoặc "HH:mm:ss" thành tổng số phút từ 00:00
 * @param {string} timeStr
 * @returns {number}
 */
function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.toString().split(':');
    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
    return hours * 60 + minutes;
}

module.exports = {
    VIETNAM_TZ,
    getVietnamNow,
    getVietnamDateString,
    getVietnamTimeString,
    timeToMinutes
};
