/* engine.js – bộ máy làm bài DÙNG CHUNG cho luyện tập, đề THCS/THPT và IELTS.
   Engine lo: tải đề, chấm điểm, đồng hồ, lưu nháp, nộp bài.
   Renderer (quiz.js / paper.js / ielts.js) chỉ lo HIỂN THỊ.

   Thêm một kiểu làm bài mới:
     EF.engine.register('ten-kind', { css: '...', mount: function (session, root) {...} });
   rồi cho backend trả content.kind = 'ten-kind'. */
window.EF = window.EF || {};
EF.engine = (function () {
  'use strict';
  var U = EF.util;
  var NOTOPIC = 'Chưa phân loại';
  var CHOICE = ['mc', 'mcq', 'tfng', 'ynng'];
  var LONG = ['essay', 'writing', 'speaking', 'long_answer'];
  var renderers = {};
  var current = null;

  /* ================= Session: trạng thái của MỘT lượt làm bài ================= */
  function Session(content) {
    this.id = String(content.id);
    this.kind = content.kind;
    this.title = content.title || content.id;
    this.group = content.group || '';
    this.desc = content.desc || '';
    this.duration = Number(content.duration) || 0;               // phút (0 = không giới hạn/ mặc định)
    this.questions = (content.questions || []).map(function (q, i) {
      q.no = i + 1;
      if (q.id === undefined || q.id === null || String(q.id) === '') q.id = 'n' + q.no;   // tránh trùng khóa
      return q;
    });
    this.byKeyMap = {};
    var self = this;
    this.questions.forEach(function (q) { self.byKeyMap[String(q.id)] = q; });

    this.answers = {};
    this.extra = {};                                             // trạng thái riêng của renderer (vd: cờ đánh dấu)
    this.mode = this.kind === 'practice' ? 'elapsed' : 'countdown';
    this.totalSeconds = Math.max(1, this.duration || (this.kind === 'ielts' ? 60 : 45)) * 60;
    this.remainingBase = this.totalSeconds;
    this.elapsedBase = 0;
    this.started = false;
    this.submitted = false;
    this.autosave = true;
    this.frozenDur = null;
    this.frozenRemaining = 0;
    this.exits = [];
  }
  var P = Session.prototype;

  /* ---- Câu hỏi ---- */
  P.key = function (q) { return String(q.id); };
  P.byKey = function (k) { return this.byKeyMap[String(k)]; };
  P.typeOf = function (q) { return String(q.type || 'mc').toLowerCase().replace(/[\s-]+/g, '_'); };
  P.isChoice = function (q) { return CHOICE.indexOf(this.typeOf(q)) >= 0; };
  P.isLong = function (q) { return LONG.indexOf(this.typeOf(q)) >= 0; };

  P.choiceOptions = function (q) {
    var type = this.typeOf(q);
    var options = Array.isArray(q.options) && q.options.length ? q.options
      : type === 'tfng' ? ['True', 'False', 'Not Given']
      : type === 'ynng' ? ['Yes', 'No', 'Not Given'] : [];
    return options.map(function (option, index) {
      var raw = String(option), m = raw.match(/^([A-Ha-h])\s*[.)]\s*/);
      var value = m ? m[1].toUpperCase() : raw.trim();
      var label = m ? raw.slice(m[0].length) : raw;
      var marker = m ? value : (type === 'tfng' || type === 'ynng' ? value : String.fromCharCode(65 + index));
      return { value: value, label: label, marker: marker };
    });
  };

  /* ---- Đáp án ---- */
  P.get = function (q) {
    var v = this.answers[this.key(q)];
    return v == null ? '' : String(v);
  };
  P.set = function (q, v) {
    this.answers[this.key(q)] = String(v == null ? '' : v);
    this.saveDraft();
  };
  P.answered = function (q) { return this.get(q).trim() !== ''; };

  P.hasKey = function (q) { return String(q.correctAnswer == null ? '' : q.correctAnswer).trim() !== ''; };

  // true / false, hoặc null nếu câu này chưa có đáp án chuẩn (tự luận, đang soạn…)
  P.check = function (q) {
    if (!this.hasKey(q)) return null;
    var ua = U.clean(this.get(q));
    if (!ua) return false;
    return String(q.correctAnswer).split('|').map(U.clean).indexOf(ua) !== -1;
  };

  P.optionIsCorrect = function (q, opt) {
    if (!this.hasKey(q)) return false;
    return String(q.correctAnswer).split('|').map(U.clean).indexOf(U.clean(opt.value)) !== -1;
  };

  P.displayAnswer = function (q, value) {
    var v = String(value == null ? '' : value).trim();
    if (!v) return '(chưa trả lời)';
    if (!this.isChoice(q)) return v;
    var found = this.choiceOptions(q).filter(function (o) { return U.clean(o.value) === U.clean(v); })[0];
    return found ? found.marker + '. ' + found.label : v;
  };

  /* ---- Chấm điểm: list = tập con câu hỏi (mặc định: cả đề) ---- */
  P.grade = function (list) {
    list = list || this.questions;
    var self = this, score = 0, total = 0, unkeyed = 0, manual = 0;
    var wrong = [], results = [], topics = {};

    list.forEach(function (q) {
      var ok = self.check(q);
      results.push({ q: q, ok: ok, ua: self.get(q) });
      if (ok === null) {
        unkeyed++;
        if (self.isLong(q)) manual++;
        return;
      }
      total++;
      var tp = String(q.topic || '').trim() || NOTOPIC;
      var t = topics[tp] || (topics[tp] = { topic: tp, correct: 0, total: 0, wrongNos: [] });
      t.total++;
      if (ok) { score++; t.correct++; } else { wrong.push(q); t.wrongNos.push(q.no); }
    });

    return {
      score: score, total: total, unkeyed: unkeyed, manual: manual,
      wrong: wrong, results: results,
      topics: Object.keys(topics).map(function (k) { return topics[k]; })
    };
  };

  /* ---- Đồng hồ: đếm ngược (đề thi) hoặc đếm lên (luyện tập) ---- */
  P.remaining = function () { return Math.max(0, Math.ceil((this.deadline - Date.now()) / 1000)); };
  P.elapsed = function () { return Math.max(0, Math.floor((Date.now() - this.t0) / 1000)); };

  P.durationUsed = function () {
    if (this.frozenDur != null) return this.frozenDur;
    if (!this.started) return 0;
    return this.mode === 'countdown' ? Math.max(0, this.totalSeconds - this.remaining()) : this.elapsed();
  };

  P.startTimer = function (opts) {
    var self = this;
    opts = opts || {};
    clearInterval(this.timer);
    this.started = true;
    var now = Date.now();
    if (this.mode === 'countdown') this.deadline = now + this.remainingBase * 1000;
    else this.t0 = now - this.elapsedBase * 1000;

    var ticks = 0;
    function tick() {
      var v = self.mode === 'countdown' ? self.remaining() : self.elapsed();
      if (opts.onTick) opts.onTick(v);
      if (++ticks % 10 === 0) self.saveDraft();
      if (self.mode === 'countdown' && v <= 0) {
        clearInterval(self.timer);
        if (opts.onExpire) opts.onExpire();
      }
    }
    tick();
    this.timer = setInterval(tick, 1000);
    if (this.kind !== 'practice' && !this._exitListenerBound) {
    this._exitListenerBound = true;
    var exitHandled = false;

    var handleExit = function () {
      if (!self.started || self.submitted) return;
      if (exitHandled) return;
      exitHandled = true;

      var timeStr = new Date().toLocaleTimeString('vi-VN');
      self.exits.push(timeStr);
      self.saveDraft();

      // Cảnh báo ngay cho học sinh
      alert('⚠️ CẢNH BÁO GIÁM SÁT:\nBạn vừa rời khỏi màn hình làm bài kiểm tra!\nHệ thống đã ghi nhận lần thoát thứ ' + self.exits.length + ' (lúc ' + timeStr + ').');
    };

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        handleExit();
      } else {
        exitHandled = false;
      }
    });

    window.addEventListener('blur', function () {
      handleExit();
    });

    window.addEventListener('focus', function () {
      exitHandled = false;
    });
  }
  };

  // Kết thúc lượt làm: dừng đồng hồ, xóa nháp. Trả false nếu đã kết thúc rồi.
  P.finish = function () {
    if (this.submitted) return false;
    this.frozenDur = this.durationUsed();
    this.frozenRemaining = this.mode === 'countdown' ? this.remaining() : 0;
    clearInterval(this.timer);
    this.submitted = true;
    this.started = false;
    this.clearDraft();
    return true;
  };

  // Mở lại để làm tiếp / làm lại (full = cả đề thì mới lưu nháp)
  P.reopen = function (full) {
    this.submitted = false;
    this.frozenDur = null;
    this.autosave = !!full;
  };

  P.reset = function () {
    this.answers = {};
    this.extra = {};
    this.remainingBase = this.totalSeconds;
    this.elapsedBase = 0;
  };

  /* ---- Lưu nháp trong trình duyệt ---- */
  P.draftKey = function () { return 'ef_draft_' + this.kind + '_' + this.id; };

  P.peekDraft = function () {
    var d = U.jsonGet(this.draftKey());
    var ttl = this.kind === 'practice' ? 30 * 864e5 : 864e5;
    if (d && d.answers && typeof d.answers === 'object' && Date.now() - Number(d.savedAt || 0) < ttl) return d;
    return null;
  };

  P.applyDraft = function (d) {
    this.answers = d.answers || {};
    this.extra = d.extra || {};
    this.exits = Array.isArray(d.exits) ? d.exits : [];
    if (this.mode === 'countdown') {
      var since = Math.max(0, (Date.now() - Number(d.savedAt || Date.now())) / 1000);
      var rem = Number.isFinite(Number(d.remaining)) ? Number(d.remaining) : this.totalSeconds;
      this.remainingBase = Math.max(0, Math.min(this.totalSeconds, rem - since));
    } else {
      this.elapsedBase = Math.max(0, Number(d.elapsed) || 0);
    }
  };

  P.saveDraft = function () {
    if (!this.autosave || this.submitted || !this.started) return;
    var self = this;
    var hasAns = Object.keys(this.answers).some(function (k) { return String(self.answers[k]).trim() !== ''; });
    var hasFlag = !!(this.extra && this.extra.flags && Object.keys(this.extra.flags).length);
    if (!hasAns && !hasFlag) { this.clearDraft(); return; }
    var d = { savedAt: Date.now(), answers: this.answers, extra: this.extra,exits: this.exits,elapsed: this.durationUsed() };
    if (this.mode === 'countdown') d.remaining = this.remaining(); else d.elapsed = this.elapsed();
    U.jsonSet(this.draftKey(), d);
    
  };

  P.clearDraft = function () { U.lsDel(this.draftKey()); };

  /* ---- Nộp bài ---- */
  P.buildPayload = function (g) {
    var self = this, wrongKeys = {}, ans = {};
    g.wrong.forEach(function (q) { wrongKeys[self.key(q)] = 1; });
    // Luyện tập: chỉ lưu câu sai. Đề thi: lưu mọi câu đã trả lời (backend tự rút gọn nếu quá dài).
    (this.kind === 'practice' ? g.wrong : this.questions).forEach(function (q) {
      var k = self.key(q), v = self.get(q);
      if (v.trim() !== '' || wrongKeys[k]) ans[k] = v;
    });
    if (this.kind !== 'practice' && this.exits && this.exits.length > 0) {
    ans._exits = {
      count: this.exits.length,
      logs: this.exits
    };
  }


    var weak = g.topics
      .filter(function (t) { return t.topic !== NOTOPIC && t.correct < t.total; })
      .sort(function (a, b) { return (b.total - b.correct) - (a.total - a.correct); })
      .map(function (t) { return t.topic; }).join(', ');

    return {
      id: this.id, kind: this.kind, title: this.title,
      score: g.score, total: g.total,
      wrong: g.wrong.map(function (q) { return self.key(q); }).join(','),
      weak: weak,
      manualPending: g.manual > 0,
      dur: this.durationUsed(),
      ans: ans
    };
  };

  // Trả về Promise<{ state: 'guest' | 'saved' | 'expired' | 'error', pending?, message? }>
  P.submit = function (opts) {
    opts = opts || {};
    var g = opts.grade || this.grade(opts.list);
    if (!EF.auth.token()) return Promise.resolve({ state: 'guest' });
    return EF.api.post('result.save', this.buildPayload(g)).then(function (r) {
      if (r && r.ok) return { state: 'saved', pending: !!r.pending };
      if (r && r.error === 'auth') return { state: 'expired' };
      return { state: 'error', message: (r && r.message) || 'Lỗi không rõ' };
    });
  };

  /* ================= Đăng ký renderer & khởi động ================= */
  function register(kind, renderer) { renderers[kind] = renderer; }

  function fail(root, title, msg) {
    root.innerHTML = '<div style="max-width:640px;margin:60px auto;padding:0 16px;text-align:center">' +
      '<h2 style="color:#0a2350">' + U.esc(title) + '</h2>' +
      '<p style="color:#5b6b8c">' + U.esc(msg) + '</p>' +
      '<p><a href="exercises.html" style="color:#2563eb">‹ Về trang Bài tập</a> · ' +
      '<a href="school-exams.html" style="color:#2563eb">Đề thi</a> · ' +
      '<a href="ielts.html" style="color:#2563eb">IELTS</a></p></div>';
  }

  function boot() {
    var root = document.getElementById('app');
    var id = U.param('id');
    if (!id) return fail(root, 'Thiếu mã đề', 'Đường dẫn chưa có mã đề. Hãy quay lại danh sách và chọn một đề.');

    EF.api.get('content.get', { id: id }).then(function (r) {
      if (!r || !r.ok) return fail(root, 'Không tải được đề', (r && r.message) || 'Lỗi không rõ');
      var renderer = renderers[r.kind];
      if (!renderer) return fail(root, 'Chưa hỗ trợ loại đề này', 'Loại đề: ' + r.kind);

      var S = new Session(r);
      current = S;
      document.title = S.title + ' – EnglishFull';
      document.body.setAttribute('data-mode', r.kind);
      U.loadCss(renderer.css).then(function () { renderer.mount(S, root); });
    });
  }

  // Lưu nháp khi đóng tab / chuyển tab
  window.addEventListener('pagehide', function () { if (current) current.saveDraft(); });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && current) current.saveDraft();
  });

  return { register: register, boot: boot, Session: Session, NOTOPIC: NOTOPIC };
})();
