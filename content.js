// Anında Çeviri - content.js v5

let tooltip = null;
let selectionTimer = null;
let lastKey = '';
let isSpeaking = false;

function cleanText(text) {
  const lines = text.split(/[\n\r\t]/).map(l => l.trim()).filter(Boolean);
  const uiPattern = /^(you are here|share|home|menu|search|login|sign in|join|contact|about|resources|bsg|standards|events|cooperation|members|development|news|itu|itu-t|itu-r|homepage)/i;
  const cleaned = lines.filter(line => {
    if (line.length < 15) return false;
    if (uiPattern.test(line)) return false;
    if (line.includes('>')) return false;
    const upper = (line.match(/[A-Z]/g) || []).length;
    const letters = (line.match(/[a-zA-Z]/g) || []).length;
    if (letters > 0 && upper / letters > 0.65 && line.length < 80) return false;
    return true;
  });
  // Özel tırnak karakterlerini düzelt
  return (cleaned.length > 0 ? cleaned : lines)
    .join(' ')
    .replace(/\s+/g, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .trim();
}

function getTooltip() {
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'aninda-ceviri-tooltip';
    document.body.appendChild(tooltip);
  }
  return tooltip;
}

function removeTooltip() {
  stopSpeech();
  if (tooltip) { tooltip.remove(); tooltip = null; }
  lastKey = '';
}

function getSelectionRect() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  return sel.getRangeAt(0).getBoundingClientRect();
}

function positionTooltip(t) {
  const rect = getSelectionRect();
  const tWidth = 360;
  const margin = 8;
  let left, top;
  if (rect) {
    left = rect.left + window.scrollX + (rect.width / 2) - (tWidth / 2);
    top = rect.bottom + window.scrollY + margin;
  } else {
    left = 20; top = 80;
  }
  if (left + tWidth > window.innerWidth + window.scrollX - 10)
    left = window.innerWidth + window.scrollX - tWidth - 10;
  if (left < window.scrollX + 10) left = window.scrollX + 10;
  if (rect && rect.bottom + 160 > window.innerHeight)
    top = rect.top + window.scrollY - 160;
  t.style.left = left + 'px';
  t.style.top = top + 'px';
}

function stopSpeech() {
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  isSpeaking = false;
}

function speak(text) {
  if (!window.speechSynthesis) return;
  stopSpeech();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'tr-TR';
  utter.rate = 2.0;
  const voices = window.speechSynthesis.getVoices();
  const trVoice = voices.find(v => v.lang && v.lang.startsWith('tr'));
  if (trVoice) utter.voice = trVoice;
  utter.onstart = () => { isSpeaking = true; updateSpeakBtn(true); };
  utter.onend   = () => { isSpeaking = false; updateSpeakBtn(false); };
  utter.onerror = () => { isSpeaking = false; updateSpeakBtn(false); };
  window.speechSynthesis.speak(utter);
}

function updateSpeakBtn(speaking) {
  const btn = document.getElementById('aninda-ceviri-ses-btn');
  if (!btn) return;
  btn.innerHTML = speaking ? '⏹ Durdur' : '🔊 Dinle';
  btn.classList.toggle('speaking', speaking);
}

function renderTooltip(translated) {
  const t = getTooltip();
  t.innerHTML = `
    <span class="ceviri-bayrak">🇹🇷 Türkçe</span>
    <span class="ceviri-metin">${translated}</span>
    <div class="ceviri-actions">
      <button id="aninda-ceviri-ses-btn" class="ceviri-btn">🔊 Dinle</button>
    </div>
  `;
  document.getElementById('aninda-ceviri-ses-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    isSpeaking ? stopSpeech() : speak(translated);
    updateSpeakBtn(!isSpeaking);
  });
}

// Yöntem 1: gtx client
async function translateGtx(text) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=tr&dt=t&dt=ld&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('gtx ' + res.status);
  const data = await res.json();
  const lang = data[2] || (data[8] && data[8][0] && data[8][0][0]) || null;
  let result = '';
  if (data[0]) for (const c of data[0]) if (c && c[0]) result += c[0];
  return { text: result.trim(), lang };
}

// Yöntem 2: dict client (fallback, kısa metinler için daha güvenilir)
async function translateDict(text) {
  const url = `https://translate.googleapis.com/translate_a/single?client=dict-chrome-ex&sl=auto&tl=tr&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('dict ' + res.status);
  const data = await res.json();
  let result = '';
  if (data[0]) for (const c of data[0]) if (c && c[0]) result += c[0];
  return { text: result.trim(), lang: data[2] || null };
}

async function translate(text) {
  // Uzun metni parçalara böl (500 karakter limiti)
  if (text.length > 500) {
    const chunks = [];
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    let chunk = '';
    for (const s of sentences) {
      if ((chunk + s).length > 500) {
        if (chunk) chunks.push(chunk.trim());
        chunk = s;
      } else {
        chunk += ' ' + s;
      }
    }
    if (chunk.trim()) chunks.push(chunk.trim());

    let fullResult = '';
    let detectedLang = null;
    for (const c of chunks) {
      try {
        const r = await translateGtx(c);
        fullResult += ' ' + r.text;
        if (!detectedLang) detectedLang = r.lang;
      } catch {
        try {
          const r = await translateDict(c);
          fullResult += ' ' + r.text;
          if (!detectedLang) detectedLang = r.lang;
        } catch { /* devam et */ }
      }
    }
    return { text: fullResult.trim(), lang: detectedLang };
  }

  // Normal uzunluk
  try {
    return await translateGtx(text);
  } catch(e1) {
    try {
      return await translateDict(text);
    } catch(e2) {
      return { text: null, lang: null };
    }
  }
}

async function handleSelection() {
  const sel = window.getSelection();
  const raw = sel ? sel.toString() : '';
  const selectedText = cleanText(raw);

  if (!selectedText || selectedText.length < 4) { removeTooltip(); return; }

  const key = selectedText.slice(0, 80);
  if (key === lastKey) return;
  lastKey = key;

  const t = getTooltip();
  t.innerHTML = `<span class="ceviri-bayrak">🇹🇷 Türkçe</span><span class="ceviri-yukleniyor">Çeviriliyor...</span>`;
  positionTooltip(t);

  const { text: translated, lang } = await translate(selectedText);

  if (lang === 'tr') { removeTooltip(); return; }

  if (!translated) {
    t.innerHTML = `<span class="ceviri-bayrak">⚠️ Çeviri başarısız — metni kısaltmayı dene</span>`;
    return;
  }

  renderTooltip(translated);
  positionTooltip(t);
}

document.addEventListener('mouseup', (e) => {
  if (e.target && e.target.closest && e.target.closest('#aninda-ceviri-tooltip')) return;
  clearTimeout(selectionTimer);
  selectionTimer = setTimeout(() => handleSelection(), 250);
});

document.addEventListener('mousedown', (e) => {
  if (e.target && e.target.closest && e.target.closest('#aninda-ceviri-tooltip')) return;
  clearTimeout(selectionTimer);
  removeTooltip();
  lastKey = '';
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    removeTooltip();
    window.getSelection()?.removeAllRanges();
  }
});

if (window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}
