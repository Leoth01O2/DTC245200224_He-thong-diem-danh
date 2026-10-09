/**
 * JavaScript tương tác phía giao diện (Frontend Vanilla JS)
 */

// 1. Đồng hồ thời gian thực (Realtime Clock)
function updateRealtimeClock() {
    const clockEl = document.getElementById('realtimeClock');
    if (!clockEl) return;

    const now = new Date();
    // Định dạng giờ theo múi giờ Việt Nam
    const options = {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };
    const timeStr = new Intl.DateTimeFormat('en-GB', options).format(now);
    clockEl.textContent = timeStr;
}

setInterval(updateRealtimeClock, 1000);

// 2. Đóng/mở form thêm mới (collapsible)
function toggleForm(formId) {
    const el = document.getElementById(formId);
    if (!el) return;
    if (el.style.display === 'none' || el.style.display === '') {
        el.style.display = 'block';
    } else {
        el.style.display = 'none';
    }
}

// 3. Modal cập nhật thành viên
function openEditMemberModal(id, code, fullName, department, email) {
    const modal = document.getElementById('editMemberModal');
    const form = document.getElementById('editMemberForm');
    if (!modal || !form) return;

    form.action = `/members/${id}/edit`;
    document.getElementById('edit_code').value = code;
    document.getElementById('edit_full_name').value = fullName;
    document.getElementById('edit_department').value = department;
    document.getElementById('edit_email').value = email || '';

    modal.style.display = 'flex';
}

function closeEditMemberModal() {
    const modal = document.getElementById('editMemberModal');
    if (modal) modal.style.display = 'none';
}

// 4. Modal cập nhật ca làm việc
function openEditShiftModal(id, name, startTime, endTime, lateAfterMinutes) {
    const modal = document.getElementById('editShiftModal');
    const form = document.getElementById('editShiftForm');
    if (!modal || !form) return;

    form.action = `/shifts/${id}/edit`;
    document.getElementById('edit_shift_name').value = name;
    document.getElementById('edit_shift_start').value = startTime;
    document.getElementById('edit_shift_end').value = endTime;
    document.getElementById('edit_shift_late').value = lateAfterMinutes;

    modal.style.display = 'flex';
}

function closeEditShiftModal() {
    const modal = document.getElementById('editShiftModal');
    if (modal) modal.style.display = 'none';
}

// Đóng modal khi click ra ngoài backdrop
window.addEventListener('click', function(event) {
    const memberModal = document.getElementById('editMemberModal');
    if (memberModal && event.target === memberModal) {
        closeEditMemberModal();
    }
    const shiftModal = document.getElementById('editShiftModal');
    if (shiftModal && event.target === shiftModal) {
        closeEditShiftModal();
    }
});

// 5. Đồng bộ mã thành viên khi chọn từ dropdown điểm danh
function syncMemberCode(val) {
    const codeInput = document.getElementById('member_code');
    if (codeInput && val) {
        codeInput.value = val;
    }
}

