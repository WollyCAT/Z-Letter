const el = {
  text: document.getElementById('textInput'),
  font: document.getElementById('fontSelect'),
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
  downloadBtn: document.getElementById('downloadBtn'),
  status: document.getElementById('statusText'),
  canvas: document.getElementById('previewCanvas'),
  swatches: [...document.querySelectorAll('.swatch')],
};

const ctx = el.canvas.getContext('2d');
let bgImageDataUrl = null;

const ESCAPE_XML = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

const escapeXml = (value) => value.replace(/[&<>"']/g, (char) => ESCAPE_XML[char]);

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
    const offset = dash * (1 - localProgress);
    const x = 40 + (i % maxCharsPerLine) * spacing;
    const y = 100 + Math.floor(i / maxCharsPerLine) * lineHeight;
    svgChars += `<text x="${x}" y="${y}" font-family="${escapeXml(opts.font)}" font-size="${opts.fontSize}" fill="none" stroke="${opts.textColor}" stroke-width="${opts.thickness}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${dash}" stroke-dashoffset="${offset}">${escapeXml(char)}</text>`;
  });

  let bgBlock = `<rect width="100%" height="100%" fill="${opts.bgColor}"/>`;
  if (opts.bgMode === 'image' && bgImageDataUrl) {
    bgBlock = `<image href="${bgImageDataUrl}" x="0" y="0" width="100%" height="100%" preserveAspectRatio="xMidYMid slice"/>`;
  }

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${el.canvas.width}" height="${el.canvas.height}" viewBox="0 0 ${el.canvas.width} ${el.canvas.height}">
    ${bgBlock}
    <g>${svgChars}</g>
  </svg>`;

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
  return {
    text: el.text.value.trim() || 'Hello! こんにちは！',
    font: el.font.value,
    textColor: el.textColor.value,
    thickness: Number(el.thickness.value),
    fontSize: Number(el.size.value),
    speedPerChar: Number(el.speed.value),
    bgMode: el.bgMode.value,
    bgColor: el.bgColor.value,
  };
}

async function playPreview() {
  const options = readOptions();
  const totalChars = Math.max(charsFromText(options.text).length, 1);
  const totalMs = totalChars * options.speedPerChar * 1000;
  const start = performance.now();
  el.status.textContent = 'Previewing...';

  while (true) {
    const elapsed = performance.now() - start;
    const progress = Math.min(1, elapsed / totalMs);
    await drawFrame(progress, options);
    if (progress >= 1) break;
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }

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
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'z-letter-writing.webm';
  link.click();
  URL.revokeObjectURL(url);
  el.status.textContent = 'Download ready!';
}

function syncLabels() {
  el.speedValue.textContent = `${el.speed.value}s / char`;
  el.thicknessValue.textContent = `${el.thickness.value} px`;
  el.sizeValue.textContent = `${el.size.value} px`;
}

el.bgMode.addEventListener('change', () => {
  const useImage = el.bgMode.value === 'image';
  el.solidBgControls.classList.toggle('hidden', useImage);
  el.imageBgControls.classList.toggle('hidden', !useImage);
});

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

[el.speed, el.thickness, el.size].forEach((input) => {
  input.addEventListener('input', syncLabels);
});

el.previewBtn.addEventListener('click', () => void playPreview());
el.downloadBtn.addEventListener('click', () => void downloadAnimation());

syncLabels();
void drawFrame(1, readOptions());
