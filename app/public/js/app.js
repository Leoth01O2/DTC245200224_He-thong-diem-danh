/**
 * JavaScript tương tác phía giao diện (Frontend Vanilla JS)
 * Tuân thủ CSP nghiêm ngặt: script-src 'self' (KHÔNG inline event handlers)
 */

document.addEventListener('DOMContentLoaded', function () {
    // 1. Đồng hồ thời gian thực (Realtime Clock)
    function updateRealtimeClock() {
        const clockEl = document.getElementById('realtimeClock');
        if (!clockEl) return;

        const now = new Date();
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

    if (document.getElementById('realtimeClock')) {
        updateRealtimeClock();
        setInterval(updateRealtimeClock, 1000);
    }

    // 2. Logic đóng/mở form (collapsible card toggle)
    function toggleForm(formId) {
        const el = document.getElementById(formId);
        if (!el) return;
        if (el.style.display === 'none' || el.style.display === '') {
            el.style.display = 'block';
        } else {
            el.style.display = 'none';
        }
    }

    // 3. Logic đóng modal thành viên & ca làm
    function closeEditMemberModal() {
        const modal = document.getElementById('editMemberModal');
        if (modal) modal.style.display = 'none';
    }

    function closeEditShiftModal() {
        const modal = document.getElementById('editShiftModal');
        if (modal) modal.style.display = 'none';
    }

    // 4. Event delegation cho toàn bộ thao tác click trên document
    document.addEventListener('click', function (event) {
        // A. Toggle Form (Thêm mới / Hủy / Đóng form)
        const toggleBtn = event.target.closest('[data-toggle-form]');
        if (toggleBtn) {
            const formId = toggleBtn.getAttribute('data-toggle-form');
            if (formId) toggleForm(formId);
            return;
        }

        // B. Mở modal Sửa Thành viên
        const editMemberBtn = event.target.closest('.js-edit-member');
        if (editMemberBtn) {
            const ds = editMemberBtn.dataset;
            const modal = document.getElementById('editMemberModal');
            const form = document.getElementById('editMemberForm');
            if (modal && form) {
                form.action = `/members/${ds.memberId}/edit`;
                const codeEl = document.getElementById('edit_code');
                const nameEl = document.getElementById('edit_full_name');
                const deptEl = document.getElementById('edit_department');
                const emailEl = document.getElementById('edit_email');

                if (codeEl) codeEl.value = ds.memberCode || '';
                if (nameEl) nameEl.value = ds.memberName || '';
                if (deptEl) deptEl.value = ds.memberDepartment || '';
                if (emailEl) emailEl.value = ds.memberEmail || '';

                modal.style.display = 'flex';
            }
            return;
        }

        // C. Đóng modal Sửa Thành viên
        const closeMemberBtn = event.target.closest('.js-close-member-modal');
        if (closeMemberBtn) {
            closeEditMemberModal();
            return;
        }

        // D. Mở modal Sửa Ca làm việc
        const editShiftBtn = event.target.closest('.js-edit-shift');
        if (editShiftBtn) {
            const ds = editShiftBtn.dataset;
            const modal = document.getElementById('editShiftModal');
            const form = document.getElementById('editShiftForm');
            if (modal && form) {
                form.action = `/shifts/${ds.shiftId}/edit`;
                const nameEl = document.getElementById('edit_shift_name');
                const startEl = document.getElementById('edit_shift_start');
                const endEl = document.getElementById('edit_shift_end');
                const lateEl = document.getElementById('edit_shift_late');

                if (nameEl) nameEl.value = ds.shiftName || '';
                if (startEl) startEl.value = ds.shiftStart || '';
                if (endEl) endEl.value = ds.shiftEnd || '';
                if (lateEl) lateEl.value = ds.shiftLate || '0';

                modal.style.display = 'flex';
            }
            return;
        }

        // E. Đóng modal Sửa Ca làm việc
        const closeShiftBtn = event.target.closest('.js-close-shift-modal');
        if (closeShiftBtn) {
            closeEditShiftModal();
            return;
        }

        // F. Đóng modal khi click ra backdrop bên ngoài
        const memberModal = document.getElementById('editMemberModal');
        if (memberModal && event.target === memberModal) {
            closeEditMemberModal();
            return;
        }
        const shiftModal = document.getElementById('editShiftModal');
        if (shiftModal && event.target === shiftModal) {
            closeEditShiftModal();
            return;
        }
    });

    // 5. Xác nhận xóa an toàn (Delete Confirmation)
    document.addEventListener('submit', function (event) {
        const form = event.target.closest('.js-confirm-delete');
        if (!form) return;

        const message = form.getAttribute('data-confirm-message') || 'Bạn có chắc chắn muốn xóa bản ghi này?';
        if (!window.confirm(message)) {
            event.preventDefault();
        }
    });

    // 6. Đồng bộ mã thành viên khi chọn từ dropdown điểm danh
    const memberSelect = document.getElementById('member_select');
    if (memberSelect) {
        memberSelect.addEventListener('change', function () {
            const codeInput = document.getElementById('member_code');
            if (codeInput && this.value) {
                codeInput.value = this.value;
            }
        });
    }
});
