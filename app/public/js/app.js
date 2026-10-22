/**
 * JavaScript tương tác phía giao diện (Frontend Vanilla JS)
 * Tuân thủ CSP nghiêm ngặt: script-src 'self' (KHÔNG inline event handlers)
 */

document.addEventListener('DOMContentLoaded', function () {
    // ==========================================
    // 1. THEME MANAGEMENT (Light / Dark Mode)
    // ==========================================
    function updateThemeUI(theme) {
        const isDark = theme === 'dark';
        const targetLabel = isDark ? 'Giao diện sáng' : 'Giao diện tối';
        const targetAria = isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối';
        const targetIcon = isDark ? 'light_mode' : 'dark_mode';

        // Update all theme toggle buttons across the page (sidebar, topbar, login)
        const toggles = document.querySelectorAll('.js-theme-toggle');
        toggles.forEach(function (btn) {
            btn.setAttribute('aria-label', targetAria);
            btn.setAttribute('title', targetAria);

            const iconEl = btn.querySelector('.theme-toggle-icon');
            if (iconEl) {
                iconEl.textContent = targetIcon;
            }

            const labelEl = btn.querySelector('.theme-toggle-label');
            if (labelEl) {
                labelEl.textContent = targetLabel;
            }
        });
    }

    function toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        try {
            localStorage.setItem('attendance_theme', newTheme);
        } catch (e) {}
        updateThemeUI(newTheme);
    }

    // Sync theme UI on load with current data-theme
    const initialTheme = document.documentElement.getAttribute('data-theme') || 'light';
    updateThemeUI(initialTheme);

    // ==========================================
    // 1.1. SIDEBAR ACTIVE MENU SYNC
    // ==========================================
    function syncActiveSidebarMenu() {
        const path = window.location.pathname;
        const navLinks = document.querySelectorAll('#appSidebar .sidebar-nav .nav-link');
        if (!navLinks.length) return;

        let targetHref = null;
        if (path === '/dashboard' || path === '/') {
            targetHref = '/dashboard';
        } else if (path.startsWith('/attendance/history')) {
            targetHref = '/attendance/history';
        } else if (path.startsWith('/attendance')) {
            targetHref = '/attendance';
        } else if (path.startsWith('/members')) {
            targetHref = '/members';
        } else if (path.startsWith('/shifts')) {
            targetHref = '/shifts';
        }

        if (targetHref) {
            navLinks.forEach(function (link) {
                if (link.getAttribute('href') === targetHref) {
                    link.classList.add('active');
                } else {
                    link.classList.remove('active');
                }
            });
        }
    }
    syncActiveSidebarMenu();

    // ==========================================
    // 2. SIDEBAR COLLAPSE / EXPAND (Desktop)
    // ==========================================
    const collapseBtn = document.getElementById('sidebarCollapseBtn');
    let tooltipEl = document.getElementById('appSidebarTooltip');

    function updateSidebarCollapseUI(isCollapsed) {
        if (!collapseBtn) return;
        const iconEl = collapseBtn.querySelector('.toggle-icon');
        if (isCollapsed) {
            if (iconEl) iconEl.textContent = 'menu';
            collapseBtn.setAttribute('aria-label', 'Mở rộng sidebar');
            collapseBtn.setAttribute('data-tooltip', 'Mở rộng sidebar');
            collapseBtn.setAttribute('title', 'Mở rộng sidebar');
        } else {
            if (iconEl) iconEl.textContent = 'menu_open';
            collapseBtn.setAttribute('aria-label', 'Thu gọn sidebar');
            collapseBtn.setAttribute('data-tooltip', 'Thu gọn sidebar');
            collapseBtn.setAttribute('title', 'Thu gọn sidebar');
        }
    }

    function toggleSidebarCollapse() {
        hideSidebarTooltip();
        const currentState = document.documentElement.getAttribute('data-sidebar') || 'expanded';
        const newState = currentState === 'collapsed' ? 'expanded' : 'collapsed';
        document.documentElement.setAttribute('data-sidebar', newState);
        try {
            localStorage.setItem('attendance_sidebar', newState);
        } catch (e) {}
        updateSidebarCollapseUI(newState === 'collapsed');
    }

    if (collapseBtn) {
        collapseBtn.addEventListener('click', toggleSidebarCollapse);
        const initialSidebar = document.documentElement.getAttribute('data-sidebar') || 'expanded';
        updateSidebarCollapseUI(initialSidebar === 'collapsed');
    }

    // ==========================================
    // 3. FLOATING TOOLTIPS (Collapsed Sidebar)
    // ==========================================
    function getTooltipTarget(target) {
        if (!target) return null;
        return target.closest ? target.closest('#appSidebar [data-tooltip]') : null;
    }

    function showSidebarTooltip(target) {
        const isCollapsed = document.documentElement.getAttribute('data-sidebar') === 'collapsed';
        if (!isCollapsed || window.innerWidth < 992) return;
        const text = target.getAttribute('data-tooltip');
        if (!text) return;

        if (!tooltipEl) {
            tooltipEl = document.createElement('div');
            tooltipEl.id = 'appSidebarTooltip';
            tooltipEl.className = 'sidebar-floating-tooltip';
            tooltipEl.setAttribute('role', 'tooltip');
            tooltipEl.setAttribute('aria-hidden', 'true');
            document.body.appendChild(tooltipEl);
        }

        tooltipEl.textContent = text;
        const rect = target.getBoundingClientRect();
        const top = rect.top + (rect.height / 2);
        const left = rect.right + 10;

        tooltipEl.style.top = Math.round(top) + 'px';
        tooltipEl.style.left = Math.round(left) + 'px';
        tooltipEl.classList.add('visible');
    }

    function hideSidebarTooltip() {
        if (tooltipEl) {
            tooltipEl.classList.remove('visible');
        }
    }

    const appSidebar = document.getElementById('appSidebar');
    if (appSidebar) {
        appSidebar.addEventListener('mouseover', function (event) {
            const item = getTooltipTarget(event.target);
            if (item) showSidebarTooltip(item);
        });

        appSidebar.addEventListener('mouseout', function (event) {
            const item = getTooltipTarget(event.target);
            const related = getTooltipTarget(event.relatedTarget);
            if (item && item !== related) hideSidebarTooltip();
        });

        appSidebar.addEventListener('focus', function (event) {
            const item = getTooltipTarget(event.target);
            if (item) showSidebarTooltip(item);
        }, true);

        appSidebar.addEventListener('blur', function (event) {
            const item = getTooltipTarget(event.target);
            hideSidebarTooltip();
        }, true);
    }

    // ==========================================
    // 4. SIDEBAR MOBILE DRAWER (Tablet / Mobile)
    // ==========================================
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileCloseBtn = document.getElementById('sidebarCloseBtn');
    const sidebarBackdrop = document.getElementById('sidebarBackdrop');

    let previousActiveElementBeforeDrawer = null;

    function getDrawerFocusableElements() {
        if (!appSidebar) return [];
        return Array.from(appSidebar.querySelectorAll(
            'a[href]:not([disabled]), button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )).filter(function (el) {
            return el.offsetWidth > 0 || el.offsetHeight > 0 || el === mobileCloseBtn;
        });
    }

    function openMobileDrawer() {
        hideSidebarTooltip();
        previousActiveElementBeforeDrawer = document.activeElement;
        document.body.classList.add('sidebar-mobile-open');
        document.body.style.overflow = 'hidden';

        if (mobileMenuBtn) {
            mobileMenuBtn.setAttribute('aria-expanded', 'true');
        }

        setTimeout(function () {
            if (mobileCloseBtn && typeof mobileCloseBtn.focus === 'function') {
                mobileCloseBtn.focus();
            } else {
                const focusables = getDrawerFocusableElements();
                if (focusables.length > 0) focusables[0].focus();
            }
        }, 50);
    }

    function closeMobileDrawer() {
        if (!document.body.classList.contains('sidebar-mobile-open')) return;
        document.body.classList.remove('sidebar-mobile-open');
        document.body.style.overflow = '';

        if (mobileMenuBtn) {
            mobileMenuBtn.setAttribute('aria-expanded', 'false');
        }

        if (mobileMenuBtn && typeof mobileMenuBtn.focus === 'function' && document.body.contains(mobileMenuBtn)) {
            mobileMenuBtn.focus();
        } else if (previousActiveElementBeforeDrawer && typeof previousActiveElementBeforeDrawer.focus === 'function' && document.body.contains(previousActiveElementBeforeDrawer)) {
            previousActiveElementBeforeDrawer.focus();
        }
        previousActiveElementBeforeDrawer = null;
    }

    if (mobileMenuBtn) {
        mobileMenuBtn.setAttribute('aria-expanded', 'false');
        mobileMenuBtn.addEventListener('click', openMobileDrawer);
    }
    if (mobileCloseBtn) {
        mobileCloseBtn.addEventListener('click', closeMobileDrawer);
    }
    if (sidebarBackdrop) {
        sidebarBackdrop.addEventListener('click', closeMobileDrawer);
    }

    // Close drawer when mobile user clicks a navigation link
    if (appSidebar) {
        const navLinks = appSidebar.querySelectorAll('.nav-link');
        navLinks.forEach(function (link) {
            link.addEventListener('click', function () {
                if (window.innerWidth < 992) {
                    closeMobileDrawer();
                }
            });
        });
    }

    // Listen for resize across breakpoint
    window.addEventListener('resize', function () {
        if (window.innerWidth >= 992) {
            if (document.body.classList.contains('sidebar-mobile-open')) {
                closeMobileDrawer();
            }
        } else {
            hideSidebarTooltip();
        }
    });

    // ==========================================
    // 5. REAL-TIME CLOCK
    // ==========================================
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

    // ==========================================
    // 6. ALERT AUTO-DISMISS
    // ==========================================
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

    // ==========================================
    // 7. COLLAPSIBLE FORMS
    // ==========================================
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

    // ==========================================
    // 8. MODALS & ACCESSIBILITY
    // ==========================================
    let lastFocusedElement = null;

    function openModal(modalId) {
        hideSidebarTooltip();
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

    // Keyboard handlers (Escape & Tab trap for Modal & Drawer)
    document.addEventListener('keydown', function (event) {
        // Priority 1: Modals
        const activeModal = getCurrentlyOpenModal();
        if (activeModal) {
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
            return;
        }

        // Priority 2: Mobile Drawer
        if (document.body.classList.contains('sidebar-mobile-open')) {
            if (event.key === 'Escape' || event.key === 'Esc') {
                event.preventDefault();
                closeMobileDrawer();
                return;
            }

            if (event.key === 'Tab') {
                const focusableElements = getDrawerFocusableElements();
                if (focusableElements.length === 0) return;

                const firstElement = focusableElements[0];
                const lastElement = focusableElements[focusableElements.length - 1];

                if (!appSidebar.contains(document.activeElement)) {
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
        }
    });

    // Delegated click handler
    document.addEventListener('click', function (event) {
        // Theme toggle button click
        const themeBtn = event.target.closest('.js-theme-toggle');
        if (themeBtn) {
            toggleTheme();
            return;
        }

        // Toggle collapsible form
        const toggleBtn = event.target.closest('[data-toggle-form]');
        if (toggleBtn) {
            const formId = toggleBtn.getAttribute('data-toggle-form');
            if (formId) toggleForm(formId);
            return;
        }

        // Edit member button
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

        // Close member modal
        const closeMemberBtn = event.target.closest('.js-close-member-modal');
        if (closeMemberBtn) {
            closeEditMemberModal();
            return;
        }

        // Edit shift button
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

        // Close shift modal
        const closeShiftBtn = event.target.closest('.js-close-shift-modal');
        if (closeShiftBtn) {
            closeEditShiftModal();
            return;
        }

        // Backdrop click on modals
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

    // Confirm delete forms
    document.addEventListener('submit', function (event) {
        const form = event.target.closest('.js-confirm-delete');
        if (!form) return;

        const message = form.getAttribute('data-confirm-message') || 'Bạn có chắc chắn muốn xóa bản ghi này?';
        if (!window.confirm(message)) {
            event.preventDefault();
        }
    });

    // ==========================================
    // 9. PASSWORD VISIBILITY TOGGLE (/login)
    // ==========================================
    const passwordToggleBtn = document.getElementById('passwordToggleBtn');
    const passwordInput = document.getElementById('password');
    if (passwordToggleBtn && passwordInput) {
        passwordToggleBtn.addEventListener('click', function (e) {
            e.preventDefault();

            // Save exact cursor position / selection range before changing type
            let start = null;
            let end = null;
            try {
                start = passwordInput.selectionStart;
                end = passwordInput.selectionEnd;
            } catch (err) {}

            const currentType = passwordInput.getAttribute('type') || 'password';
            const isPassword = currentType === 'password';
            const newType = isPassword ? 'text' : 'password';
            passwordInput.setAttribute('type', newType);

            const iconEl = passwordToggleBtn.querySelector('.password-eye-icon');
            if (iconEl) {
                iconEl.textContent = isPassword ? 'visibility_off' : 'visibility';
            }

            const label = isPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu';
            passwordToggleBtn.setAttribute('aria-label', label);
            passwordToggleBtn.setAttribute('title', label);

            // Restore exact cursor position / selection range
            try {
                passwordInput.focus();
                if (typeof start === 'number' && typeof end === 'number') {
                    passwordInput.setSelectionRange(start, end);
                }
            } catch (err) {}
        });
    }

    // ==========================================
    // 10. SEARCHABLE MEMBER COMBOBOX (/attendance)
    // ==========================================
    const memberComboboxWrapper = document.getElementById('memberComboboxWrapper');
    const memberSearchInput = document.getElementById('memberSearchInput');
    const memberListbox = document.getElementById('memberListbox');
    const memberClearBtn = document.getElementById('memberClearBtn');
    const memberDropdownToggle = document.getElementById('memberDropdownToggle');
    const memberCodeInput = document.getElementById('member_code');
    const memberDataStore = document.getElementById('memberDataStore');

    if (memberComboboxWrapper && memberSearchInput && memberListbox && memberCodeInput && memberDataStore) {
        let membersData = [];
        try {
            const raw = memberDataStore.getAttribute('data-members');
            if (raw) {
                membersData = JSON.parse(decodeURIComponent(raw));
            }
        } catch (err) {
            console.error('Error parsing members dataset:', err);
            membersData = [];
        }

        let filteredMembers = [];
        let activeIndex = -1;
        let isOpen = false;
        let selectedMember = null;
        let isCodeAutoFilled = false;

        function removeVietnameseTones(str) {
            if (!str) return '';
            return str
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/đ/g, 'd')
                .replace(/Đ/g, 'd')
                .toLowerCase()
                .trim();
        }

        function filterMembers(query) {
            const trimmed = (query || '').trim();
            if (!trimmed) {
                return membersData;
            }
            const cleanQuery = removeVietnameseTones(trimmed);
            return membersData.filter(function (m) {
                const codeMatch = (m.code || '').toLowerCase().includes(cleanQuery);
                const nameMatch = removeVietnameseTones(m.name).includes(cleanQuery);
                const deptMatch = removeVietnameseTones(m.dept).includes(cleanQuery);
                return codeMatch || nameMatch || deptMatch;
            });
        }

        function renderListbox() {
            // Clear current listbox safely
            while (memberListbox.firstChild) {
                memberListbox.removeChild(memberListbox.firstChild);
            }

            if (filteredMembers.length === 0) {
                const emptyItem = document.createElement('div');
                emptyItem.className = 'combobox-empty';
                emptyItem.setAttribute('role', 'status');

                const emptyIcon = document.createElement('span');
                emptyIcon.className = 'material-symbols-outlined';
                emptyIcon.setAttribute('aria-hidden', 'true');
                emptyIcon.textContent = 'search_off';

                const emptyText = document.createElement('span');
                emptyText.textContent = 'Không tìm thấy kết quả phù hợp';

                emptyItem.appendChild(emptyIcon);
                emptyItem.appendChild(emptyText);
                memberListbox.appendChild(emptyItem);
                activeIndex = -1;
                memberSearchInput.removeAttribute('aria-activedescendant');
                return;
            }

            filteredMembers.forEach(function (m, idx) {
                const optionEl = document.createElement('div');
                optionEl.className = 'combobox-option';
                optionEl.setAttribute('role', 'option');
                optionEl.setAttribute('id', 'combobox-opt-' + idx);
                optionEl.setAttribute('aria-selected', idx === activeIndex ? 'true' : 'false');
                if (idx === activeIndex) {
                    optionEl.classList.add('is-active');
                }
                if (memberCodeInput.value && memberCodeInput.value.toUpperCase() === (m.code || '').toUpperCase()) {
                    optionEl.classList.add('is-selected');
                }

                const mainRow = document.createElement('div');
                mainRow.className = 'combobox-option-main';

                const codeSpan = document.createElement('span');
                codeSpan.className = 'combobox-option-code';
                codeSpan.textContent = m.code;

                const nameSpan = document.createElement('span');
                nameSpan.className = 'combobox-option-name';
                nameSpan.textContent = m.name;

                mainRow.appendChild(codeSpan);
                mainRow.appendChild(nameSpan);
                optionEl.appendChild(mainRow);

                if (m.dept) {
                    const deptDiv = document.createElement('div');
                    deptDiv.className = 'combobox-option-dept';
                    deptDiv.textContent = m.dept;
                    optionEl.appendChild(deptDiv);
                }

                optionEl.addEventListener('click', function () {
                    selectMember(m);
                });

                memberListbox.appendChild(optionEl);
            });

            updateActiveDescendant();
        }

        function updateActiveDescendant() {
            const options = memberListbox.querySelectorAll('.combobox-option');
            options.forEach(function (opt, idx) {
                if (idx === activeIndex) {
                    opt.classList.add('is-active');
                    opt.setAttribute('aria-selected', 'true');
                    opt.scrollIntoView({ block: 'nearest' });
                    memberSearchInput.setAttribute('aria-activedescendant', opt.getAttribute('id'));
                } else {
                    opt.classList.remove('is-active');
                    opt.setAttribute('aria-selected', 'false');
                }
            });
            if (activeIndex < 0) {
                memberSearchInput.removeAttribute('aria-activedescendant');
            }
        }

        function openDropdown() {
            filteredMembers = filterMembers(memberSearchInput.value);
            activeIndex = -1;
            renderListbox();
            memberListbox.style.display = 'block';
            memberComboboxWrapper.classList.add('is-open');
            memberSearchInput.setAttribute('aria-expanded', 'true');
            isOpen = true;
            updateClearBtn();
        }

        function closeDropdown() {
            memberListbox.style.display = 'none';
            memberComboboxWrapper.classList.remove('is-open');
            memberSearchInput.setAttribute('aria-expanded', 'false');
            memberSearchInput.removeAttribute('aria-activedescendant');
            activeIndex = -1;
            isOpen = false;
        }

        function selectMember(member) {
            selectedMember = member;
            isCodeAutoFilled = true;
            memberCodeInput.value = member.code;
            memberSearchInput.value = member.code + ' - ' + member.name;
            updateClearBtn();
            closeDropdown();
            try {
                memberCodeInput.dispatchEvent(new Event('change', { bubbles: true }));
            } catch (e) {}
        }

        function updateClearBtn() {
            if (memberClearBtn) {
                if (memberSearchInput.value.length > 0) {
                    memberClearBtn.style.display = 'inline-flex';
                } else {
                    memberClearBtn.style.display = 'none';
                }
            }
        }

        // Event listeners for memberSearchInput
        memberSearchInput.addEventListener('focus', function () {
            openDropdown();
        });
        memberSearchInput.addEventListener('click', function () {
            openDropdown();
        });

        memberSearchInput.addEventListener('input', function () {
            // When user edits search input:
            // Only clear memberCodeInput if it was auto-filled from combobox.
            // If the code was entered manually by the user, preserve it!
            if (isCodeAutoFilled) {
                memberCodeInput.value = '';
                try {
                    memberCodeInput.dispatchEvent(new Event('change', { bubbles: true }));
                } catch (e) {}
                isCodeAutoFilled = false;
            }
            selectedMember = null;

            filteredMembers = filterMembers(memberSearchInput.value);
            activeIndex = -1;
            renderListbox();
            if (!isOpen) {
                memberListbox.style.display = 'block';
                memberComboboxWrapper.classList.add('is-open');
                memberSearchInput.setAttribute('aria-expanded', 'true');
                isOpen = true;
            }
            updateClearBtn();
        });

        memberSearchInput.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (!isOpen) {
                    openDropdown();
                    return;
                }
                if (filteredMembers.length > 0) {
                    activeIndex = (activeIndex + 1) % filteredMembers.length;
                    updateActiveDescendant();
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (!isOpen) {
                    openDropdown();
                    return;
                }
                if (filteredMembers.length > 0) {
                    activeIndex = (activeIndex - 1 + filteredMembers.length) % filteredMembers.length;
                    updateActiveDescendant();
                }
            } else if (e.key === 'Enter') {
                if (isOpen && activeIndex >= 0 && activeIndex < filteredMembers.length) {
                    e.preventDefault();
                    selectMember(filteredMembers[activeIndex]);
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                closeDropdown();
            } else if (e.key === 'Tab') {
                closeDropdown();
            }
        });

        // Dropdown toggle button click
        if (memberDropdownToggle) {
            memberDropdownToggle.addEventListener('click', function (e) {
                e.preventDefault();
                if (isOpen) {
                    closeDropdown();
                } else {
                    memberSearchInput.focus();
                    openDropdown();
                }
            });
        }

        // Clear button click
        if (memberClearBtn) {
            memberClearBtn.addEventListener('click', function (e) {
                e.preventDefault();
                memberSearchInput.value = '';
                updateClearBtn();

                // Only clear memberCodeInput if it was auto-filled from combobox.
                // If the code was entered manually by the user, preserve it!
                if (isCodeAutoFilled) {
                    memberCodeInput.value = '';
                    try {
                        memberCodeInput.dispatchEvent(new Event('change', { bubbles: true }));
                    } catch (err) {}
                    isCodeAutoFilled = false;
                }
                selectedMember = null;

                filteredMembers = filterMembers('');
                activeIndex = -1;
                renderListbox();
                memberSearchInput.focus();
                if (!isOpen) {
                    openDropdown();
                }
            });
        }

        // Direct manual input/edit on memberCodeInput
        memberCodeInput.addEventListener('input', function () {
            isCodeAutoFilled = false;
            const entered = (memberCodeInput.value || '').trim().toUpperCase();

            if (!entered) {
                if (selectedMember) {
                    selectedMember = null;
                    memberSearchInput.value = '';
                    updateClearBtn();
                }
                return;
            }

            // Check if entered code matches a member in dataset
            const match = membersData.find(function (m) {
                return (m.code || '').toUpperCase() === entered;
            });

            if (match) {
                selectedMember = match;
                memberSearchInput.value = match.code + ' - ' + match.name;
                updateClearBtn();
            } else {
                // Manually entered code differs from the member in search box:
                // Clear old search label so the two fields never contradict each other
                if (selectedMember || memberSearchInput.value) {
                    selectedMember = null;
                    memberSearchInput.value = '';
                    updateClearBtn();
                }
            }
        });

        // Click outside listener
        document.addEventListener('click', function (e) {
            if (!memberComboboxWrapper.contains(e.target)) {
                closeDropdown();
            }
        });

        // Sync initial state if member_code already has a value (e.g. page reload with value)
        if (memberCodeInput.value) {
            const found = membersData.find(function (m) {
                return (m.code || '').toUpperCase() === memberCodeInput.value.toUpperCase();
            });
            if (found) {
                selectedMember = found;
                isCodeAutoFilled = true;
                memberSearchInput.value = found.code + ' - ' + found.name;
                updateClearBtn();
            }
        }
    }
});

window.addEventListener('pageshow', function (event) {
    if (event.persisted) {
        window.location.reload();
    }
});
