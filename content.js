// Anında Çeviri - content.js
// Seçimi bırakınca tooltip görünür, seçim kalkınca kaybolur

let tooltip = null;
let selectionTimer = null;
let lastTranslated = '';

function getTooltip() {
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'aninda-ceviri-tooltip';
    document.body.appendChild(tooltip);
  }
  return tooltip;
}

function removeTooltip() {
  if (tooltip) {
    tooltip.remove();
    tooltip = null;
  }
  lastTranslated = '';
}

function getCaretCoords() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0).cloneRange();
  range.collapse(false); // sona git
  const rect = range.getBoundingClientRect();
  return { x: rect.left, y: rect.bottom };
}

function showTooltip(text, x, y) {
  const t = getTooltip();
  t.innerHTML = `<span class="ceviri-bayrak">🇹🇷 Türkçe</span><span class="ceviri-yukleniyor">Çeviriliyor...</span>`;
  positionTooltip(t, x, y);
}

function positionTooltip(t, x, y) {
  const margin = 10;
  let left = x;
  let top = y + margin;

  // Sağ kenar taşma kontrolü
  const maxLeft = window.innerWidth - 380;
  if (left > maxLeft) left = maxLeft;
  if (left < margin) left = margin;

  // Alt kenar taşma kontrolü
  if (top + 80 > window.innerHeight) {
    top = y - 80;
  }

  t.style.left = left + 'px';
  t.style.top = top + 'px';
}

async function translate(text) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=tr&dt=t&q=${encodeURIComponent(text)}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    // Google Translate API formatı: [[["çeviri","orijinal",...],...],...]
    let result = '';
    if (data && data[0]) {
      for (const chunk of data[0]) {
        if (chunk && chunk[0]) result += chunk[0];
      }
    }
    return result.trim() || null;
  } catch (e) {
    return null;
  }
}

document.addEventListener('mouseup', async (e) => {
  // Tooltip üstüne tıklamayı engelle
  if (e.target && e.target.closest && e.target.closest('#aninda-ceviri-tooltip')) return;

  clearTimeout(selectionTimer);

  selectionTimer = setTimeout(async () => {
    const sel = window.getSelection();
    const selectedText = sel ? sel.toString().trim() : '';

    // Çok kısa ya da boşsa gösterme
    if (!selectedText || selectedText.length < 2) {
      removeTooltip();
      return;
    }

    // Aynı metni tekrar çevirme
    if (selectedText === lastTranslated) return;
    lastTranslated = selectedText;

    // Koordinatları al
    const coords = getCaretCoords();
    const x = coords ? coords.x : e.clientX;
    const y = coords ? coords.y : e.clientY;

    showTooltip(selectedText, x, y);

    const translated = await translate(selectedText);
    const t = getTooltip();

    if (!translated || translated.toLowerCase() === selectedText.toLowerCase()) {
      // Zaten Türkçe ya da çeviri yok
      t.innerHTML = `<span class="ceviri-bayrak">🇹🇷 Zaten Türkçe veya çevrilemedi</span>`;
    } else {
      t.innerHTML = `<span class="ceviri-bayrak">🇹🇷 Türkçe</span>${translated}`;
    }
  }, 300); // 300ms bekle (daha hızlı için 150'ye düşürebilirsin)
});

// Seçim kalktığında tooltip'i kaldır
document.addEventListener('mousedown', (e) => {
  if (e.target && e.target.closest && e.target.closest('#aninda-ceviri-tooltip')) return;
  clearTimeout(selectionTimer);
  removeTooltip();
  lastTranslated = '';
});

// Klavyeyle seçim kalkınca da kaldır
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    removeTooltip();
    window.getSelection()?.removeAllRanges();
  }
});

document.addEventListener('selectionchange', () => {
  const sel = window.getSelection();
  if (!sel || sel.toString().trim().length < 2) {
    clearTimeout(selectionTimer);
    // Mouse basılı tutulurken erken silme — sadece selection gerçekten bittiyse sil
    // Bu zaten mousedown ile handle ediliyor
  }
});
