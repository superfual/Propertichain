(() => {
  const english = new URL(location.href).searchParams.get('lang') === 'en';
  const report = () => {
    const status = document.getElementById('status');
    if (status && /Đang tải V2|Loading V2/.test(status.textContent)) {
      status.textContent = english
        ? 'The V2 interface could not finish loading. Reload the page. If this repeats, report this message before signing.'
        : 'Giao diện V2 chưa khởi tạo xong. Tải lại trang. Nếu vẫn gặp lỗi, báo lại thông báo này trước khi ký.';
    }
  };
  window.addEventListener('error', report);
  window.addEventListener('unhandledrejection', report);
  setTimeout(report, 25000);
})();
