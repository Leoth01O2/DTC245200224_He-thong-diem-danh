/**
 * JavaScript tương tác phía giao diện (Frontend Vanilla JS)
 * Tuân thủ CSP nghiêm ngặt: script-src 'self' (KHÔNG inline event handlers)
 */

document.addEventListener('DOMContentLoaded', function () {
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

    function setupAlertAutoDismiss() {
        const successAlerts = document.querySelectorAll('.alert-success');
        successAlerts.forEach(function (el) {
            setTimeout(function () {
                el.classList.add('alert-fade-out');
                setTimeout(function () {
                    if (el.parentNode) el.parentNode.removeChild(el);
                }, 500);
            }, 5000);
        });

        const dangerAlerts = document.querySelectorAll('.alert-danger');
        dangerAlerts.forEach(function (el) {
            setTimeout(function () {
                el.classList.add('alert-fade-out');
                setTimeout(function () {
                    if (el.parentNode) el.parentNode.removeChild(el);
                }, 500);
            }, 9000);
        });
    }
    setupAlertAutoDismiss();

    function toggleForm(formId) {
        const el = document.getElementById(formId);
        if (!el) return;
        if (el.style.display === 'none' || el.style.display === '') {
            el.style.display = 'block';
            const firstInput = el.querySelector('input:not([type="hidden"]), select, textarea');
            if (firstInput) firstInput.focus();
        } else {
            el.style.display = 'none';
        }
    }

    let lastFocusedElement = null;

    function openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        lastFocusedElement = document.activeElement;
        modal.style.display = 'flex';

        const firstInput = modal.querySelector('input:not([type="hidden"]), select, textarea');
        if (firstInput) {
            firstInput.focus();
        } else {
            const focusables = modal.querySelectorAll('button');
            if (focusables.length > 0) {
                focusables[0].focus();
            }
        }
    }

    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        modal.style.display = 'none';

        if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
            lastFocusedElement.focus();
        }
        lastFocusedElement = null;
    }

    function closeEditMemberModal() {
        closeModal('editMemberModal');
    }

    function closeEditShiftModal() {
        closeModal('editShiftModal');
    }

    function getCurrentlyOpenModal() {
        const memberModal = document.getElementById('editMemberModal');
        if (memberModal && memberModal.style.display !== 'none' && memberModal.style.display !== '') {
            return memberModal;
        }
        const shiftModal = document.getElementById('editShiftModal');
        if (shiftModal && shiftModal.style.display !== 'none' && shiftModal.style.display !== '') {
            return shiftModal;
        }
        return null;
    }

    const initialOpenModal = getCurrentlyOpenModal();
    if (initialOpenModal) {
        const firstInput = initialOpenModal.querySelector('input:not([type="hidden"]), select, textarea');
        if (firstInput) {
            firstInput.focus();
        } else {
            const focusables = initialOpenModal.querySelectorAll('button');
            if (focusables.length > 0) {
                focusables[0].focus();
            }
        }
    }

    document.addEventListener('keydown', function (event) {
        const activeModal = getCurrentlyOpenModal();
        if (!activeModal) return;

        if (event.key === 'Escape' || event.key === 'Esc') {
            event.preventDefault();
            closeModal(activeModal.id);
            return;
        }

        if (event.key === 'Tab') {
            const focusableElements = activeModal.querySelectorAll(
                'button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            );
            if (focusableElements.length === 0) return;

            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (!activeModal.contains(document.activeElement)) {
                event.preventDefault();
                firstElement.focus();
                return;
            }

            if (event.shiftKey) {
                if (document.activeElement === firstElement) {
                    event.preventDefault();
                    lastElement.focus();
                }
            } else {
                if (document.activeElement === lastElement) {
                    event.preventDefault();
                    firstElement.focus();
                }
            }
        }
    });

    document.addEventListener('click', function (event) {
        const toggleBtn = event.target.closest('[data-toggle-form]');
        if (toggleBtn) {
            const formId = toggleBtn.getAttribute('data-toggle-form');
            if (formId) toggleForm(formId);
            return;
        }

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

                openModal('editMemberModal');
            }
            return;
        }

        const closeMemberBtn = event.target.closest('.js-close-member-modal');
        if (closeMemberBtn) {
            closeEditMemberModal();
            return;
        }

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

                openModal('editShiftModal');
            }
            return;
        }

        const closeShiftBtn = event.target.closest('.js-close-shift-modal');
        if (closeShiftBtn) {
            closeEditShiftModal();
            return;
        }

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

    document.addEventListener('submit', function (event) {
        const form = event.target.closest('.js-confirm-delete');
        if (!form) return;

        const message = form.getAttribute('data-confirm-message') || 'Bạn có chắc chắn muốn xóa bản ghi này?';
        if (!window.confirm(message)) {
            event.preventDefault();
        }
    });

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

window.addEventListener('pageshow', function (event) {
    if (event.persisted) {
        window.location.reload();
    }
});
