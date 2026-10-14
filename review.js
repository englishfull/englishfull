/* EnglishFull – Xem lại các câu sai của một lần làm bài.
   Dùng chung cho history.html (học viên) và admin.html (quản lý).
   Cách gọi: EFReview.open({ base, token, row, testId, title, score, total, when, who }) */
(function () {
  var CSS =
    '.efrv-ov{position:fixed;inset:0;z-index:200;background:rgba(6,23,51,.62);display:flex;align-items:flex-start;justify-content:center;padding:4vh 12px;overflow-y:auto}' +
    '.efrv-box{background:#fff;color:#0b1b3a;width:100%;max-width:780px;border-radius:18px;box-shadow:0 20px 60px rgba(6,23,51,.35);font-family:"Times New Roman",Times,serif;line-height:1.6}' +
    '.efrv-hd{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:18px 22px;border-bottom:1px solid #d9e2f3;position:sticky;top:0;background:#fff;border-radius:18px 18px 0 0;z-index:1}' +
    '.efrv-hd h2{margin:0;font-size:1.25rem;color:#0a2350}' +
    '.efrv-meta{color:#5b6b8c;font-size:.92rem}' +
    '.efrv-x{flex:none;border:0;background:#e4ecfb;color:#0f3170;width:36px;height:36px;border-radius:50%;font-size:1.4rem;line-height:1;cursor:pointer}' +
    '.efrv-x:hover{background:#d3e0f8}' +
    '.efrv-x:focus-visible{outline:3px solid #38bdf8;outline-offset:2px}' +
    '.efrv-body{padding:18px 22px 24px}' +
    '.efrv-state{text-align:center;color:#5b6b8c;padding:30px 10px}' +
    '.efrv-sum{margin:0 0 14px;font-weight:700;color:#0a2350}' +
    '.efrv-q{border:1.5px solid #d9e2f3;border-left:5px solid #dc2626;border-radius:14px;padding:14px 16px;margin-bottom:14px}' +
    '.efrv-qh{display:flex;gap:10px;align-items:flex-start;margin-bottom:8px}' +
    '.efrv-no{flex:none;min-width:34px;height:34px;padding:0 8px;border-radius:99px;background:#0f3170;color:#fff;font-weight:700;display:grid;place-items:center}' +
    '.efrv-qt{font-weight:700;overflow-wrap:anywhere}' +
    '.efrv-topic{display:inline-block;margin-left:8px;padding:1px 10px;border-radius:99px;background:#e4ecfb;color:#0f3170;font-size:.78rem;font-weight:700;vertical-align:middle}' +
    '.efrv-opts{display:grid;gap:6px;margin:8px 0}' +
    '.efrv-o{display:flex;gap:10px;align-items:baseline;padding:7px 12px;border:1.5px solid #d9e2f3;border-radius:10px;background:#fff}' +
    '.efrv-o b{flex:none;width:1.4em}' +
    '.efrv-o em{margin-left:auto;font-style:normal;font-size:.82rem;font-weight:700;white-space:nowrap}' +
    '.efrv-o.ok{border-color:#16a34a;background:#f0fdf4;color:#166534}' +
    '.efrv-o.bad{border-color:#dc2626;background:#fef2f2;color:#b91c1c}' +
    '.efrv-line{margin:6px 0}' +
    '.efrv-line .bad{color:#b91c1c}.efrv-line .ok{color:#166534}' +
    '.efrv-note{color:#5b6b8c;font-size:.9rem;font-style:italic;margin:6px 0}' +
    '.efrv-x2{margin-top:8px;padding:10px 12px;border-radius:10px;background:#f3f7ff;border-left:4px solid #38bdf8}' +
    '@media (max-width:520px){.efrv-hd,.efrv-body{padding-left:14px;padding-right:14px}.efrv-o{flex-wrap:wrap}}';

  var overlay = null, lastFocus = null;

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // Chỉ giữ lại thẻ định dạng cơ bản (đậm, nghiêng, gạch chân...), bỏ mọi thẻ và thuộc tính khác
  function clean(html) {
    var t = document.createElement('template');
    var source = String(html == null ? '' : html).replace(/\r\n?/g, '\n').replace(/\\n|\/n/gi, '\n').replace(/\n/g, '<br>');
    t.innerHTML = source;
    var allowed = { B: 1, I: 1, U: 1, STRONG: 1, EM: 1, BR: 1, SUB: 1, SUP: 1 };
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (ch) {
        if (ch.nodeType === 3) return;
        if (ch.nodeType !== 1) { node.removeChild(ch); return; }
        if (!allowed[ch.tagName]) {
          walk(ch);
          while (ch.firstChild) node.insertBefore(ch.firstChild, ch);
          node.removeChild(ch);
          return;
        }
        while (ch.attributes.length) ch.removeAttribute(ch.attributes[0].name);
        walk(ch);
      });
    })(t.content);
    var d = document.createElement('div');
    d.appendChild(t.content);
    return d.innerHTML;
  }

  function optBody(o) { return String(o).replace(/^[A-Za-z]\s*[.)]\s*/, ''); }
  function parseWrong(s) {
    s = String(s == null ? '' : s).trim();
    if (!s || /^không có/i.test(s)) return [];
    return s.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
  }

  function addCss() {
    if (document.getElementById('efrv-css')) return;
    var st = document.createElement('style'); st.id = 'efrv-css'; st.textContent = CSS;
    document.head.appendChild(st);
  }
  function onKey(e) { if (e.key === 'Escape') close(); }
  function close() {
    if (!overlay) return;
    overlay.remove(); overlay = null;
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function setBody(h) { var b = document.getElementById('efrvBody'); if (b) b.innerHTML = h; }

  function shell(o) {
    addCss(); close();
    lastFocus = document.activeElement;
    var meta = [o.who, o.when, (o.score != null && o.total != null) ? ('Điểm ' + o.score + '/' + o.total) : '']
      .filter(Boolean).map(esc).join(' · ');
    overlay = document.createElement('div');
    overlay.className = 'efrv-ov';
    overlay.innerHTML =
      '<div class="efrv-box" role="dialog" aria-modal="true" aria-labelledby="efrvT">' +
      '<div class="efrv-hd"><div><h2 id="efrvT">' + esc(o.title || 'Bài làm') + '</h2><div class="efrv-meta">' + meta + '</div></div>' +
      '<button type="button" class="efrv-x" aria-label="Đóng">×</button></div>' +
      '<div class="efrv-body" id="efrvBody"><div class="efrv-state">Đang tải các câu sai...</div></div></div>';
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    overlay.querySelector('.efrv-x').onclick = close;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    overlay.querySelector('.efrv-x').focus();
  }

  function renderQuestion(q, ans) {
    var has = Object.prototype.hasOwnProperty.call(ans, String(q.id));
    var ua = has ? String(ans[q.id]) : '';
    var correct = String(q.correctAnswer == null ? '' : q.correctAnswer);
    var h = '<div class="efrv-q"><div class="efrv-qh"><div class="efrv-no">' + q.no + '</div><div class="efrv-qt">' + clean(q.question) +
      (q.topic ? '<span class="efrv-topic">' + esc(q.topic) + '</span>' : '') + '</div></div>';

    if (q.type === 'mc') {
      h += '<div class="efrv-opts">' + (q.options || []).map(function (op) {
        var L = String(op).charAt(0).toUpperCase(), cls = '', tag = '';
        if (L === correct.toUpperCase()) { cls = ' ok'; tag = '✓ Đáp án đúng'; }
        else if (has && ua.toUpperCase() === L) { cls = ' bad'; tag = '✗ Bạn đã chọn'; }
        return '<div class="efrv-o' + cls + '"><b>' + esc(L) + '</b><span>' + clean(optBody(op)) + '</span>' + (tag ? '<em>' + tag + '</em>' : '') + '</div>';
      }).join('') + '</div>';
      if (has && ua.trim() === '') h += '<div class="efrv-line"><span class="bad">Bỏ trống câu này.</span></div>';
    } else {
      if (has) h += '<div class="efrv-line">Đã viết: <b class="bad">' + (ua.trim() ? esc(ua) : '(bỏ trống)') + '</b></div>';
      h += '<div class="efrv-line">Đáp án chuẩn: <b class="ok">' + clean(correct) + '</b></div>';
    }
    if (!has) h += '<div class="efrv-note">Lần làm này chưa lưu lại đáp án đã chọn, chỉ có đáp án đúng.</div>';
    if (q.explanation) h += '<div class="efrv-x2"><b>Phân tích:</b> ' + clean(q.explanation) + '</div>';
    return h + '</div>';
  }

  function render(d, q) {
    if (!d || !d.ok) {
      var m = 'Không tải được chi tiết bài làm.';
      if (d && d.error === 'auth') m = 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại rồi thử lại.';
      else if (d && d.error === 'forbidden') m = 'Bạn không có quyền xem bài làm này.';
      else if (d && d.error === 'stale') m = 'Dữ liệu bài làm này đã thay đổi nên không xem được chi tiết.';
      else if (d && d.error === 'notfound') m = 'Không tìm thấy bài làm này.';
      return setBody('<div class="efrv-state">' + esc(m) + '</div>');
    }
    if (!q || !q.success) {
      return setBody('<div class="efrv-state">Không tải được đề gốc: ' + esc((q && q.message) || 'lỗi không rõ') + '</div>');
    }
    var wrong = parseWrong(d.wrong), ans = d.ans || {};
    if (!wrong.length) return setBody('<div class="efrv-state">Lần làm này không có câu sai. 🎉</div>');

    var map = {};
    (q.data || []).forEach(function (it, i) { it.no = i + 1; map[String(it.id)] = it; });
    var items = [], gone = 0;
    wrong.forEach(function (id) { if (map[id]) items.push(map[id]); else gone++; });
    items.sort(function (a, b) { return a.no - b.no; });

    var h = '<p class="efrv-sum">' + wrong.length + ' câu sai</p>';
    items.forEach(function (it) { h += renderQuestion(it, ans); });
    if (gone) h += '<div class="efrv-note">' + gone + ' câu sai không còn trong ngân hàng câu hỏi (đề đã được chỉnh sửa).</div>';
    setBody(h);
  }

  function open(o) {
    shell(o);
    var detail = fetch(o.base, { method: 'POST', body: JSON.stringify({ action: 'attemptDetail', token: o.token, row: o.row, id: o.testId }) })
      .then(function (r) { return r.json(); });
    var quiz = fetch(o.base + '?api=quiz&id=' + encodeURIComponent(o.testId))
      .then(function (r) { return r.json(); })
      .then(function (q) {
        if (q && q.success) return q;
        return fetch(o.base + '?api=exam&id=' + encodeURIComponent(o.testId)).then(function (r) { return r.json(); }).then(function (x) {
          if (!x || !x.success || !x.exam) return q;
          return { success: true, data: x.exam.questions || [] };
        });
      });
    Promise.all([detail, quiz]).then(function (res) { render(res[0], res[1]); })
      .catch(function () { setBody('<div class="efrv-state">Không tải được dữ liệu. Kiểm tra kết nối rồi thử lại.</div>'); });
  }

  window.EFReview = { open: open, close: close };
})();
