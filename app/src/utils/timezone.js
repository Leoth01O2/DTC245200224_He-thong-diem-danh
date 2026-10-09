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
 * Định dạng ngày theo YYYY-MM-DD theo giờ Việt Nam (dùng cho truy vấn SQL và input date)
 * @param {Date|string} [date=new Date()]
 * @returns {string} ví dụ "2026-10-09"
 */
function getVietnamDateString(date = new Date()) {
    const d = (typeof date === 'string') ? new Date(date) : date;
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: VIETNAM_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    return formatter.format(d);
}

/**
 * Định dạng hiển thị ngày giao diện theo chuẩn Việt Nam: DD/MM/YYYY
 * Tuyệt đối không để chuỗi thô kiểu "Fri Oct 09 2026..." hay "YYYY-MM-DD" trên giao diện
 * @param {Date|string} dateInput
 * @returns {string} ví dụ "09/10/2026"
 */
function formatDateVN(dateInput) {
    if (!dateInput) return '-';

    // Nếu là chuỗi đã chuẩn YYYY-MM-DD (hoặc bắt đầu bằng YYYY-MM-DD)
    const str = dateInput.toString().trim();
    const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
        return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
    }

    // Nếu là đối tượng Date hoặc timestamp
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return str;

    const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: VIETNAM_TZ,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    return formatter.format(d);
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
 * Định dạng giờ hiển thị giao diện HH:mm:ss hoặc HH:mm
 * @param {string} timeInput
 * @returns {string}
 */
function formatTimeVN(timeInput) {
    if (!timeInput) return '--:--';
    return timeInput.toString().trim();
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
    formatDateVN,
    getVietnamTimeString,
    formatTimeVN,
    timeToMinutes
};
