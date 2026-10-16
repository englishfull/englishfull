/* layout.js – header + footer viết MỘT lần cho mọi trang.
   Dùng:  EF.layout.mountHeader(document.getElementById('ef-header'), { active: 'exercises' });
          EF.layout.mountFooter(document.getElementById('ef-footer'));
   Thêm mục menu mới: thêm 1 dòng vào NAV. */
window.EF = window.EF || {};
EF.layout = (function () {
  'use strict';
  var esc = EF.util.esc;

  var LOGO = '<svg viewBox="0 0 100 100" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">' +
    '<g fill="none" stroke="#fff" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M18 64V28c7-4 20-1 27 3v36c-7-4-20-7-27-3Z"/>' +
    '<path d="M45 31c7-4 20-7 27-3v22M45 67c7-4 20-7 27-3"/>' +
    '<path d="M30 40h15M30 51h10M28 51l17 0 17-18 16-16M64 17h14v14" stroke-width="7"/></g></svg>';

  // [khóa, đường dẫn, nhãn, điều kiện hiển thị]
  var NAV = [
    ['home', 'index.html', 'Trang chủ', null],
    ['exercises', 'exercises.html', 'Bài tập', null],
    ['school', 'school-exams.html', 'Đề thi', null],
    ['ielts', 'ielts.html', 'IELTS', null],
    ['history', 'history.html', 'Lịch sử', function () { return EF.auth.isLoggedIn(); }],
    ['admin', 'admin.html', 'Quản lý', function () { return EF.auth.isManager(); }]
  ];

  function navHtml(active) {
    return NAV.filter(function (n) { return !n[3] || n[3](); }).map(function (n) {
      var on = n[0] === active ? ' on active' : '';
      return '<a class="' + on.trim() + '" href="' + n[1] + '">' + esc(n[2]) + '</a>';
    }).join('');
  }

  function mountHeader(el, opts) {
    if (!el) return;
    opts = opts || {};
    el.innerHTML =
      '<header class="site-header"><div class="hd-in">' +
      '<a class="logo" href="index.html" aria-label="EnglishFull – về trang chủ">' + LOGO +
      '<span><b>EnglishFull</b><small>Full English is here</small></span></a>' +
      '<nav class="nav" id="ef-nav" aria-label="Điều hướng">' + navHtml(opts.active) + '</nav>' +
      (opts.clock ? '<span class="clock" id="clock">--:--</span>' : '') +
      '</div></header>';
    // Đăng nhập/đăng xuất ở tab khác hoặc token hết hạn: cập nhật menu
    window.addEventListener('ef:auth-change', function () {
      var nav = document.getElementById('ef-nav');
      if (nav) nav.innerHTML = navHtml(opts.active);
    });
  }

  function mountFooter(el) {
    if (!el) return;
    el.innerHTML = '<footer>© EnglishFull – Full English is here · ' +
      '<a href="privacy.html">Quyền riêng tư</a> · <a href="terms.html">Điều khoản</a></footer>';
  }

  return { mountHeader: mountHeader, mountFooter: mountFooter };
})();
