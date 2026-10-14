/* Dùng chung quy tắc tải đề, lưu nháp, tính giờ và lưu kết quả cho hai giao diện. */
(function () {
  'use strict';
  const BASE = 'https://script.google.com/macros/s/AKfycbwtDxkcEL5lDNPBt0gxe0P59rb2HZacd9z6CVXbHWYlA17s2w2hRcD7UyRVx7PZ1IJn/exec';
  const params = new URLSearchParams(location.search);
  const id = params.get('id') || '';
  const mode = document.body.dataset.mode === 'ielts' ? 'ielts' : 'school';
  const $ = (name) => document.getElementById(name);
  const draftKey = 'ef_exam_' + mode + '_' + id;
  let exam = null, answers = {}, current = 0, remaining = 0, duration = 0, deadline = 0, timer = null;
  let started = false, submitted = false, selectedSection = '', selectedPart = '';
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const key = (q) => String(q.id);
  const typeOf = (q) => String(q.type || 'mc').toLowerCase().replace(/[\s-]+/g, '_');
  const normalizeText = (value) => String(value == null ? '' : value)
    .replace(/\r\n?/g, '\n')
    // Some Sheet rows put a period after the newline marker before a choice label.
    .replace(/\/n\.?\s*(?=[a-d][.)])/gi, '\n')
    .replace(/\\n|\/n/gi, '\n');
  const formatText = (value) => esc(normalizeText(value))
    .replace(/&lt;(\/?)\s*(b|strong|i|em|u|sub|sup)\s*&gt;/gi, '<$1$2>')
    .replace(/&lt;br\s*\/?\s*&gt;/gi, '<br>')
    .replace(/\[\[([\s\S]*?)\]\]/g, '<u>$1</u>')
    .replace(/\n/g, '<br>');
  const paperText = formatText;
  const clean = (value) => String(value || '').trim().toLowerCase().replace(/[.,'’]/g, '').replace(/\s+/g, ' ');
  const formatTime = (value) => String(Math.floor(value / 60)).padStart(2, '0') + ':' + String(value % 60).padStart(2, '0');
  const sectionName = (q) => String(q.section || 'Phần 1');
  const partName = (q) => String(q.part || '');
  function qNumber(q) { return exam.questions.indexOf(q) + 1; }
  function readDraft() {
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey) || 'null');
      if (saved && saved.answers && Date.now() - Number(saved.savedAt || 0) < 24 * 60 * 60 * 1000) return saved;
    } catch (_) {}
    return null;
  }
  function saveDraft() {
    if (!started || submitted) return;
    try {
      remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      localStorage.setItem(draftKey, JSON.stringify({savedAt:Date.now(), remaining:remaining, answers:answers}));
    } catch (_) {}
  }
  function clearDraft() { try { localStorage.removeItem(draftKey); } catch (_) {} }
  function start() {
    const saved = readDraft();
    duration = Math.max(1, Number(exam.duration) || (mode === 'ielts' ? 60 : 45)) * 60;
    if (saved && confirm('Tìm thấy bài làm dở. Khôi phục đáp án và thời gian còn lại?')) {
      answers = saved.answers || {};
      const elapsed = Math.max(0, (Date.now() - Number(saved.savedAt || Date.now())) / 1000);
      const savedRemaining = Number(saved.remaining);
      remaining = Math.max(0, Math.min(duration, (Number.isFinite(savedRemaining) ? savedRemaining : duration) - elapsed));
    } else {
      answers = {};
      clearDraft();
      remaining = duration;
    }
    deadline = Date.now() + remaining * 1000;
    started = true;
    $('intro').hidden = true;
    $('stage').hidden = false;
    if (mode === 'ielts') renderIelts(); else renderPaper();
    updateClock();
    if (started && !submitted) timer = setInterval(updateClock, 1000);
    window.scrollTo(0, 0);
  }
  function updateClock() {
    if (!started) return;
    remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    $('clock').textContent = formatTime(remaining);
    if (remaining <= 0) { finish(); return; }
    if (remaining % 10 === 0) saveDraft();
  }
  function answerControl(q) {
    const value = answers[key(q)] == null ? '' : String(answers[key(q)]);
    const type = typeOf(q);
    if (['mc','mcq','tfng','ynng'].includes(type)) {
      const options = Array.isArray(q.options) && q.options.length ? q.options : (type === 'tfng' ? ['True','False','Not Given'] : type === 'ynng' ? ['Yes','No','Not Given'] : []);
      return '<div class="choices">' + options.map((option) => {
        const match = String(option).match(/^([A-D])\s*[.)]/i);
        const choice = match ? match[1].toUpperCase() : String(option).trim();
        const label = String(option).replace(/^[A-D]\s*[.)]\s*/i, '');
        return '<label class="choice"><input type="radio" name="answer-'+esc(key(q))+'" value="'+esc(choice)+'" data-answer="'+esc(key(q))+'" '+(value===choice?'checked':'')+'><span>'+formatText(label)+'</span></label>';
      }).join('') + '</div>';
    }
    if (['essay','writing','speaking','long_answer'].includes(type)) {
      return '<textarea class="long-answer" data-answer="'+esc(key(q))+'" placeholder="Nhập câu trả lời…">'+esc(value)+'</textarea><div class="word-count" data-count="'+esc(key(q))+'">'+(value.trim().match(/\S+/g)||[]).length+' từ</div>';
    }
    const placeholders={short:'Nhập từ hoặc cụm từ còn thiếu…',fill:'Nhập từ hoặc cụm từ còn thiếu…',fill_in:'Nhập từ hoặc cụm từ còn thiếu…',fill_blank:'Nhập từ hoặc cụm từ còn thiếu…',fillblank:'Nhập từ hoặc cụm từ còn thiếu…',short_answer:'Nhập câu trả lời ngắn…',rewrite:'Viết lại câu hoàn chỉnh…',rewrite_sentence:'Viết lại câu hoàn chỉnh…',arrange:'Sắp xếp các từ thành câu hoàn chỉnh…',reorder:'Sắp xếp các từ thành câu hoàn chỉnh…',word_order:'Sắp xếp các từ thành câu hoàn chỉnh…',sentence_order:'Sắp xếp các từ thành câu hoàn chỉnh…',complete:'Viết câu hoàn chỉnh…',complete_sentence:'Viết câu hoàn chỉnh…',sentence_completion:'Viết câu hoàn chỉnh…'};
    return '<input class="short-answer" type="text" data-answer="'+esc(key(q))+'" value="'+esc(value)+'" autocomplete="off" placeholder="'+esc(placeholders[type]||'Nhập câu trả lời…')+'">';
  }
  function choiceOptions(q) {
    const type=typeOf(q);
    const options=Array.isArray(q.options)&&q.options.length?q.options:(type==='tfng'?['True','False','Not Given']:type==='ynng'?['Yes','No','Not Given']:[]);
    return options.map((option,index)=>{
      const raw=String(option),match=raw.match(/^([A-D])\s*[.)]/i),value=match?match[1].toUpperCase():raw.trim();
      const label=raw.replace(/^[A-D]\s*[.)]\s*/i,'');
      const marker=match?match[1].toUpperCase():(['tfng','ynng'].includes(type)?value:String.fromCharCode(65+index));
      return {value:value,label:label,marker:marker};
    });
  }
  function paperAnswerControl(q) {
    const type=typeOf(q),choiceTypes=['mc','mcq','tfng','ynng'];
    if(!choiceTypes.includes(type))return answerControl(q);
    return '<div class="answer-bubbles">'+choiceOptions(q).map((option)=>'<label class="answer-bubble" title="'+esc(option.label)+'"><input type="radio" name="answer-'+esc(key(q))+'" value="'+esc(option.value)+'" data-answer="'+esc(key(q))+'" '+(String(answers[key(q)]||'')===option.value?'checked':'')+'><span>'+esc(option.marker)+'</span></label>').join('')+'</div>';
  }
  function displayAnswer(q,value) {
    const raw=String(value||'').trim();
    if(!raw)return 'Chưa trả lời';
    const options=choiceOptions(q);
    return raw.split('|').map((part)=>{
      const answer=part.trim(),match=options.find((option)=>clean(option.value)===clean(answer)||clean(option.marker)===clean(answer)||clean(option.label)===clean(answer));
      return match?match.marker+'. '+match.label:answer;
    }).join(' / ');
  }
  function paperQuestionHtml(q) {
    const id=key(q),type=typeOf(q),choiceTypes=['mc','mcq','tfng','ynng'],isChoice=choiceTypes.includes(type);
    let question=paperText(q.question);
    if(!isChoice&&/_{3,}/.test(String(q.question||'')))question=question.replace(/_{3,}/,'<span class="paper-answer-fill" data-answer-fill="'+esc(id)+'">________</span>');
    const options=isChoice?'<div class="paper-options">'+choiceOptions(q).map((option)=>'<div class="paper-choice" data-paper-choice-q="'+esc(id)+'" data-paper-choice-value="'+esc(option.value)+'"><b>'+esc(option.marker)+'.</b> '+paperText(option.label)+'</div>').join('')+'</div>':'';
    const response=!isChoice&&!/_{3,}/.test(String(q.question||''))?'<div class="paper-write-line" data-answer-line="'+esc(id)+'"></div>':'';
    return '<article class="paper-question" id="question-'+esc(id)+'" data-qcard="'+esc(id)+'"><div class="question-title"><b>Câu '+qNumber(q)+'.</b> <span>'+question+'</span></div>'+options+response+'</article>';
  }
  function paperStimulusHtml(value,section,part) {
    const raw=normalizeText(value).trim(),label=[section,part].join(' ');
    const markers=raw.match(/(?:^|\s)[a-d][.)]\s+(?=(?:[A-Z][A-Za-z'’ -]{1,24}:\s*)?[A-Z])/gi)||[];
    const sentenceOrder=/sentence\s*(?:order|ordering)|reorder|sắp xếp/i.test(label)||(markers.length>=2&&/(?:^|\s)[a-d][.)]\s+[A-Z][A-Za-z'’ -]{1,24}:/.test(raw));
    if(!sentenceOrder&&!/(communication|conversation|dialogue|hội thoại)/i.test(label))return paperText(raw);
    const chunks=raw.split(sentenceOrder?/(?=\s*[a-d][.)]\s+(?=(?:[A-Z][A-Za-z'’ -]{1,24}:\s*)?[A-Z]))/gi:/(?=\s*[-–—]?\s*[A-Z][A-Za-z'’ -]{1,24}:\s+)/g).map((chunk)=>chunk.trim()).filter(Boolean);
    if(chunks.length<2)return paperText(raw);
    return chunks.map((chunk)=>{
      const marker=chunk.match(/^([a-d])[.)]\s*/i);
      if(marker)return '<div class="communication-line"><b>'+esc(marker[1].toLowerCase())+'.</b> '+paperText(chunk.slice(marker[0].length))+'</div>';
      const speaker=chunk.match(/^[-–—]?\s*([A-Z][A-Za-z'’ -]{1,24}:)\s*/);
      if(speaker)return '<div class="communication-line"><b>'+esc(speaker[1])+'</b> '+paperText(chunk.slice(speaker[0].length))+'</div>';
      return '<div class="communication-line">'+paperText(chunk)+'</div>';
    }).join('');
  }
  function mediaHtml(q) {
    if (!q.mediaUrl || !/^https?:\/\//i.test(q.mediaUrl)) return '';
    if (/\.(mp3|m4a|ogg|wav)(?:$|[?#])/i.test(q.mediaUrl)) return '<audio controls preload="metadata" src="'+esc(q.mediaUrl)+'"></audio>';
    if (/\.(png|jpe?g|gif|webp|svg)(?:$|[?#])/i.test(q.mediaUrl)) return '<img class="exam-image" src="'+esc(q.mediaUrl)+'" alt="Hình ảnh trong đề" loading="lazy">';
    if (mode === 'school' && /listening/i.test(String(q.section||''))) {
      const driveId=String(q.mediaUrl).match(/(?:\/d\/|[?&]id=)([-\w]+)/);
      const audioUrl=driveId?'https://drive.google.com/uc?export=download&id='+driveId[1]:q.mediaUrl;
      return '<audio controls preload="metadata" src="'+esc(audioUrl)+'"></audio>';
    }
    return '<a class="resource" href="'+esc(q.mediaUrl)+'" target="_blank" rel="noopener">Mở tài liệu đính kèm ↗</a>';
  }
  function paperMediaHtml(q) {
    const html=mediaHtml(q);
    return /^<img\b/i.test(html)?html:'';
  }
  function answerSideMediaHtml(q,seen) {
    const html=mediaHtml(q);
    if(!/^<audio\b|^<a\b/i.test(html))return '';
    const signature=[sectionName(q),partName(q),String(q.mediaUrl||'')].join('\u0000');
    if(seen.has(signature))return '';
    seen.add(signature);
    return '<div class="answer-media">'+html+'</div>';
  }
  function bindAnswerInput(root) {
    root.oninput = root.onchange = (event) => {
      const input = event.target.closest('[data-answer]');
      if (!input) return;
      answers[input.dataset.answer] = input.value;
      const count = root.querySelector('[data-count="'+CSS.escape(input.dataset.answer)+'"]');
      if (count) count.textContent = (input.value.trim().match(/\S+/g)||[]).length+' từ';
      saveDraft();
      if (mode === 'ielts') renderIeltsNav(); else renderPaperNav();
    };
  }
  function renderPaper() {
    const groups = [];
    exam.questions.forEach((q) => {
      const signature = [sectionName(q),partName(q),String(q.stimulus||'')].join('\u0000');
      let group = groups[groups.length - 1];
      if (!group || group.signature !== signature) {
        group = {signature:signature,section:sectionName(q),part:partName(q),stimulus:String(q.stimulus||''),items:[]};
        groups.push(group);
      }
      group.items.push(q);
    });
    $('paper-title').textContent = exam.title;
    $('paper-info').innerHTML = '<span>'+esc(exam.group)+'</span><span>Thời gian làm bài: '+(exam.duration||45)+' phút</span><span>Mã đề: '+esc(exam.id)+'</span><span>Số câu: '+exam.questions.length+'</span>';
    $('paper-body').innerHTML = groups.map((g) => {
      const sharedMedia = g.items.length > 1 && g.items[0].mediaUrl && g.items.every((q) => q.mediaUrl === g.items[0].mediaUrl);
      const sharedMediaHtml = sharedMedia ? paperMediaHtml(g.items[0]) : '';
      return '<section class="paper-part"><h3>'+paperText(g.section)+(g.part?' <span>· '+paperText(g.part)+'</span>':'')+'</h3>'+(g.stimulus?'<div class="paper-stimulus">'+paperStimulusHtml(g.stimulus,g.section,g.part)+'</div>':'')+sharedMediaHtml+g.items.map((q)=>paperQuestionHtml(q)+(!sharedMedia?paperMediaHtml(q):'')).join('')+'</section>';
    }).join('');
    const seenMedia=new Set();
    $('answer-sheet-items').innerHTML=exam.questions.map((q)=>'<article class="answer-card">'+answerSideMediaHtml(q,seenMedia)+'<div class="answer-card-head"><span>Câu '+qNumber(q)+'</span><span class="answer-card-status" data-answer-status="'+esc(key(q))+'">'+(String(answers[key(q)]||'').trim()?'Đã điền':'Chưa điền')+'</span></div>'+paperAnswerControl(q)+'</article>').join('');
    bindAnswerInput($('answer-sheet-items'));
    renderPaperNav();
    $('submit').onclick = () => askFinish();
  }
  function renderPaperNav() {
    refreshPaperMirror();
    exam.questions.forEach((q)=>{
      const status=document.querySelector('[data-answer-status="'+CSS.escape(key(q))+'"]');
      if(status)status.textContent=String(answers[key(q)]||'').trim()?'Đã điền':'Chưa điền';
    });
    const nav=$('paper-nav');
    if(nav){
      nav.innerHTML = exam.questions.map((q,i)=>'<button type="button" class="paper-nav-item '+(String(answers[key(q)]||'').trim()?'done':'')+'" data-jump="'+esc(key(q))+'" aria-label="Đến câu '+(i+1)+'">'+(i+1)+'</button>').join('');
      nav.onclick = (event) => {
        const button=event.target.closest('[data-jump]');if(!button)return;
        const target=document.getElementById('question-'+button.dataset.jump);if(target)target.scrollIntoView({behavior:'smooth',block:'center'});
      };
    }
    const answered=exam.questions.filter(q=>String(answers[key(q)]||'').trim()).length;
    if($('answered'))$('answered').textContent=answered+' / '+exam.questions.length+' câu đã trả lời';
  }
  function refreshPaperMirror() {
    if(mode!=='school'||!exam)return;
    exam.questions.forEach((q)=>{
      const id=key(q),value=String(answers[id]||'');
      document.querySelectorAll('[data-paper-choice-q="'+CSS.escape(id)+'"]').forEach((option)=>option.classList.toggle('selected',option.dataset.paperChoiceValue===value));
      const fill=document.querySelector('[data-answer-fill="'+CSS.escape(id)+'"]');
      if(fill)fill.textContent=value||'________';
      const line=document.querySelector('[data-answer-line="'+CSS.escape(id)+'"]');
      if(line)line.textContent=value;
    });
  }
  function renderIelts() {
    const sections=[...new Set(exam.questions.map(sectionName))];
    if (!selectedSection || !sections.includes(selectedSection)) selectedSection=sections[0]||'';
    const currentQ=exam.questions[current];
    if (!currentQ || sectionName(currentQ)!==selectedSection) current=exam.questions.findIndex(q=>sectionName(q)===selectedSection);
    const q=exam.questions[current];
    const parts=[...new Set(exam.questions.filter(x=>sectionName(x)===selectedSection).map(partName).filter(Boolean))];
    if (!selectedPart || !parts.includes(selectedPart)) selectedPart=parts[0]||'';
    $('section-tabs').innerHTML=sections.map(s=>'<button type="button" class="section-tab '+(s===selectedSection?'active':'')+'" data-section="'+esc(s)+'">'+esc(s)+'</button>').join('');
    $('section-tabs').onclick=(event)=>{const b=event.target.closest('[data-section]');if(!b)return;selectedSection=b.dataset.section;selectedPart='';current=exam.questions.findIndex(x=>sectionName(x)===selectedSection);renderIelts()};
    $('part-tabs').innerHTML=parts.map(p=>'<button type="button" class="part-tab '+(p===selectedPart?'active':'')+'" data-part="'+esc(p)+'">'+esc(p)+'</button>').join('');
    $('part-tabs').onclick=(event)=>{const b=event.target.closest('[data-part]');if(!b)return;selectedPart=b.dataset.part;current=exam.questions.findIndex(x=>sectionName(x)===selectedSection&&partName(x)===selectedPart);renderIelts()};
    $('stimulus-title').textContent=selectedSection+(q&&q.part?' · '+q.part:'');
    $('stimulus-content').innerHTML=(q&&q.stimulus?'<div class="passage">'+formatText(q.stimulus)+'</div>':'<p class="empty-stimulus">Đề bài hoặc đoạn văn sẽ hiển thị ở đây.</p>')+(q?mediaHtml(q):'');
    $('question-content').innerHTML=q?'<div class="q-kicker">Question '+(current+1)+' of '+exam.questions.length+'</div><h2>'+formatText(q.question)+'</h2>'+answerControl(q):'';
    bindAnswerInput($('question-content'));
    $('prev').disabled=current<=0;$('next').disabled=current>=exam.questions.length-1;
    $('prev').onclick=()=>{if(current>0){current--;selectedSection=sectionName(exam.questions[current]);selectedPart=partName(exam.questions[current]);renderIelts()}};
    $('next').onclick=()=>{if(current<exam.questions.length-1){current++;selectedSection=sectionName(exam.questions[current]);selectedPart=partName(exam.questions[current]);renderIelts()}};
    $('submit').onclick=()=>askFinish();
    renderIeltsNav();
  }
  function renderIeltsNav() {
    if (!exam) return;
    $('question-nav').innerHTML=exam.questions.map((q,i)=>'<button type="button" class="question-nav-item '+(i===current?'current ':'')+(String(answers[key(q)]||'').trim()?'answered':'')+'" data-index="'+i+'" title="'+esc(sectionName(q)+' '+partName(q))+'">'+(i+1)+'</button>').join('');
    $('question-nav').onclick=(event)=>{const b=event.target.closest('[data-index]');if(!b)return;current=Number(b.dataset.index);selectedSection=sectionName(exam.questions[current]);selectedPart=partName(exam.questions[current]);renderIelts()};
    const answered=exam.questions.filter(q=>String(answers[key(q)]||'').trim()).length;
    $('progress').textContent=answered+' / '+exam.questions.length+' câu đã trả lời';
  }
  function isCorrect(q) {
    const answer=answers[key(q)]==null?'':String(answers[key(q)]);
    if (!String(q.correctAnswer||'').trim()) return null;
    const accepted=String(q.correctAnswer).split('|').map(clean);
    return accepted.includes(clean(answer));
  }
  function askFinish() {
    const unanswered=exam.questions.filter(q=>!String(answers[key(q)]||'').trim()).length;
    if (confirm(unanswered?'Còn '+unanswered+' câu chưa trả lời. Bạn vẫn muốn nộp bài?':'Bạn muốn nộp bài và xem kết quả?')) finish();
  }
  function finish() {
    if (!started || submitted) return;
    remaining=Math.max(0,Math.ceil((deadline-Date.now())/1000));
    started=false;submitted=true;clearInterval(timer);clearDraft();$('clock').textContent=formatTime(remaining);
    document.querySelectorAll('#stage input,#stage textarea,#stage button').forEach(el=>{if(el.id!=='submit'&&el.id!=='prev'&&el.id!=='next')el.disabled=true});
    if($('submit'))$('submit').disabled=true;
    if($('prev'))$('prev').disabled=true;
    if($('next'))$('next').disabled=true;
    let score=0,total=0;const wrong=[],unkeyedCount=exam.questions.filter(q=>!String(q.correctAnswer||'').trim()).length;
    exam.questions.forEach(q=>{const result=isCorrect(q);if(result===null)return;total++;if(result)score++;else wrong.push(q)});
    const answerKey=exam.questions.filter(q=>String(q.correctAnswer||'').trim());
    const review=answerKey.length?'<details class="answer-review" open><summary>Đáp án và giải thích</summary>'+answerKey.map(q=>'<article class="review-item"><b>Câu '+qNumber(q)+': '+formatText(q.question)+'</b><p>Đáp án đúng: '+formatText(displayAnswer(q,q.correctAnswer))+'</p><p>Đáp án của bạn: '+esc(displayAnswer(q,answers[key(q)]))+'</p>'+(q.explanation?'<p class="explanation">'+formatText(q.explanation)+'</p>':'')+'</article>').join('')+'</details>':'';
    $('result').hidden=false;
    const manualCount=exam.questions.filter(q=>['essay','writing','speaking','long_answer'].includes(typeOf(q))&&!String(q.correctAnswer||'').trim()).length;
    $('result').innerHTML='<h2>Kết quả làm bài</h2><p class="result-score">'+(total?'Đúng '+score+'/'+total+' câu chấm tự động ('+Math.round(score/total*100)+'%)':'Đề này không có câu chấm tự động.')+'</p>'+(unkeyedCount?'<p>'+unkeyedCount+' câu chưa có đáp án chuẩn nên không được tính vào điểm tự động.</p>':'')+(manualCount?'<p>'+manualCount+' câu viết hoặc câu tự luận đang chờ giáo viên chấm.'+(mode==='ielts'?' Hệ thống không tự quy đổi phần này thành band IELTS.':'')+'</p>':'')+review+'<div id="save-state"></div>';
    $('result').scrollIntoView({behavior:'smooth',block:'start'});
    let token='';try{token=localStorage.getItem('ef_token')||''}catch(_){}
    if(!token){$('save-state').innerHTML='Bạn chưa đăng nhập nên kết quả không được lưu. <a href="exercises.html">Đăng nhập Google ›</a>';return}
    const weak=[...new Set(wrong.map(q=>q.topic).filter(Boolean))].join(',');
    fetch(BASE,{method:'POST',body:JSON.stringify({action:'examSave',token:token,id:exam.id,score:score,total:total,wrong:wrong.map(key).join(','),weak:weak,manualPending:manualCount>0,dur:Math.max(0,duration-remaining),ans:answers})})
      .then(r=>r.json()).then(result=>{$('save-state').innerHTML=result&&result.success?'<p class="saved">✓ '+(result.pending?'Đã lưu lượt làm; phần tự luận đang chờ chấm.':'Đã lưu vào lịch sử.')+' <a href="history.html">Xem lịch sử ›</a></p>':'<p>'+esc(result&&result.message||'Không lưu được kết quả.')+'</p>'})
      .catch(()=>$('save-state').textContent='Không kết nối được máy chủ để lưu kết quả.');
  }
  function load() {
    if (!id) {
      $('intro-title').textContent='Thiếu mã đề';
      $('intro-desc').textContent='Đường dẫn chưa có mã đề. Hãy quay lại danh sách và chọn một đề.';
      $('begin').hidden=true;
      return;
    }
    $('intro-title').textContent='Đang tải đề…';
    $('intro-desc').textContent='';
    $('begin').disabled=true;
    fetch(BASE+'?api=exam&id='+encodeURIComponent(id)).then(r=>r.json()).then(result=>{
      if(!result||!result.success)throw new Error(result&&result.message||'Không tải được đề.');
      exam=result.exam;
      if(!exam||!Array.isArray(exam.questions)||!exam.questions.length)throw new Error('Đề chưa có câu hỏi hoặc dữ liệu chưa đúng định dạng.');
      document.title=exam.title+' – EnglishFull';$('topTitle').textContent=exam.title;
      $('intro-title').textContent=exam.title;$('intro-desc').textContent=exam.desc||'';
      $('intro-meta').innerHTML='<span>'+esc(exam.group)+'</span><span>'+ (exam.duration||(mode==='ielts'?60:45)) +' phút</span><span>'+exam.questions.length+' câu / nhiệm vụ</span>';
      $('begin').disabled=false;
      $('begin').onclick=start;
    }).catch(error=>{$('intro-title').textContent='Không tải được đề';$('intro-desc').textContent=error.message;$('begin').hidden=true});
  }
  window.addEventListener('pagehide',saveDraft);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)saveDraft()});
  load();
})();
