// Amazing — app logic. Gate → age setup → home (daily topic or free text) →
// story, plus history + favourites backed by the Cloudflare Worker's KV.
// No accounts: age + unlock state live in localStorage; stories live in a
// single shared KV namespace behind the Worker.

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
  history: el('historyView'),
  story: el('storyView'),
};

function show(name) {
  Object.values(views).forEach((v) => v.classList.add('hidden'));
  views[name].classList.remove('hidden');
}

// ============ WORKER API ============
// Every request carries the shared passphrase; the Worker rejects anything
// without it. Non-OK responses and {error} bodies both surface as thrown
// Errors with a kid-friendly message.
async function api(path, options = {}) {
  const res = await fetch(`${window.CONFIG.WORKER_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-app-key': PASSPHRASE,
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || 'Something went wrong — try again!');
  }
  return data;
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

// The story currently on screen: { id, favourite }. Null until one loads.
let currentStory = null;

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

function startStoryView(topic) {
  show('story');
  currentStory = null;
  el('storyTopic').textContent = topic;
  el('storyBody').innerHTML = '';
  el('storyError').classList.add('hidden');
  el('againBtn').classList.add('hidden');
  el('favBtn').classList.add('hidden');
  el('loading').classList.remove('hidden');

  let msgIdx = 0;
  el('loadingMsg').textContent = LOADING_MSGS[0];
  loadingTimer = setInterval(() => {
    msgIdx = Math.min(msgIdx + 1, LOADING_MSGS.length - 1);
    el('loadingMsg').textContent = LOADING_MSGS[msgIdx];
  }, 6000);
}

function finishStoryView() {
  clearInterval(loadingTimer);
  el('loading').classList.add('hidden');
  el('againBtn').classList.remove('hidden');
}

function showStoryError(err) {
  el('storyError').textContent = err.message || 'Could not fetch your story. Are you online?';
  el('storyError').classList.remove('hidden');
}

function setFavButton() {
  el('favBtn').textContent = currentStory && currentStory.favourite ? '★' : '☆';
  el('favBtn').classList.toggle('is-fav', Boolean(currentStory && currentStory.favourite));
}

async function fetchStory(topic) {
  startStoryView(topic);
  try {
    const data = await api('/story', {
      method: 'POST',
      body: JSON.stringify({ topic, age: getAge() }),
    });
    el('storyBody').innerHTML = renderStory(data.story);
    currentStory = { id: data.id, favourite: false };
    setFavButton();
    el('favBtn').classList.remove('hidden');
  } catch (err) {
    showStoryError(err);
  } finally {
    finishStoryView();
  }
}

// Re-open a story already stored in KV — no regeneration.
async function openSavedStory(id, topic) {
  startStoryView(topic);
  try {
    const data = await api(`/story?id=${encodeURIComponent(id)}`);
    el('storyTopic').textContent = data.topic;
    el('storyBody').innerHTML = renderStory(data.story);
    currentStory = { id: data.id, favourite: data.favourite };
    setFavButton();
    el('favBtn').classList.remove('hidden');
  } catch (err) {
    showStoryError(err);
  } finally {
    finishStoryView();
  }
}

el('favBtn').addEventListener('click', async () => {
  if (!currentStory) return;
  const wanted = !currentStory.favourite;
  currentStory.favourite = wanted; // optimistic
  setFavButton();
  try {
    await api('/favourite', {
      method: 'POST',
      body: JSON.stringify({ id: currentStory.id, favourite: wanted }),
    });
  } catch {
    currentStory.favourite = !wanted; // roll back on failure
    setFavButton();
  }
});

el('backBtn').addEventListener('click', showHome);
el('againBtn').addEventListener('click', showHome);

// ============ HISTORY ============
function historyRow(story) {
  const li = document.createElement('li');
  li.className = 'history-row';

  const btn = document.createElement('button');
  btn.className = 'history-open';
  btn.addEventListener('click', () => openSavedStory(story.id, story.topic));

  const topic = document.createElement('span');
  topic.className = 'history-topic';
  topic.textContent = story.topic; // textContent — never trust stored text as HTML

  const meta = document.createElement('span');
  meta.className = 'history-meta';
  const when = story.ts ? new Date(story.ts).toLocaleDateString() : '';
  meta.textContent = [when, story.age ? `age ${story.age}` : ''].filter(Boolean).join(' · ');

  btn.append(topic, meta);

  const star = document.createElement('span');
  star.className = 'history-star';
  star.textContent = story.favourite ? '★' : '';

  li.append(btn, star);
  return li;
}

async function showHistory() {
  show('history');
  el('historyList').innerHTML = '';
  el('historyError').classList.add('hidden');
  el('historyEmpty').classList.add('hidden');
  el('historyLoading').classList.remove('hidden');

  try {
    const data = await api('/history');
    if (!data.stories.length) {
      el('historyEmpty').classList.remove('hidden');
    } else {
      data.stories.forEach((s) => el('historyList').appendChild(historyRow(s)));
    }
  } catch (err) {
    el('historyError').textContent = err.message;
    el('historyError').classList.remove('hidden');
  } finally {
    el('historyLoading').classList.add('hidden');
  }
}

el('historyChip').addEventListener('click', showHistory);
el('historyBackBtn').addEventListener('click', showHome);

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
