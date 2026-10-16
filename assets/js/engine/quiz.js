/* quiz.js – renderer "practice": làm bài luyện tập theo chuyên đề
   (đếm giờ lên, đánh dấu câu, bảng câu hỏi, phân tích theo chủ đề, làm lại câu sai).
   Chấm điểm, đồng hồ, lưu nháp, nộp bài: engine.js. File này chỉ lo hiển thị. */
(function () {
  'use strict';
  var U = EF.util, esc = U.esc, ft = U.formatText, NOTOPIC = EF.engine.NOTOPIC;
  var $ = function (id) { return document.getElementById(id); };

  function template(S) {
    return '<section class="hero"><h1 id="title">📚 ' + esc(S.title) + '</h1>' +
      '<p>Câu nào không hiểu, hỏi trong <a href="' + esc(EF.config.ZALO_URL) +
      '" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:underline">nhóm Zalo</a></p></section>' +
      '<main class="wrap"><div class="layout"><section class="main">' +
      '<div class="note" id="note">Bạn chưa đăng nhập nên điểm sẽ <b>không được lưu</b>. <a href="exercises.html">Đăng nhập ở trang Bài tập</a>.</div>' +
      '<div class="progress"><div class="p-row"><span id="pLeft"></span><span id="pMid"></span><span id="pRight"></span></div>' +
      '<div class="track"><div class="fill" id="fill"></div></div></div>' +
      '<div id="result" class="card result"></div>' +
      '<div id="rv" class="card rv"><h3>📊 Kiến thức theo chủ đề</h3><div class="rv-body" id="rvBody"></div></div>' +
      '<div id="quiz"></div><div class="actions" id="actions"></div></section>' +
      '<aside class="palette" id="palette"><div class="pal-head"><h3>📋 Bảng câu hỏi</h3>' +
      '<button class="pal-close" data-act="palette-close" aria-label="Đóng">✕</button></div>' +
      '<div class="timer">⏱ <span id="timer">00:00</span></div>' +
      '<div class="pal-stats" id="palStats"></div><div class="pal-grid" id="palGrid"></div>' +
      '<div class="legend" id="legend"></div><div class="pal-actions" id="palActions"></div></aside></div></main>' +
      '<button class="fab" id="fab" data-act="palette-open">📋 <span id="fabTxt">Bảng câu hỏi</span></button>' +
      '<div class="backdrop" id="backdrop" data-act="palette-close"></div>' +
      '<div class="modal" id="modal"><div class="modal-box"><h4>Nộp bài ngay?</h4><p id="modalText"></p>' +
      '<div class="row"><button class="btn btn-ghost" data-act="modal-close">Làm tiếp</button>' +
      '<button class="btn btn-primary" data-act="submit-force">Vẫn nộp bài</button></div></div></div>';
  }

  EF.engine.register('practice', {
    css: 'assets/css/quiz.css',

    mount: function (S, root) {
      EF.layout.mountHeader($('ef-header'), { active: 'exercises' });
      EF.layout.mountFooter($('ef-footer'));
      root.innerHTML = template(S);
      $('note').style.display = EF.auth.isLoggedIn() ? 'none' : 'block';

      var ALL = S.questions;
      var cur = [], res = [], wrongQs = [], flags = {}, cols4 = true;

      /* ---------- Sự kiện (một chỗ duy nhất, không dùng onclick rải rác) ---------- */
      root.addEventListener('click', function (e) {
        var el = e.target.closest('[data-act]');
        if (!el) return;
        var i = Number(el.dataset.i);
        switch (el.dataset.act) {
          case 'palette-open': togglePalette(true); break;
          case 'palette-close': togglePalette(false); break;
          case 'flag': toggleFlag(i); break;
          case 'jump': jumpTo(i); break;
          case 'jump-unanswered': jumpUnanswered(); break;
          case 'jump-wrong': jumpFirstWrong(); break;
          case 'submit': submitAnswers(false); break;
          case 'submit-force': submitAnswers(true); break;
          case 'modal-close': closeModal(); break;
          case 'retry': loadSet(wrongQs.slice(), false); break;
          case 'restart': loadSet(ALL, false); break;
          case 'filter': setFilter(el.dataset.f); break;
          case 'discard': S.clearDraft(); removeRestored(); loadSet(ALL, false); break;
        }
      });

      /* ---------- Nạp một tập câu hỏi ---------- */
      function loadSet(list, keep) {
        cur = list.slice(); res = []; wrongQs = []; flags = {};
        var full = list.length === ALL.length;
        $('result').style.display = 'none';
        $('rv').style.display = 'none';

        if (!keep) {
          if (full) { S.answers = {}; S.extra = { flags: {} }; }
          else list.forEach(function (q) { S.answers[S.key(q)] = ''; });
          S.elapsedBase = 0;
        } else if (S.extra && S.extra.flags) {
          cur.forEach(function (q, i) { if (S.extra.flags[S.key(q)]) flags[i] = true; });
        }
        S.reopen(full);

        cols4 = cur.every(function (q) {
          if (!S.isChoice(q)) return true;
          var o = S.choiceOptions(q);
          return o.length !== 4 || o.every(function (x) { return x.label.length <= 14; });
        });

        renderQuiz(); renderPalette(); renderActions();
        if (keep) restoreDom();
        refresh();
        S.startTimer({ onTick: function (sec) { $('timer').textContent = $('pMid').textContent = U.fmtTime(sec); } });
        window.scrollTo(0, 0);
      }

      /* ---------- Câu hỏi ---------- */
      function optsClass(opts) {
        var n = opts.length, longest = Math.max.apply(null, opts.map(function (o) { return o.label.length; }).concat(0));
        if (n === 4) return cols4 ? 'c4' : 'c2';
        if (n === 3) return longest <= 20 ? 'c3' : 'c1';
        return n <= 1 ? 'c1' : 'c2';
      }

      function renderQuiz() {
        var box = $('quiz');
        box.innerHTML = '';
        cur.forEach(function (q, i) {
          var body;
          if (S.isChoice(q)) {
            var opts = S.choiceOptions(q);
            body = '<div class="opts ' + optsClass(opts) + '">' + opts.map(function (o) {
              return '<label class="opt" data-value="' + esc(o.value) + '"><input type="radio" name="q' + i + '" value="' + esc(o.value) + '">' +
                '<span class="lt">' + esc(o.marker) + '</span><span>' + ft(o.label) + '</span></label>';
            }).join('') + '</div>';
          } else {
            body = '<input type="text" class="ans" id="in' + i + '" placeholder="Nhập câu trả lời của bạn..." autocomplete="off">';
          }
          var card = document.createElement('div');
          card.className = 'q'; card.id = 'card-' + i;
          card.innerHTML = '<div class="q-head"><div class="q-no">' + q.no + '</div><div class="q-text">' + ft(q.question) + '</div>' +
            '<button class="flag" data-act="flag" data-i="' + i + '" title="Đánh dấu để xem lại">🚩</button></div>' + body + '<div id="fb' + i + '"></div>';
          box.appendChild(card);
        });

        box.oninput = box.onchange = function (e) {
          if (S.submitted) return;
          var t = e.target, card = t.closest('.q');
          if (!card) return;
          var i = Number(card.id.slice(5));
          if (t.type === 'radio') {
            card.querySelectorAll('.opt').forEach(function (o) { o.classList.remove('sel'); });
            t.closest('.opt').classList.add('sel');
          }
          S.set(cur[i], t.value);
          refresh();
        };
      }

      // Đổ đáp án đã khôi phục từ nháp lên giao diện
      function restoreDom() {
        var n = 0;
        cur.forEach(function (q, i) {
          var v = S.get(q);
          if (v !== '') {
            if (S.isChoice(q)) {
              var radios = document.querySelectorAll('input[name="q' + i + '"]');
              for (var j = 0; j < radios.length; j++) {
                if (radios[j].value === v) { radios[j].checked = true; radios[j].closest('.opt').classList.add('sel'); n++; break; }
              }
            } else { var el = $('in' + i); if (el) { el.value = v; n++; } }
          }
          if (flags[i]) $('card-' + i).classList.add('flagged');
        });
        if (n || Object.keys(flags).length) showRestored(n);
      }

      function showRestored(n) {
        removeRestored();
        var b = document.createElement('div');
        b.id = 'restored'; b.className = 'restored';
        b.innerHTML = '<span>Đã khôi phục bài làm dở: <b>' + n + '</b> câu đã trả lời, đã làm ' + U.fmtTime(S.elapsedBase) +
          '. Bài được tự động lưu khi bạn làm.</span><button type="button" data-act="discard">Xóa và làm lại từ đầu</button>';
        var q = $('quiz');
        q.parentNode.insertBefore(b, q);
      }
      function removeRestored() { var b = $('restored'); if (b) b.remove(); }

      /* ---------- Bảng câu hỏi ---------- */
      function renderPalette() {
        var g = $('palGrid');
        g.innerHTML = '';
        cur.forEach(function (q, i) {
          var b = document.createElement('button');
          b.className = 'pb'; b.id = 'pb' + i; b.textContent = q.no; b.title = 'Đến câu ' + q.no;
          b.dataset.act = 'jump'; b.dataset.i = i;
          g.appendChild(b);
        });
        $('legend').innerHTML = S.submitted
          ? '<span><i class="o"></i>Đúng</span><span><i class="b"></i>Sai</span>'
          : '<span><i></i>Chưa làm</span><span><i class="d"></i>Đã làm</span><span><i class="f"></i>Đánh dấu</span>';
      }

      function jumpTo(i) {
        var c = $('card-' + i);
        if (!c) return;
        if (c.style.display === 'none') setFilter('all');
        c.scrollIntoView({ behavior: 'smooth', block: 'center' });
        c.classList.remove('pulse'); void c.offsetWidth; c.classList.add('pulse');
        togglePalette(false);
      }
      function jumpUnanswered() {
        for (var i = 0; i < cur.length; i++) if (!S.answered(cur[i])) return jumpTo(i);
        jumpTo(0);
      }
      function jumpFirstWrong() {
        for (var i = 0; i < res.length; i++) if (!res[i].ok) return jumpTo(i);
      }
      function toggleFlag(i) {
        if (S.submitted) return;
        flags[i] = !flags[i];
        $('card-' + i).classList.toggle('flagged', !!flags[i]);
        var f = {};
        cur.forEach(function (q, j) { if (flags[j]) f[S.key(q)] = 1; });
        S.extra = S.extra || {}; S.extra.flags = f;
        S.saveDraft();
        refresh();
      }
      function togglePalette(open) {
        $('palette').classList.toggle('open', open);
        $('backdrop').classList.toggle('show', open);
      }

      function refresh() {
        var total = cur.length, done = 0, fl = 0, okc = 0;
        cur.forEach(function (q, i) {
          var pb = $('pb' + i);
          if (!pb) return;
          var cls = 'pb';
          if (S.submitted) { cls += res[i].ok ? ' ok' : ' bad'; if (res[i].ok && !res[i].nokey) okc++; done++; }
          else {
            if (S.answered(q)) { cls += ' done'; done++; }
            if (flags[i]) { cls += ' flagged'; fl++; }
          }
          pb.className = cls;
        });
        var pct = total ? Math.round(done / total * 100) : 0;
        $('pLeft').textContent = S.submitted ? 'Đã nộp bài' : 'Đã trả lời ' + done + '/' + total + ' câu';
        $('pRight').textContent = pct + '%';
        $('fill').style.width = pct + '%';
        $('palStats').innerHTML = S.submitted
          ? '<span>✓ Đúng: ' + okc + '</span><span>✗ Sai: ' + wrongQs.length + '</span>'
          : '<span>Đã làm: ' + done + '</span><span>Chưa làm: ' + (total - done) + '</span><span>Đánh dấu: ' + fl + '</span>';
        $('fabTxt').textContent = S.submitted ? 'Bảng câu hỏi' : 'Bảng câu hỏi · ' + done + '/' + total;
        $('palActions').innerHTML = !S.submitted
          ? '<button class="btn btn-ghost btn-sm" data-act="jump-unanswered">Đến câu chưa làm</button><button class="btn btn-primary btn-sm" data-act="submit">Nộp bài ✔</button>'
          : (wrongQs.length ? '<button class="btn btn-ghost btn-sm" data-act="jump-wrong">Đến câu sai đầu tiên</button>' : '');
      }

      function renderActions() {
        var a = $('actions');
        a.style.display = 'flex';
        a.innerHTML = !S.submitted
          ? '<button class="btn btn-primary" data-act="submit">Nộp Bài &amp; Xem Giải Thích ✔</button>'
          : (wrongQs.length ? '<button class="btn btn-warn" data-act="retry">🔁 Làm lại ' + wrongQs.length + ' câu sai</button>' : '') +
            '<button class="btn btn-ghost" data-act="restart">↺ Làm lại từ đầu</button>';
      }

      /* ---------- Nộp bài ---------- */
      function closeModal() { $('modal').classList.remove('show'); }

      function submitAnswers(force) {
        if (S.submitted) return;
        var blank = cur.filter(function (q) { return !S.answered(q); }).length;
        if (blank && !force) {
          $('modalText').innerHTML = 'Bạn còn <b>' + blank + '</b> câu chưa trả lời. Những câu này sẽ được tính là sai.';
          togglePalette(false);
          $('modal').classList.add('show');
          return;
        }
        closeModal();
        doSubmit(blank);
      }

      function doSubmit(blank) {
        S.finish();
        var g = S.grade(cur);
        res = g.results.map(function (r) { return { ok: r.ok !== false, nokey: r.ok === null }; });
        wrongQs = g.wrong;
        $('timer').textContent = $('pMid').textContent = U.fmtTime(S.frozenDur);

        g.results.forEach(function (r, i) { mark(r.q, i, r.ok, r.ua); });
        removeRestored();
        renderResult(g, blank);
        renderPalette(); renderActions(); refresh();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        save(g);
        renderReview(g.topics);
      }

      function save(g) {
        var st = $('saveMsg');
        if (cur.length !== ALL.length) { st.textContent = 'Lượt luyện lại câu sai không được tính vào lịch sử.'; return; }
        S.submit({ grade: g }).then(function (r) {
          if (r.state === 'saved') st.innerHTML = '✓ Điểm đã được lưu. <a href="history.html">Xem lịch sử ›</a>';
          else if (r.state === 'guest') st.textContent = '⚠ Bạn chưa đăng nhập nên điểm không được lưu vào lịch sử.';
          else if (r.state === 'expired') st.innerHTML = '⚠ Phiên đăng nhập đã hết hạn nên chưa lưu được điểm. <a href="exercises.html">Đăng nhập lại ›</a>';
          else st.textContent = '⚠ Chưa lưu được điểm' + (r.message ? ': ' + r.message : '');
        });
      }

      /* ---------- Hiển thị kết quả ---------- */
      function mark(q, i, ok, ua) {
        var card = $('card-' + i);
        card.classList.remove('flagged');
        var good = ok !== false;
        card.classList.add('locked', good ? 'correct' : 'wrong');

        if (S.isChoice(q)) {
          card.querySelectorAll('input').forEach(function (r) { r.disabled = true; });
          card.querySelectorAll('.opt').forEach(function (o) {
            var v = o.getAttribute('data-value');
            if (S.optionIsCorrect(q, { value: v })) o.classList.add('is-correct');
            else if (ua && U.clean(v) === U.clean(ua)) o.classList.add('is-wrong');
          });
        } else {
          $('in' + i).disabled = true;
        }

        var tag = q.topic ? '<span class="fb-topic">' + esc(q.topic) + '</span>' : '';
        var html;
        if (ok === null) {
          html = '<div class="fb ok"><div class="fb-h">Câu này chưa có đáp án chuẩn' + tag + '</div><div class="fb-x">' + ft(q.explanation) + '</div></div>';
        } else if (ok) {
          html = '<div class="fb ok"><div class="fb-h">✓ Chính xác!' + tag + '</div><div class="fb-x"><strong>Phân tích:</strong> ' + ft(q.explanation) + '</div></div>';
        } else {
          var detail = S.isChoice(q)
            ? (ua ? '' : 'Bạn chưa chọn đáp án. ') + 'Đáp án đúng: <strong>' + ft(S.displayAnswer(q, q.correctAnswer)) + '</strong>'
            : 'Bạn viết: <em>' + (ua.trim() ? esc(ua) : '(bỏ trống)') + '</em><br>Đáp án chuẩn: <strong>' + ft(q.correctAnswer) + '</strong>';
          html = '<div class="fb bad"><div class="fb-h">✗ Chưa chính xác' + tag + '</div><div>' + detail + '</div>' +
            '<div class="fb-x"><strong>Phân tích lỗi sai:</strong> ' + ft(q.explanation) + '</div></div>';
        }
        $('fb' + i).innerHTML = html;
      }

      function renderResult(g, blank) {
        var total = g.total, correct = g.score;
        var pct = total ? Math.round(correct / total * 100) : 0, wr = total - correct;
        var color = pct >= 80 ? '#16a34a' : pct >= 50 ? '#f59e0b' : '#dc2626';
        var title = pct === 100 ? '🎉 Xuất sắc! Đúng tất cả!' : pct >= 80 ? '👏 Làm tốt lắm!' : pct >= 50 ? '💪 Khá ổn, cố gắng thêm!' : '📖 Cần ôn lại một chút nhé!';
        var el = $('result');
        el.innerHTML =
          '<div class="ring" style="background:conic-gradient(' + color + ' ' + pct + '%,#e3e9f5 0)"><span>' + pct + '%</span></div>' +
          '<h3>' + title + '</h3>' +
          '<div class="sub">Đúng ' + correct + '/' + total + ' câu · Thời gian ' + U.fmtTime(S.frozenDur) + (blank ? ' · ' + blank + ' câu bỏ trống' : '') + '</div>' +
          '<div class="chips">' +
          '<button class="chip active" id="f-all" data-act="filter" data-f="all">Tất cả (' + cur.length + ')</button>' +
          '<button class="chip" id="f-wrong" data-act="filter" data-f="wrong">Câu sai (' + wr + ')</button>' +
          '<button class="chip" id="f-ok" data-act="filter" data-f="ok">Câu đúng (' + correct + ')</button>' +
          '</div><div class="savemsg" id="saveMsg">Đang lưu điểm...</div>';
        el.style.display = 'block';
      }

      function setFilter(m) {
        cur.forEach(function (q, i) {
          var c = $('card-' + i);
          if (!c || !res[i]) return;
          var ok = res[i].ok;
          c.style.display = (m === 'all' || (m === 'wrong' && !ok) || (m === 'ok' && ok)) ? '' : 'none';
        });
        ['all', 'wrong', 'ok'].forEach(function (k) {
          var b = $('f-' + k);
          if (b) b.classList.toggle('active', k === m);
        });
      }

      function renderReview(topics) {
        var real = topics.filter(function (s) { return s.topic !== NOTOPIC; });
        if (!real.length) { $('rv').style.display = 'none'; return; }
        real.sort(function (a, b) { return a.correct / a.total - b.correct / b.total; });

        var h = '<div class="sec">Mức độ nắm vững theo chủ đề</div>';
        real.forEach(function (s) {
          var p = Math.round(s.correct / s.total * 100), c = p >= 80 ? '#16a34a' : p >= 50 ? '#f59e0b' : '#dc2626';
          h += '<div class="tbar"><div>' + esc(s.topic) + '</div><div class="bar"><b style="width:' + p + '%;background:' + c + '"></b></div><div class="pc">' + s.correct + '/' + s.total + '</div></div>';
        });
        var weak = real.filter(function (s) { return s.correct < s.total; });
        if (weak.length) {
          h += '<div class="sec">🎯 Nên ôn lại</div>';
          weak.forEach(function (s) {
            h += '<div class="weak"><span>' + esc(s.topic) + '</span><div>Sai ' + (s.total - s.correct) + '/' + s.total +
              ' câu (câu ' + s.wrongNos.join(', ') + '). Hãy xem lại phần phân tích ở các câu này.</div></div>';
          });
        } else {
          h += '<div class="weak" style="background:#eef4ff;border-color:#c9d8f5">🎉 Bạn nắm vững tất cả các chủ đề trong bài này!</div>';
        }
        $('rvBody').innerHTML = h;
        $('rv').style.display = 'block';
      }

      /* ---------- Bắt đầu ---------- */
      var saved = S.peekDraft();
      if (saved) S.applyDraft(saved);
      loadSet(ALL, !!saved);
    }
  });
})();
