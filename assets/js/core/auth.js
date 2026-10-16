/* auth.js – đăng nhập Google + lưu phiên.
   Dùng LẠI 3 khóa localStorage cũ (ef_token, ef_user, ef_mgr) nên các trang
   chưa chuyển sang bản mới vẫn nhận biết người dùng đã đăng nhập. */
window.EF = window.EF || {};
EF.auth = (function () {
  'use strict';
  var U = EF.util;
  var K = { token: 'ef_token', user: 'ef_user', mgr: 'ef_mgr' };

  function token() { return U.lsGet(K.token) || ''; }
  function user() { return U.jsonGet(K.user); }
  function isLoggedIn() { return !!(token() && user()); }
  function isManager() { return isLoggedIn() && U.lsGet(K.mgr) === '1'; }

  function emit(name) { window.dispatchEvent(new CustomEvent(name)); }

  function save(d) {
    U.lsSet(K.token, d.token);
    U.jsonSet(K.user, { name: d.name || '', picture: d.picture || '' });
    U.lsSet(K.mgr, d.manager ? '1' : '0');
    emit('ef:auth-change');
  }

  function clear() {
    U.lsDel(K.token); U.lsDel(K.user); U.lsDel(K.mgr);
    emit('ef:auth-change');
  }

  // Server báo token hết hạn
  function expire() {
    if (!token()) return;
    clear();
    emit('ef:auth-expired');
  }

  function loginWithCredential(credential) {
    return EF.api.post('auth.login', { idToken: credential, token: '' }).then(function (r) {
      if (r && r.ok) save(r);
      return r;
    });
  }

  // Đăng xuất thật: thu hồi token trên server, không chỉ xóa ở máy
  function logout() {
    var t = token();
    clear();
    if (t) EF.api.post('auth.logout', { token: t });
  }

  /* Vẽ nút "Đăng nhập với Google" vào phần tử el; onDone(result) khi xong */
  function renderButton(el, onDone) {
    function init() {
      google.accounts.id.initialize({
        client_id: EF.config.CLIENT_ID,
        callback: function (resp) {
          loginWithCredential(resp.credential).then(function (r) { if (onDone) onDone(r); });
        }
      });
      google.accounts.id.renderButton(el, { theme: 'outline', size: 'large', text: 'signin_with', locale: 'vi' });
    }
    if (window.google && google.accounts && google.accounts.id) return init();
    var s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true; s.defer = true;
    s.onload = init;
    document.head.appendChild(s);
  }

  return {
    token: token, user: user, isLoggedIn: isLoggedIn, isManager: isManager,
    save: save, clear: clear, expire: expire, logout: logout,
    loginWithCredential: loginWithCredential, renderButton: renderButton
  };
})();
