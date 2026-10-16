/* util.js – hàm nhỏ dùng chung cho mọi trang (trước đây chép lại trong từng file). */
window.EF = window.EF || {};
EF.util = (function () {
  'use strict';

  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return ESC[c]; });
  }

  // Bỏ dấu tiếng Việt, dùng cho tìm kiếm
  function noAccent(v) {
    return String(v == null ? '' : v).toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
  }

  // Dữ liệu từ Sheet đôi khi dùng "/n" hoặc "\n" để xuống dòng
  function normalizeText(v) {
    return String(v == null ? '' : v).replace(/\r\n?/g, '\n')
      .replace(/\/n\.?\s*(?=[a-d][.)])/gi, '\n')
      .replace(/\\n|\/n/gi, '\n');
  }

  // Cho phép <b> <i> <u> <sub> <sup> <br> và [[gạch chân]]; mọi thứ khác bị escape
  function formatText(v) {
    return esc(normalizeText(v))
      .replace(/&lt;(\/?)\s*(b|strong|i|em|u|sub|sup)\s*&gt;/gi, '<$1$2>')
      .replace(/&lt;br\s*\/?\s*&gt;/gi, '<br>')
      .replace(/\[\[([\s\S]*?)\]\]/g, '<u>$1</u>')
      .replace(/\n/g, '<br>');
  }

  // Chuẩn hóa đáp án để so sánh: bỏ hoa/thường, dấu câu, khoảng trắng thừa
  function clean(v) {
    return String(v == null ? '' : v).trim().toLowerCase()
      .replace(/[.,'’"]/g, '').replace(/\s+/g, ' ');
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(Number(sec) || 0));
    return pad2(Math.floor(sec / 60)) + ':' + pad2(sec % 60);
  }

  function fmtDur(sec) {
    sec = Math.round(Number(sec) || 0);
    if (!sec) return '—';
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    if (h) return h + 'g ' + m + 'p';
    return m ? m + 'p ' + s + 's' : s + 's';
  }

  function fmtDate(v) {
    var d = new Date(v);
    if (isNaN(d.getTime())) return String(v || '');
    return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear() +
      ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function param(name) {
    return new URLSearchParams(location.search).get(name) || '';
  }

  /* localStorage an toàn (chế độ riêng tư có thể ném lỗi) */
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function jsonGet(k) { try { return JSON.parse(lsGet(k) || 'null'); } catch (e) { return null; } }
  function jsonSet(k, o) { return lsSet(k, JSON.stringify(o)); }

  function loadCss(href) {
    return new Promise(function (resolve) {
      var l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = href;
      l.onload = function () { resolve(true); };
      l.onerror = function () { resolve(false); };
      document.head.appendChild(l);
    });
  }

  return {
    esc: esc, noAccent: noAccent, normalizeText: normalizeText, formatText: formatText,
    clean: clean, fmtTime: fmtTime, fmtDur: fmtDur, fmtDate: fmtDate, param: param,
    lsGet: lsGet, lsSet: lsSet, lsDel: lsDel, jsonGet: jsonGet, jsonSet: jsonSet, loadCss: loadCss
  };
})();
