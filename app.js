const el = {
  languageMode: document.getElementById('languageMode'),
  text: document.getElementById('textInput'),
  fontEnWrap: document.getElementById('fontEnWrap'),
  fontJaWrap: document.getElementById('fontJaWrap'),
  fontEn: document.getElementById('fontSelectEn'),
  fontJa: document.getElementById('fontSelectJa'),
  speed: document.getElementById('speedInput'),
  speedValue: document.getElementById('speedValue'),
  textColor: document.getElementById('textColorInput'),
  thickness: document.getElementById('thicknessInput'),
  thicknessValue: document.getElementById('thicknessValue'),
  size: document.getElementById('sizeInput'),
  sizeValue: document.getElementById('sizeValue'),
  bgMode: document.getElementById('bgModeSelect'),
  bgColor: document.getElementById('bgColorInput'),
  bgImageInput: document.getElementById('bgImageInput'),
  solidBgControls: document.getElementById('solidBgControls'),
  imageBgControls: document.getElementById('imageBgControls'),
  previewBtn: document.getElementById('previewBtn'),
  pauseBtn: document.getElementById('pauseBtn'),
  downloadBtn: document.getElementById('downloadBtn'),
  status: document.getElementById('statusText'),
  canvas: document.getElementById('previewCanvas'),
  swatches: [...document.querySelectorAll('.swatch')],
};

const EN_FONTS = [
  { label: 'Caveat', value: "'Caveat', cursive" },
  { label: 'Patrick Hand', value: "'Patrick Hand', cursive" },
  { label: 'Architects Daughter', value: "'Architects Daughter', cursive" },
  { label: 'Gloria Hallelujah', value: "'Gloria Hallelujah', cursive" },
  { label: 'Shadows Into Light', value: "'Shadows Into Light', cursive" },
  { label: 'Handlee', value: "'Handlee', cursive" },
  { label: 'Coming Soon', value: "'Coming Soon', cursive" },
  { label: 'Comic Neue', value: "'Comic Neue', cursive" },
  { label: 'Homemade Apple', value: "'Homemade Apple', cursive" },
];

const JA_FONTS = [
  { label: 'Yomogi', value: "'Yomogi', cursive" },
  { label: 'Kaisei Decol', value: "'Kaisei Decol', serif" },
  { label: 'Klee One', value: "'Klee One', cursive" },
  { label: 'Kosugi Maru', value: "'Kosugi Maru', sans-serif" },
  { label: 'RocknRoll One', value: "'RocknRoll One', sans-serif" },
  { label: 'Mochiy Pop One', value: "'Mochiy Pop One', sans-serif" },
  { label: 'Yuji Syuku', value: "'Yuji Syuku', serif" },
];

const ctx = el.canvas.getContext('2d');
let bgImageDataUrl = null;
let isPreviewPaused = false;
let previewRunning = false;

