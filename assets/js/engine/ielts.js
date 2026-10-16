/* ielts.js – renderer "ielts": giao diện thi trên máy
   (tab kỹ năng, tab Part, đề bên trái – câu hỏi bên phải, bảng số câu). */
(function () {
  'use strict';
  var U = EF.util, esc = U.esc, ft = U.formatText, ui = EF.ui;
  var $ = function (id) { return document.getElementById(id); };

  var TEMPLATE =
    '<header class="exam-header"><div class="exam-header-inner">' +
    '<a class="brand" href="ielts.html">IELTS Practice</a>' +
    '<strong id="topTitle" class="exam-name"></strong><span id="clock" class="timer">--:--</span></div></header>' +
    '<main class="wrap">' +
    '<section id="intro" class="intro"><div class="pane-label">Computer-based practice</div>' +
    '<h1 id="intro-title"></h1><p id="intro-desc" class="muted"></p><div id="intro-meta" class="meta"></div>' +
    '<p class="muted">Màn hình làm bài chia khu vực đề/nghe và câu trả lời, có chọn phần thi, bảng điều hướng và đồng hồ. Thời gian chạy liên tục sau khi bắt đầu.</p>' +
    '<button class="button" id="begin">Start test</button></section>' +
    '<section id="stage" hidden><nav id="section-tabs" class="section-tabs" aria-label="Kỹ năng"></nav>' +
    '<nav id="part-tabs" class="part-tabs" aria-label="Part"></nav>' +
    '<div class="columns"><section class="pane" aria-label="Passage or audio"><div class="pane-label" id="stimulus-title"></div><div id="stimulus-content"></div></section>' +
    '<section class="pane question-pane" id="question-content" aria-live="polite"></section></div>' +
    '<div class="exam-controls"><button class="button" id="prev">← Previous</button><span id="progress" class="muted"></span>' +
    '<button class="button" id="next">Next →</button><button class="button" id="submit">Submit test</button></div>' +
    '<div class="question-palette"><span class="palette-label">Questions:</span><div id="question-nav" style="display:flex;gap:7px"></div>' +
    '<span class="save-line" id="save-line">Draft saved in this browser</span></div>' +
    '<section id="result" class="result" hidden></section></section></main>';

  var sectionOf = function (q) { return String(q.section || 'Phần 1'); };
  var partOf = function (q) { return String(q.part || ''); };

  EF.engine.register('ielts', {
    css: 'assets/css/ielts.css',

    mount: function (S, root) {
      // IELTS dùng header riêng kiểu phòng thi, không dùng header chung
      $('ef-header').innerHTML = '';
      $('ef-footer').innerHTML = '';
      root.innerHTML = TEMPLATE;

      var current = 0, section = '', part = '';

      $('topTitle').textContent = S.title;
      $('intro-title').textContent = S.title;
      $('intro-desc').textContent = S.desc;
      $('intro-meta').innerHTML = '<span>' + esc(S.group) + '</span><span>' + (S.duration || 60) +
        ' phút</span><span>' + S.questions.length + ' câu / nhiệm vụ</span>';
      $('begin').onclick = start;

      function start() {
        var saved = S.peekDraft();
        if (saved && confirm('Tìm thấy bài làm dở. Khôi phục đáp án và thời gian còn lại?')) {
          S.applyDraft(saved);
        } else {
          S.clearDraft();
          S.reset();
        }
        $('intro').hidden = true;
        $('stage').hidden = false;
        render();
        S.startTimer({
          onTick: function (t) { $('clock').textContent = U.fmtTime(t); },
          onExpire: finish
        });
        window.scrollTo(0, 0);
      }

      function goTo(index) {
        current = index;
        section = sectionOf(S.questions[current]);
        part = partOf(S.questions[current]);
        render();
      }

      function render() {
        var qs = S.questions;
        var sections = qs.map(sectionOf).filter(function (s, i, a) { return a.indexOf(s) === i; });
        if (!section || sections.indexOf(section) < 0) section = sections[0] || '';

        var cq = qs[current];
        if (!cq || sectionOf(cq) !== section) {
          current = Math.max(0, qs.findIndex(function (q) { return sectionOf(q) === section; }));
        }
        var q = qs[current];

        var parts = qs.filter(function (x) { return sectionOf(x) === section; })
          .map(partOf).filter(function (p, i, a) { return p && a.indexOf(p) === i; });
        if (!part || parts.indexOf(part) < 0) part = parts[0] || '';

        $('section-tabs').innerHTML = sections.map(function (s) {
          return '<button type="button" class="section-tab ' + (s === section ? 'active' : '') + '" data-section="' + esc(s) + '">' + esc(s) + '</button>';
        }).join('');
        $('section-tabs').onclick = function (e) {
          var b = e.target.closest('[data-section]'); if (!b) return;
          section = b.dataset.section; part = '';
          current = qs.findIndex(function (x) { return sectionOf(x) === section; });
          render();
        };

        $('part-tabs').innerHTML = parts.map(function (p) {
          return '<button type="button" class="part-tab ' + (p === part ? 'active' : '') + '" data-part="' + esc(p) + '">' + esc(p) + '</button>';
        }).join('');
        $('part-tabs').onclick = function (e) {
          var b = e.target.closest('[data-part]'); if (!b) return;
          part = b.dataset.part;
          current = qs.findIndex(function (x) { return sectionOf(x) === section && partOf(x) === part; });
          render();
        };

        $('stimulus-title').textContent = section + (q && q.part ? ' · ' + q.part : '');
        $('stimulus-content').innerHTML =
          (q && q.stimulus ? '<div class="passage">' + ft(q.stimulus) + '</div>'
                           : '<p class="empty-stimulus">Đề bài hoặc đoạn văn sẽ hiển thị ở đây.</p>') +
          (q ? ui.mediaHtml(S, q) : '');

        $('question-content').innerHTML = q
          ? '<div class="q-kicker">Question ' + (current + 1) + ' of ' + qs.length + '</div><h2>' + ft(q.question) + '</h2>' + ui.answerControl(S, q)
          : '';
        ui.bindInputs($('question-content'), S, renderNav);

        $('prev').disabled = current <= 0;
        $('next').disabled = current >= qs.length - 1;
        $('prev').onclick = function () { if (current > 0) goTo(current - 1); };
        $('next').onclick = function () { if (current < qs.length - 1) goTo(current + 1); };
        $('submit').onclick = askFinish;
        renderNav();
      }

      function renderNav() {
        $('question-nav').innerHTML = S.questions.map(function (q, i) {
          return '<button type="button" class="question-nav-item ' + (i === current ? 'current ' : '') + (S.answered(q) ? 'answered' : '') +
            '" data-index="' + i + '" title="' + esc(sectionOf(q) + ' ' + partOf(q)) + '">' + (i + 1) + '</button>';
        }).join('');
        $('question-nav').onclick = function (e) {
          var b = e.target.closest('[data-index]'); if (!b) return;
          goTo(Number(b.dataset.index));
        };
        var n = S.questions.filter(function (q) { return S.answered(q); }).length;
        $('progress').textContent = n + ' / ' + S.questions.length + ' câu đã trả lời';
      }

      function askFinish() {
        var left = S.questions.filter(function (q) { return !S.answered(q); }).length;
        var msg = left ? 'Còn ' + left + ' câu chưa trả lời. Bạn vẫn muốn nộp bài?' : 'Bạn muốn nộp bài và xem kết quả?';
        if (confirm(msg)) finish();
      }

      function finish() {
        if (!S.finish()) return;
        $('clock').textContent = U.fmtTime(S.frozenRemaining);
        document.querySelectorAll('#stage input,#stage textarea,#stage button').forEach(function (el) { el.disabled = true; });

        var g = S.grade();
        var result = $('result');
        result.hidden = false;
        result.innerHTML = ui.examResultHtml(S, g) + '<div id="save-state">Đang lưu kết quả…</div>';
        result.scrollIntoView({ behavior: 'smooth', block: 'start' });

        S.submit({ grade: g }).then(function (r) { $('save-state').innerHTML = ui.saveStateHtml(r); });
      }
    }
  });
})();
