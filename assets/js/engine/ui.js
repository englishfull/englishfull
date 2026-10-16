/* ui.js – các mảnh giao diện dùng chung giữa paper.js (THCS/THPT) và ielts.js.
   Chỉ sinh HTML từ Session; không giữ trạng thái riêng. */
window.EF = window.EF || {};
EF.ui = (function () {
  'use strict';
  var U = EF.util, esc = U.esc, ft = U.formatText;

  var FILL = 'Nhập từ hoặc cụm từ còn thiếu…';
  var ORDER = 'Sắp xếp các từ thành câu hoàn chỉnh…';
  var SENT = 'Viết câu hoàn chỉnh…';
  var REWRITE = 'Viết lại câu hoàn chỉnh…';
  var PLACEHOLDERS = {
    short: FILL, fill: FILL, fill_in: FILL, fill_blank: FILL, fillblank: FILL,
    short_answer: 'Nhập câu trả lời ngắn…',
    rewrite: REWRITE, rewrite_sentence: REWRITE,
    arrange: ORDER, reorder: ORDER, word_order: ORDER, sentence_order: ORDER,
    complete: SENT, complete_sentence: SENT, sentence_completion: SENT
  };

  function wordCount(s) { return (String(s).trim().match(/\S+/g) || []).length; }

  /* Ô trả lời: trắc nghiệm (radio) / tự luận (textarea) / điền (input) */
  function answerControl(S, q) {
    var k = S.key(q), value = S.get(q), type = S.typeOf(q);

    if (S.isChoice(q)) {
      return '<div class="choices">' + S.choiceOptions(q).map(function (o) {
        return '<label class="choice"><input type="radio" name="answer-' + esc(k) + '" value="' + esc(o.value) +
          '" data-answer="' + esc(k) + '" ' + (value === o.value ? 'checked' : '') + '><span>' + ft(o.label) + '</span></label>';
      }).join('') + '</div>';
    }
    if (S.isLong(q)) {
      return '<textarea class="long-answer" data-answer="' + esc(k) + '" placeholder="Nhập câu trả lời…">' + esc(value) +
        '</textarea><div class="word-count" data-count="' + esc(k) + '">' + wordCount(value) + ' từ</div>';
    }
    return '<input class="short-answer" type="text" data-answer="' + esc(k) + '" value="' + esc(value) +
      '" autocomplete="off" placeholder="' + esc(PLACEHOLDERS[type] || 'Nhập câu trả lời…') + '">';
  }

  /* Âm thanh / hình ảnh / tài liệu đính kèm của câu hỏi */
  function mediaHtml(S, q) {
    var url = String(q.mediaUrl || '');
    if (!/^https?:\/\//i.test(url)) return '';
    if (/\.(mp3|m4a|ogg|wav)(?:$|[?#])/i.test(url)) return '<audio controls preload="metadata" src="' + esc(url) + '"></audio>';
    if (/\.(png|jpe?g|gif|webp|svg)(?:$|[?#])/i.test(url)) {
      return '<img class="exam-image" src="' + esc(url) + '" alt="Hình ảnh trong đề" loading="lazy">';
    }
    if (S.kind === 'school' && /listening/i.test(String(q.section || ''))) {
      var drive = url.match(/(?:\/d\/|[?&]id=)([-\w]+)/);
      var audio = drive ? 'https://drive.google.com/uc?export=download&id=' + drive[1] : url;
      return '<audio controls preload="metadata" src="' + esc(audio) + '"></audio>';
    }
    return '<a class="resource" href="' + esc(url) + '" target="_blank" rel="noopener">Mở tài liệu đính kèm ↗</a>';
  }

  /* Gắn một lần cho cả vùng: gõ/chọn -> S.set -> onChange */
  function bindInputs(root, S, onChange) {
    root.oninput = root.onchange = function (event) {
      var input = event.target.closest && event.target.closest('[data-answer]');
      if (!input) return;
      var q = S.byKey(input.dataset.answer);
      if (!q) return;
      S.set(q, input.value);
      var count = root.querySelector('[data-count="' + CSS.escape(input.dataset.answer) + '"]');
      if (count) count.textContent = wordCount(input.value) + ' từ';
      if (onChange) onChange(q);
    };
  }

  /* Khối kết quả sau khi nộp (đề thi) */
  function examResultHtml(S, g) {
    var keyed = S.questions.filter(function (q) { return S.hasKey(q); });
    var review = keyed.length
      ? '<details class="answer-review" open><summary>Đáp án và giải thích</summary>' + keyed.map(function (q) {
          return '<article class="review-item"><b>Câu ' + q.no + ': ' + ft(q.question) + '</b>' +
            '<p>Đáp án đúng: ' + ft(S.displayAnswer(q, q.correctAnswer)) + '</p>' +
            '<p>Đáp án của bạn: ' + esc(S.displayAnswer(q, S.get(q))) + '</p>' +
            (q.explanation ? '<p class="explanation">' + ft(q.explanation) + '</p>' : '') + '</article>';
        }).join('') + '</details>'
      : '';

    return '<h2>Kết quả làm bài</h2><p class="result-score">' +
      (g.total ? 'Đúng ' + g.score + '/' + g.total + ' câu chấm tự động (' + Math.round(g.score / g.total * 100) + '%)'
               : 'Đề này không có câu chấm tự động.') + '</p>' +
      (g.unkeyed ? '<p>' + g.unkeyed + ' câu chưa có đáp án chuẩn nên không được tính vào điểm tự động.</p>' : '') +
      (g.manual ? '<p>' + g.manual + ' câu viết hoặc câu tự luận đang chờ giáo viên chấm.' +
        (S.kind === 'ielts' ? ' Hệ thống không tự quy đổi phần này thành band IELTS.' : '') + '</p>' : '') +
      review;
  }

  /* Dòng trạng thái lưu kết quả */
  function saveStateHtml(r) {
    switch (r.state) {
      case 'saved':
        return '<p class="saved">✓ ' + (r.pending ? 'Đã lưu lượt làm; phần tự luận đang chờ chấm.' : 'Đã lưu vào lịch sử.') +
          ' <a href="history.html">Xem lịch sử ›</a></p>';
      case 'guest':
        return 'Bạn chưa đăng nhập nên kết quả không được lưu. <a href="exercises.html">Đăng nhập Google ›</a>';
      case 'expired':
        return '<p>Phiên đăng nhập đã hết hạn nên chưa lưu được kết quả. <a href="exercises.html">Đăng nhập lại ›</a></p>';
      default:
        return '<p>' + esc(r.message || 'Không lưu được kết quả.') + '</p>';
    }
  }

  return {
    answerControl: answerControl, mediaHtml: mediaHtml, bindInputs: bindInputs,
    examResultHtml: examResultHtml, saveStateHtml: saveStateHtml, wordCount: wordCount
  };
})();
