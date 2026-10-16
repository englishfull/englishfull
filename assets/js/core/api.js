/* api.js – MỌI lời gọi backend đi qua đây.
   Luôn trả về { ok, ... } kể cả khi mất mạng, nên nơi gọi không cần try/catch.
   - EF.api.get('catalog.list', { type: 'school' })     -> route công khai
   - EF.api.post('result.save', { ... })                 -> tự gắn token */
window.EF = window.EF || {};
EF.api = (function () {
  'use strict';
  var C = EF.config;

  function timeoutFetch(url, opts) {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, C.API_TIMEOUT_MS);
    opts = opts || {};
    opts.signal = ctrl.signal;
    return fetch(url, opts).finally(function () { clearTimeout(timer); });
  }

  function parse(res) {
    return res.text().then(function (t) {
      try { return JSON.parse(t); }
      catch (e) { return { ok: false, error: 'badjson', message: 'Máy chủ không trả dữ liệu hợp lệ' }; }
    });
  }

  // Token hết hạn: xóa phiên ở máy và báo cho giao diện
  function handle(r) {
    if (r && r.error === 'auth' && EF.auth) EF.auth.expire();
    return r;
  }

  function fail(e) {
    var timeout = e && e.name === 'AbortError';
    return { ok: false, error: 'network', message: timeout ? 'Máy chủ phản hồi quá lâu' : 'Không kết nối được máy chủ' };
  }

  function get(name, params) {
    var q = ['api=' + encodeURIComponent(name)];
    Object.keys(params || {}).forEach(function (k) {
      if (params[k] != null) q.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
    });
    return timeoutFetch(C.BASE + '?' + q.join('&')).then(parse).then(handle).catch(fail);
  }

  // Gửi text/plain để tránh preflight CORS với Apps Script
  function post(action, body) {
    var data = Object.assign({}, body || {}, { action: action });
    if (data.token === undefined && EF.auth) data.token = EF.auth.token();
    return timeoutFetch(C.BASE, { method: 'POST', body: JSON.stringify(data) })
      .then(parse).then(handle).catch(fail);
  }

  return { get: get, post: post };
})();
