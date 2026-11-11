import { topics } from './property-coach-knowledge.mjs';
import { findTopics, matchRecord, normalize } from './property-coach-search.mjs';

const host = document.createElement('aside');
host.id = 'property-coach';
host.innerHTML = `
  <button type="button" class="coach-launch" aria-controls="coach-panel" aria-expanded="false"></button>
  <section id="coach-panel" hidden aria-label="Propertichain Coach">
    <header><strong>Propertichain Coach</strong><button type="button" data-language></button><button type="button" data-close>×</button></header>
    <p class="coach-note"></p>
    <div class="coach-log" role="log" aria-live="polite"></div>
    <div class="coach-topics"></div>
    <form><input type="text" maxlength="600" autocomplete="off" required><button type="submit"></button></form>
    <button type="button" class="coach-clear"></button>
  </section>`;
document.body.append(host);

const get = selector => host.querySelector(selector);
const launch = get('.coach-launch');
const panel = get('#coach-panel');
const log = get('.coach-log');
const input = get('input');
let lang = document.documentElement.lang === 'en' ? 'en' : 'vi';
const t = (vi, en) => lang === 'vi' ? vi : en;
let records;

function loadRecords() {
  records ??= Promise.all(['grandpark-data.json', 'roadmap-data.json'].map(async file => {
    const response = await fetch(file);
    return response.ok ? response.json() : null;
  })).catch(() => [null, null]);
  return records;
}

function message(text, kind, href) {
  const bubble = document.createElement('div');
  bubble.className = 'coach-message ' + kind;
  bubble.textContent = text;
  if (href) {
    const link = document.createElement('a');
    link.href = href;
    link.textContent = t('Xem mục liên quan ↗', 'Open related section ↗');
    link.addEventListener('click', () => open(false));
    bubble.append(document.createElement('br'), link);
  }
  log.append(bubble);
  while (log.children.length > 24) log.firstElementChild.remove();
  log.scrollTop = log.scrollHeight;
}

function showTopic(topic) {
  message(topic[lang === 'vi' ? 5 : 6], 'assistant', topic[1]);
}

async function ask(raw, topic) {
  const question = raw.trim();
  if (!question) return;
  input.value = '';
  const secret = /\b(seed phrase|private key|khoa rieng|mat khau|mnemonic|password)\b/.test(normalize(question)) ||
    /\b(?:0x)?[a-f0-9]{64}\b/i.test(question);
  message(secret ? t('[Đã ẩn nội dung nhạy cảm]', '[Sensitive content hidden]') : question, 'user');
  if (secret) {
    showTopic(topics.find(item => item[0] === 'privacy'));
    return;
  }
  if (topic) {
    showTopic(topic);
    return;
  }
  const marker = log.lastElementChild;
  const [park, roadmap] = await loadRecords();
  if (!marker.isConnected) return;
  const record = matchRecord(question, park, roadmap, lang);
  if (record) {
    message(record.text, 'assistant', record.href);
    return;
  }
  const matches = findTopics(question);
  if (matches.length) {
    matches.forEach(showTopic);
    return;
  }
  message(t(
    'Em chưa tìm được câu trả lời trong tài liệu Propertichain. Anh/chị có thể hỏi cụ thể hơn, nhập mã căn demo hoặc chọn một chủ đề bên dưới.',
    'I could not find an answer in the Propertichain materials. Try a more specific question, enter a demo property ID, or select a topic below.'
  ), 'assistant');
}

function labels() {
  launch.textContent = t('Hỏi Propertichain', 'Ask Propertichain');
  get('[data-language]').textContent = t('EN', 'VI');
  get('[data-close]').setAttribute('aria-label', t('Đóng chatbot', 'Close chatbot'));
  get('.coach-note').textContent = t(
    'Trả lời từ tài liệu dự án. Hội thoại nằm trong trang này. Đừng nhập thông tin bí mật.',
    'Answers from project materials. Chat stays on this page. Never enter secrets.'
  );
  input.placeholder = t('Hỏi về Propertichain…', 'Ask about Propertichain…');
  input.setAttribute('aria-label', input.placeholder);
  get('button[type=submit]').textContent = t('Gửi', 'Send');
  get('.coach-clear').textContent = t('Xóa hội thoại', 'Clear chat');
  get('.coach-topics').replaceChildren(...topics.map(topic => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = topic[lang === 'vi' ? 2 : 3];
    button.addEventListener('click', () => ask(button.textContent, topic));
    return button;
  }));
}

function open(value) {
  panel.hidden = !value;
  launch.setAttribute('aria-expanded', String(value));
  if (value) {
    void loadRecords();
    if (!log.children.length) message(t(
      'Em có thể giải thích quyền từng căn, tiền thuê, thanh toán bằng token, Grand Park và roadmap. Anh/chị muốn hỏi gì?',
      'Ask me about property rights, rent, token settlement, Grand Park or the roadmap.'
    ), 'assistant');
    input.focus();
  } else launch.focus({ preventScroll: true });
}

launch.addEventListener('click', () => open(panel.hidden));
get('[data-close]').addEventListener('click', () => open(false));
get('[data-language]').addEventListener('click', () => {
  lang = lang === 'vi' ? 'en' : 'vi';
  labels();
});
get('.coach-clear').addEventListener('click', () => {
  log.replaceChildren();
  input.value = '';
  input.focus();
});
get('form').addEventListener('submit', event => {
  event.preventDefault();
  void ask(input.value);
});
host.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !panel.hidden) open(false);
});
labels();
