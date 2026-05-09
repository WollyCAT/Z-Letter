const PROVIDERS = {
  OpenAI: {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    models: ['gpt-4.1-mini', 'gpt-4.1', 'gpt-4o-mini'],
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  Anthropic: {
    endpoint: 'https://api.anthropic.com/v1/messages',
    models: ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest'],
    headers: (key) => ({ 'x-api-key': key, 'anthropic-version': '2023-06-01' }),
  },
  Gemini: {
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}',
    models: ['gemini-1.5-flash', 'gemini-1.5-pro'],
  },
};

const el = {
  provider: document.getElementById('providerSelect'),
  model: document.getElementById('modelSelect'),
  key: document.getElementById('apiKeyInput'),
  language: document.getElementById('languageSelect'),
  grammarInput: document.getElementById('grammarInput'),
  checkBtn: document.getElementById('checkBtn'),
  copyBtn: document.getElementById('copyBtn'),
  status: document.getElementById('statusText'),
  highlight: document.getElementById('highlightOutput'),
  issues: document.getElementById('issuesList'),
  toneInput: document.getElementById('toneInput'),
  toneSelect: document.getElementById('toneSelect'),
  toneBtn: document.getElementById('reviseToneBtn'),
  toneOutput: document.getElementById('toneOutput'),
  darkModeBtn: document.getElementById('darkModeBtn'),
};

let state = { text: '', issues: [] };

function initProviders() {
  Object.keys(PROVIDERS).forEach((p) => el.provider.add(new Option(p, p)));
  syncModels();
}
function syncModels() {
  const models = PROVIDERS[el.provider.value].models;
  el.model.innerHTML = '';
  models.forEach((m) => el.model.add(new Option(m, m)));
}

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function renderIssues() {
  let html = state.text;
  const sorted = [...state.issues].sort((a, b) => b.start - a.start);
  sorted.forEach((issue) => {
    const before = escapeHtml(html.slice(0, issue.start));
    const bad = escapeHtml(html.slice(issue.start, issue.end));
    const after = escapeHtml(html.slice(issue.end));
    html = `${before}<span class="err">${bad}</span>${after}`;
  });
  el.highlight.innerHTML = state.text ? html : '<span class="status">No text.</span>';

  el.issues.innerHTML = '';
  state.issues.forEach((issue, idx) => {
    const card = document.createElement('div');
    card.className = 'issue-item';
    card.innerHTML = `<div><strong>${escapeHtml(issue.original)}</strong> → ${escapeHtml(issue.suggestion)}</div><div>${escapeHtml(issue.reason)}</div>`;
    const btn = document.createElement('button');
    btn.textContent = 'Accept';
    btn.addEventListener('click', () => acceptIssue(idx));
    card.appendChild(btn);
    el.issues.appendChild(card);
  });
}

function acceptIssue(index) {
  const issue = state.issues[index];
  state.text = `${state.text.slice(0, issue.start)}${issue.suggestion}${state.text.slice(issue.end)}`;
  const delta = issue.suggestion.length - (issue.end - issue.start);
  state.issues = state.issues
    .filter((_, i) => i !== index)
    .map((it) => (it.start > issue.start ? { ...it, start: it.start + delta, end: it.end + delta } : it));
  el.grammarInput.value = state.text;
  renderIssues();
}

async function callLLM(task, text, tone = '') {
  const provider = el.provider.value;
  const model = el.model.value;
  const key = el.key.value.trim();
  if (!key) throw new Error('Missing API key.');

  const prompt = task === 'grammar'
    ? `Language: ${el.language.value}. Return STRICT JSON only with shape {"issues":[{"start":number,"end":number,"original":string,"suggestion":string,"reason":string}]}. Use index positions for the original text. Check typos, tense, grammar and inappropriate collocations. Text: ${text}`
    : `Rewrite the text in ${tone} tone. Keep meaning unchanged. Language: ${el.language.value}. Text: ${text}`;

  if (provider === 'OpenAI') {
    const res = await fetch(PROVIDERS.OpenAI.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', ...PROVIDERS.OpenAI.headers(key) }, body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature: 0.2 }) });
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  }
  if (provider === 'Anthropic') {
    const res = await fetch(PROVIDERS.Anthropic.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', ...PROVIDERS.Anthropic.headers(key) }, body: JSON.stringify({ model, max_tokens: 1200, messages: [{ role: 'user', content: prompt }] }) });
    const data = await res.json();
    return data.content?.[0]?.text || '';
  }
  const url = PROVIDERS.Gemini.endpoint.replace('{model}', model).replace('{key}', encodeURIComponent(key));
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

el.checkBtn.addEventListener('click', async () => {
  try {
    el.status.textContent = 'Checking grammar...';
    const text = el.grammarInput.value;
    const raw = await callLLM('grammar', text);
    const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || raw);
    state = { text, issues: Array.isArray(parsed.issues) ? parsed.issues : [] };
    renderIssues();
    el.status.textContent = `Done. Found ${state.issues.length} issue(s).`;
  } catch (e) {
    el.status.textContent = `Error: ${e.message}`;
  }
});

el.copyBtn.addEventListener('click', async () => {
  await navigator.clipboard.writeText(el.grammarInput.value);
  el.status.textContent = 'Revised text copied.';
});

el.toneBtn.addEventListener('click', async () => {
  try {
    el.status.textContent = 'Revising tone...';
    const revised = await callLLM('tone', el.toneInput.value, el.toneSelect.value);
    el.toneOutput.value = revised.trim();
    el.status.textContent = 'Tone revision completed.';
  } catch (e) {
    el.status.textContent = `Error: ${e.message}`;
  }
});

el.provider.addEventListener('change', syncModels);
el.darkModeBtn.addEventListener('click', () => {
  document.documentElement.classList.toggle('light');
  el.darkModeBtn.textContent = document.documentElement.classList.contains('light') ? '🌞 Light Mode' : '🌙 Dark Mode';
});

initProviders();
renderIssues();
