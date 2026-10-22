/**
 * Khởi tạo Theme và Trạng thái Sidebar sớm
 * Thực thi đồng bộ trong <head> để ngăn chặn FOUC (chớp sáng / sai theme ban đầu)
 * Tuân thủ CSP nghiêm ngặt: file JavaScript cùng origin, không dùng inline script
 */
(function () {
    try {
        var savedTheme = localStorage.getItem('attendance_theme');
        var theme = savedTheme;
        if (!theme) {
            theme = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
        }
        document.documentElement.setAttribute('data-theme', theme);

        var savedSidebar = localStorage.getItem('attendance_sidebar');
        if (savedSidebar === 'collapsed') {
            document.documentElement.setAttribute('data-sidebar', 'collapsed');
        } else {
            document.documentElement.setAttribute('data-sidebar', 'expanded');
        }
    } catch (e) {
        document.documentElement.setAttribute('data-theme', 'light');
        document.documentElement.setAttribute('data-sidebar', 'expanded');
    }
})();
