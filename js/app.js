// Amazing — app logic. Gate → age setup → home (daily topic or free text) →
// story. No accounts, no history: age + unlock state live in localStorage.

// ============ CONFIG ============
const PASSPHRASE = 'Bunny';
const LS_UNLOCKED = 'amazing_unlocked';
const LS_AGE = 'amazing_age';

// ============ ELEMENTS ============
const el = (id) => document.getElementById(id);
const views = {
  gate: el('gate'),
  age: el('ageView'),
  home: el('home'),
  story: el('storyView'),
};

function show(name) {
  Object.values(views).forEach((v) => v.classList.add('hidden'));
  views[name].classList.remove('hidden');
}

// ============ GATE ============
function tryUnlock() {
  if (el('gateInput').value === PASSPHRASE) {
    localStorage.setItem(LS_UNLOCKED, 'yes');
    enterApp();
  } else {
    el('gateError').textContent = 'wrong passphrase';
    el('gateInput').value = '';
    setTimeout(() => { el('gateError').textContent = ''; }, 2000);
  }
}
el('gateBtn').addEventListener('click', tryUnlock);
el('gateInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') tryUnlock(); });

// ============ AGE ============
function getAge() {
  const n = parseInt(localStorage.getItem(LS_AGE), 10);
  return (n >= 4 && n <= 12) ? n : null;
}

el('ageSlider').addEventListener('input', () => {
  el('ageValue').textContent = el('ageSlider').value;
});
el('ageBtn').addEventListener('click', () => {
  localStorage.setItem(LS_AGE, el('ageSlider').value);
  showHome();
});
el('ageChip').addEventListener('click', () => {
  const age = getAge() || 8;
  el('ageSlider').value = age;
  el('ageValue').textContent = age;
  show('age');
});

// ============ DAILY TOPIC ============
// Day-of-year from LOCAL date parts — not toISOString(), which is UTC and
// flips the topic at 10/11am AEST instead of local midnight.
function dayOfYear() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now - start) / 86400000);
}

function todaysTopic() {
  return window.TOPICS[dayOfYear() % window.TOPICS.length];
}

// ============ HOME ============
function showHome() {
  el('todayTopic').textContent = todaysTopic();
  el('ageChip').textContent = `age ${getAge()}`;
  el('askInput').value = '';
  show('home');
}

el('todayBtn').addEventListener('click', () => fetchStory(todaysTopic()));
el('askForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const topic = el('askInput').value.trim();
  if (topic.length >= 2) fetchStory(topic);
});

// ============ STORY ============
const LOADING_MSGS = [
  'Gathering stardust…',
  'Asking the universe…',
  'Untangling the wonder…',
  'Nearly there…',
];
let loadingTimer = null;

// Render the model's text safely: escape ALL html first, then apply the one
// bit of markdown we allow (**bold**) and paragraph breaks. Never innerHTML
// the raw response.
function renderStory(text) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const bolded = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return bolded
    .split(/\n\s*\n/)
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

async function fetchStory(topic) {
  show('story');
  el('storyTopic').textContent = topic;
  el('storyBody').innerHTML = '';
  el('storyError').classList.add('hidden');
  el('againBtn').classList.add('hidden');
  el('loading').classList.remove('hidden');

  let msgIdx = 0;
  el('loadingMsg').textContent = LOADING_MSGS[0];
  loadingTimer = setInterval(() => {
    msgIdx = Math.min(msgIdx + 1, LOADING_MSGS.length - 1);
    el('loadingMsg').textContent = LOADING_MSGS[msgIdx];
  }, 6000);

  try {
    const res = await fetch(`${window.CONFIG.SUPABASE_URL}/functions/v1/get-story`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${window.CONFIG.SUPABASE_ANON_KEY}`,
        'apikey': window.CONFIG.SUPABASE_ANON_KEY,
        'x-app-key': PASSPHRASE,
      },
      body: JSON.stringify({ topic, age: getAge() }),
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      throw new Error(data.error || 'Something went wrong — try again!');
    }

    el('storyBody').innerHTML = renderStory(data.story);
  } catch (err) {
    el('storyError').textContent = err.message || 'Could not fetch your story. Are you online?';
    el('storyError').classList.remove('hidden');
  } finally {
    clearInterval(loadingTimer);
    el('loading').classList.add('hidden');
    el('againBtn').classList.remove('hidden');
  }
}

el('backBtn').addEventListener('click', showHome);
el('againBtn').addEventListener('click', showHome);

// ============ BOOT ============
function enterApp() {
  if (getAge()) showHome();
  else show('age');
}

if (localStorage.getItem(LS_UNLOCKED) === 'yes') {
  enterApp();
} else {
  show('gate');
}

// ============ SERVICE WORKER ============
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js');
}