const ESCAPE_XML = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
const escapeXml = (value) => value.replace(/[&<>"']/g, (char) => ESCAPE_XML[char]);

function populateFonts() {
  EN_FONTS.forEach((font, index) => {
    const option = document.createElement('option');
    option.value = font.value;
    option.textContent = font.label;
    if (index === 0) option.selected = true;
    el.fontEn.appendChild(option);
  });

  JA_FONTS.forEach((font, index) => {
    const option = document.createElement('option');
    option.value = font.value;
    option.textContent = font.label;
    if (index === 0) option.selected = true;
    el.fontJa.appendChild(option);
  });
}

function charsFromText(text) {
  return [...text].filter((char) => char !== '\n');
}

function drawFrame(progress, opts) {
  const chars = charsFromText(opts.text);
  const count = Math.max(chars.length, 1);
  const spacing = opts.fontSize * 0.72;
  const lineHeight = opts.fontSize * 1.25;
  const maxCharsPerLine = Math.max(1, Math.floor((el.canvas.width - 80) / spacing));
  let svgChars = '';

  chars.forEach((char, i) => {
    const start = i / count;
    const end = (i + 1) / count;
    const localProgress = Math.min(1, Math.max(0, (progress - start) / (end - start)));
    const dash = 1000;
    const x = 40 + (i % maxCharsPerLine) * spacing;
    const y = 100 + Math.floor(i / maxCharsPerLine) * lineHeight;
    svgChars += `<text x="${x}" y="${y}" font-family="${escapeXml(opts.font)}" font-size="${opts.fontSize}" fill="none" stroke="${opts.textColor}" stroke-width="${opts.thickness}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${dash}" stroke-dashoffset="${dash * (1 - localProgress)}">${escapeXml(char)}</text>`;
  });

  let bgBlock = `<rect width="100%" height="100%" fill="${opts.bgColor}"/>`;
  if (opts.bgMode === 'image' && bgImageDataUrl) {
    bgBlock = `<image href="${bgImageDataUrl}" x="0" y="0" width="100%" height="100%" preserveAspectRatio="xMidYMid slice"/>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${el.canvas.width}" height="${el.canvas.height}" viewBox="0 0 ${el.canvas.width} ${el.canvas.height}">${bgBlock}<g>${svgChars}</g></svg>`;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, el.canvas.width, el.canvas.height);
      ctx.drawImage(img, 0, 0, el.canvas.width, el.canvas.height);
      resolve();
    };
    img.onerror = reject;
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

function readOptions() {
  const language = el.languageMode.value;
  return {
    language,
    text: el.text.value.trim() || (language === 'ja' ? 'こんにちは、かわいい文字！' : 'Hello, dreamy letters!'),
    font: language === 'ja' ? el.fontJa.value : el.fontEn.value,
    textColor: el.textColor.value,
    thickness: Number(el.thickness.value),
    fontSize: Number(el.size.value),
    speedPerChar: Number(el.speed.value),
    bgMode: el.bgMode.value,
    bgColor: el.bgColor.value,
  };
}

async function playPreview() {
  if (previewRunning) return;
  previewRunning = true;
  isPreviewPaused = false;
  el.pauseBtn.textContent = 'Pause';
  const options = readOptions();
  const totalChars = Math.max(charsFromText(options.text).length, 1);
  const totalMs = totalChars * options.speedPerChar * 1000;
  const start = performance.now();
  let pausedDuration = 0;
  let pauseStartedAt = null;

  el.status.textContent = 'Previewing...';

  while (true) {
    if (isPreviewPaused) {
      if (!pauseStartedAt) pauseStartedAt = performance.now();
      await new Promise((resolve) => setTimeout(resolve, 60));
      continue;
    }

    if (pauseStartedAt) {
      pausedDuration += performance.now() - pauseStartedAt;
      pauseStartedAt = null;
    }

    const elapsed = performance.now() - start - pausedDuration;
    const progress = Math.min(1, elapsed / totalMs);
    await drawFrame(progress, options);
    if (progress >= 1) break;
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }

  previewRunning = false;
  el.pauseBtn.textContent = 'Pause';
  el.status.textContent = 'Preview done.';
}

async function downloadAnimation() {
  const options = readOptions();
  const totalChars = Math.max(charsFromText(options.text).length, 1);
  const totalMs = totalChars * options.speedPerChar * 1000;
  const stream = el.canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
  const chunks = [];

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  const done = new Promise((resolve) => {
    recorder.onstop = () => resolve();
  });

  recorder.start();
  el.status.textContent = 'Rendering downloadable animation...';

  const start = performance.now();
  while (true) {
    const elapsed = performance.now() - start;
    const progress = Math.min(1, elapsed / totalMs);
    await drawFrame(progress, options);
    if (progress >= 1) break;
    await new Promise((resolve) => setTimeout(resolve, 30));
  }

  await new Promise((resolve) => setTimeout(resolve, 180));
  recorder.stop();
  await done;

  const blob = new Blob(chunks, { type: 'video/webm' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'z-letter-writing.webm';
  link.click();
  el.status.textContent = 'Download ready!';
}

function syncLabels() {
  el.speedValue.textContent = `${el.speed.value}s / char`;
  el.thicknessValue.textContent = `${el.thickness.value} px`;
  el.sizeValue.textContent = `${el.size.value} px`;
}

function syncLanguageMode() {
  const isJapanese = el.languageMode.value === 'ja';
  el.fontEnWrap.classList.toggle('hidden', isJapanese);
  el.fontJaWrap.classList.toggle('hidden', !isJapanese);
  if (isJapanese && !el.text.value.trim()) el.text.value = 'こんにちは、かわいい文字！';
  if (!isJapanese && !el.text.value.trim()) el.text.value = 'Hello, dreamy letters!';
}

el.bgMode.addEventListener('change', () => {
  const useImage = el.bgMode.value === 'image';
  el.solidBgControls.classList.toggle('hidden', useImage);
  el.imageBgControls.classList.toggle('hidden', !useImage);
});

el.languageMode.addEventListener('change', syncLanguageMode);

el.bgImageInput.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  bgImageDataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  el.status.textContent = `Loaded image background: ${file.name}`;
});

el.swatches.forEach((button) => {
  button.addEventListener('click', () => {
    el.bgColor.value = button.dataset.color;
  });
});

[el.speed, el.thickness, el.size].forEach((input) => input.addEventListener('input', syncLabels));

el.previewBtn.addEventListener('click', () => void playPreview());
el.pauseBtn.addEventListener('click', () => {
  if (!previewRunning) {
    el.status.textContent = 'No preview in progress.';
    return;
  }
  isPreviewPaused = !isPreviewPaused;
  el.pauseBtn.textContent = isPreviewPaused ? 'Resume' : 'Pause';
  el.status.textContent = isPreviewPaused ? 'Preview paused.' : 'Preview resumed.';
});
el.downloadBtn.addEventListener('click', () => void downloadAnimation());

populateFonts();
syncLabels();
syncLanguageMode();
void drawFrame(1, readOptions());
