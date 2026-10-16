/* paper.js – renderer "school": đề thi THCS/THPT theo bố cục đề giấy
   (đề bên trái, phiếu trả lời bên phải). Logic nằm ở engine.js. */
(function () {
  'use strict';
  var U = EF.util, esc = U.esc, ft = U.formatText, ui = EF.ui;
  var $ = function (id) { return document.getElementById(id); };

  var TEMPLATE =
    '<section class="hero"><div class="hero-in"><span class="badge">Luyện thi THCS &amp; THPT</span>' +
    '<h1>Đề thi tiếng Anh</h1><p>Làm bài theo bố cục đề kiểm tra trên giấy</p></div></section>' +
    '<main class="wrap">' +
    '<section id="intro" class="intro"><h2 id="intro-title"></h2><p id="intro-desc" class="muted"></p>' +
    '<div id="intro-meta" class="intro-meta"></div>' +
    '<p class="muted">Các phần và câu hỏi được xếp liên tục từ trên xuống dưới. Bài làm dở được lưu tạm trên trình duyệt này.</p>' +
    '<button class="button" id="begin">Bắt đầu làm bài</button></section>' +
    '<section id="stage" hidden><div class="exam-layout">' +
    '<article class="paper" aria-label="Bản xem đề thi, chỉ đọc"><header class="paper-head">' +
    '<div class="paper-institution"><div><strong>SỞ / PHÒNG GIÁO DỤC VÀ ĐÀO TẠO</strong><span>........................................................</span></div>' +
    '<div><strong>KỲ THI / KIỂM TRA</strong><span>Môn thi: Tiếng Anh</span></div></div>' +
    '<h2 id="paper-title"></h2><div id="paper-info" class="paper-meta"></div>' +
    '<div class="candidate-line"><span>Họ và tên: .........................................................</span><span>Lớp: ................</span><span>Số báo danh: ....................</span></div>' +
    '<p class="instructions"><b>Hướng dẫn:</b> Đề thi hiển thị bên trái. Chọn hoặc điền đáp án trong phiếu trả lời bên phải; câu trả lời sẽ được phản ánh ngay trên đề. Đáp án đúng và giải thích chỉ xuất hiện sau khi nộp bài.</p></header>' +
    '<div id="paper-body"></div>' +
    '<footer class="paper-end"><p>— HẾT —</p><p>Thí sinh kiểm tra lại bài trước khi nộp.</p></footer></article>' +
    '<aside class="answer-sheet" aria-label="Phiếu trả lời"><h2>Phiếu trả lời</h2>' +
    '<p class="answer-sheet-hint">Chọn hoặc điền câu trả lời tại đây. Lựa chọn được cập nhật trên đề bên trái; đáp án đúng chỉ hiện sau khi nộp.</p>' +
    '<div id="answer-sheet-items" class="answer-sheet-items"></div>' +
    '<div class="submit-row"><span id="answered"></span><button class="button" id="submit">Nộp bài</button></div></aside>' +
    '</div><section id="result" class="result" hidden></section></section></main>';

  /* ---------- Hiển thị đề ---------- */

  // Đoạn hội thoại / sắp xếp câu: tách từng dòng cho dễ đọc
  function stimulusHtml(value, section, part) {
    var raw = U.normalizeText(value).trim(), label = [section, part].join(' ');
    var markers = raw.match(/(?:^|\s)[a-d][.)]\s+(?=(?:[A-Z][A-Za-z'’ -]{1,24}:\s*)?[A-Z])/gi) || [];
    var sentenceOrder = /sentence\s*(?:order|ordering)|reorder|sắp xếp/i.test(label) ||
      (markers.length >= 2 && /(?:^|\s)[a-d][.)]\s+[A-Z][A-Za-z'’ -]{1,24}:/.test(raw));
    if (!sentenceOrder && !/(communication|conversation|dialogue|hội thoại)/i.test(label)) return ft(raw);

    var splitter = sentenceOrder
      ? /(?=\s*[a-d][.)]\s+(?=(?:[A-Z][A-Za-z'’ -]{1,24}:\s*)?[A-Z]))/gi
      : /(?=\s*[-–—]?\s*[A-Z][A-Za-z'’ -]{1,24}:\s+)/g;
    var chunks = raw.split(splitter).map(function (c) { return c.trim(); }).filter(Boolean);
    if (chunks.length < 2) return ft(raw);

    return chunks.map(function (chunk) {
      var marker = chunk.match(/^([a-d])[.)]\s*/i);
      if (marker) return '<div class="communication-line"><b>' + esc(marker[1].toLowerCase()) + '.</b> ' + ft(chunk.slice(marker[0].length)) + '</div>';
      var speaker = chunk.match(/^[-–—]?\s*([A-Z][A-Za-z'’ -]{1,24}:)\s*/);
      if (speaker) return '<div class="communication-line"><b>' + esc(speaker[1]) + '</b> ' + ft(chunk.slice(speaker[0].length)) + '</div>';
      return '<div class="communication-line">' + ft(chunk) + '</div>';
    }).join('');
  }

  function questionHtml(S, q) {
    var id = S.key(q), isChoice = S.isChoice(q);
    var hasBlank = /_{3,}/.test(String(q.question || ''));
    var question = ft(q.question);
    if (!isChoice && hasBlank) {
      question = question.replace(/_{3,}/, '<span class="paper-answer-fill" data-answer-fill="' + esc(id) + '">________</span>');
    }
    var options = isChoice
      ? '<div class="paper-options">' + S.choiceOptions(q).map(function (o) {
          return '<div class="paper-choice" data-paper-choice-q="' + esc(id) + '" data-paper-choice-value="' + esc(o.value) +
            '"><b>' + esc(o.marker) + '.</b> ' + ft(o.label) + '</div>';
        }).join('') + '</div>'
      : '';
    var line = !isChoice && !hasBlank ? '<div class="paper-write-line" data-answer-line="' + esc(id) + '"></div>' : '';
    return '<article class="paper-question" id="question-' + esc(id) + '" data-qcard="' + esc(id) + '">' +
      '<div class="question-title"><b>Câu ' + q.no + '.</b> <span>' + question + '</span></div>' + options + line + '</article>';
  }

  // Phiếu trả lời: trắc nghiệm = 4 bong bóng, còn lại = ô nhập
  function sheetControl(S, q) {
    if (!S.isChoice(q)) return ui.answerControl(S, q);
    var cur = S.get(q), k = esc(S.key(q));
    return '<div class="answer-bubbles">' + S.choiceOptions(q).map(function (o) {
      return '<label class="answer-bubble" title="' + esc(o.label) + '"><input type="radio" name="answer-' + k +
        '" value="' + esc(o.value) + '" data-answer="' + k + '" ' + (cur === o.value ? 'checked' : '') +
        '><span>' + esc(o.marker) + '</span></label>';
    }).join('') + '</div>';
  }

  function sheetMedia(S, q, seen) {
    var html = ui.mediaHtml(S, q);
    if (!/^<audio\b|^<a\b/i.test(html)) return '';
    var sig = [q.section, q.part, q.mediaUrl].join('\u0000');
    if (seen[sig]) return '';
    seen[sig] = 1;
    return '<div class="answer-media">' + html + '</div>';
  }

  function inlineImage(S, q) {
    var html = ui.mediaHtml(S, q);
    return /^<img\b/i.test(html) ? html : '';
  }

  /* ---------- Mount ---------- */
  EF.engine.register('school', {
    css: 'assets/css/paper.css',

    mount: function (S, root) {
      EF.layout.mountHeader($('ef-header'), { active: 'school', clock: true });
      $('ef-footer').innerHTML = '';
      root.innerHTML = TEMPLATE;

      $('intro-title').textContent = S.title;
      $('intro-desc').textContent = S.desc;
      $('intro-meta').innerHTML = '<span>' + esc(S.group) + '</span><span>' + (S.duration || 45) +
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

      function render() {
        // Gom câu hỏi liền nhau có cùng phần / part / đoạn văn
        var groups = [];
        S.questions.forEach(function (q) {
          var section = String(q.section || 'Phần 1'), part = String(q.part || ''), stim = String(q.stimulus || '');
          var sig = [section, part, stim].join('\u0000');
          var g = groups[groups.length - 1];
          if (!g || g.sig !== sig) {
            g = { sig: sig, section: section, part: part, stimulus: stim, items: [] };
            groups.push(g);
          }
          g.items.push(q);
        });

        $('paper-title').textContent = S.title;
        $('paper-info').innerHTML = '<span>' + esc(S.group) + '</span><span>Thời gian làm bài: ' + (S.duration || 45) +
          ' phút</span><span>Mã đề: ' + esc(S.id) + '</span><span>Số câu: ' + S.questions.length + '</span>';

        $('paper-body').innerHTML = groups.map(function (g) {
          var first = g.items[0];
          var shared = g.items.length > 1 && first.mediaUrl && g.items.every(function (q) { return q.mediaUrl === first.mediaUrl; });
          return '<section class="paper-part"><h3>' + ft(g.section) + (g.part ? ' <span>· ' + ft(g.part) + '</span>' : '') + '</h3>' +
            (g.stimulus ? '<div class="paper-stimulus">' + stimulusHtml(g.stimulus, g.section, g.part) + '</div>' : '') +
            (shared ? inlineImage(S, first) : '') +
            g.items.map(function (q) { return questionHtml(S, q) + (!shared ? inlineImage(S, q) : ''); }).join('') +
            '</section>';
        }).join('');

        var seen = {};
        $('answer-sheet-items').innerHTML = S.questions.map(function (q) {
          return '<article class="answer-card">' + sheetMedia(S, q, seen) +
            '<div class="answer-card-head"><span>Câu ' + q.no + '</span><span class="answer-card-status" data-answer-status="' +
            esc(S.key(q)) + '">' + (S.answered(q) ? 'Đã điền' : 'Chưa điền') + '</span></div>' + sheetControl(S, q) + '</article>';
        }).join('');

        ui.bindInputs($('answer-sheet-items'), S, refresh);
        $('submit').onclick = askFinish;
        refresh();
      }

      // Phản chiếu đáp án lên đề + cập nhật trạng thái từng câu
      function refresh() {
        var count = 0;
        S.questions.forEach(function (q) {
          var id = S.key(q), value = S.get(q), sel = CSS.escape(id);
          if (value.trim()) count++;
          document.querySelectorAll('[data-paper-choice-q="' + sel + '"]').forEach(function (el) {
            el.classList.toggle('selected', el.dataset.paperChoiceValue === value);
          });
          var fill = document.querySelector('[data-answer-fill="' + sel + '"]');
          if (fill) fill.textContent = value || '________';
          var line = document.querySelector('[data-answer-line="' + sel + '"]');
          if (line) line.textContent = value;
          var status = document.querySelector('[data-answer-status="' + sel + '"]');
          if (status) status.textContent = value.trim() ? 'Đã điền' : 'Chưa điền';
        });
        $('answered').textContent = count + ' / ' + S.questions.length + ' câu đã trả lời';
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
