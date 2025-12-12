/*********************************************************
app.js - Minimal fixed version (keeping your structure)
*********************************************************/
const auth = firebase.auth();
const db = firebase.database();

const appContainer = document.getElementById('app-container');
const bsBackdrop = document.getElementById('bs-backdrop');
const bsSheet = document.getElementById('bs-sheet');
const bsTitle = document.getElementById('bs-title');
const bsMeta = document.getElementById('bs-meta');
const bsPlayerWrap = document.getElementById('bs-player-wrap');
const bsClose = document.getElementById('bs-close');

let loadedVideos = [];
const telegramUrlCache = {};

function escapeHtml(s) { return (s||'').toString().replace(/[&<>"']/g, function(m){return ({'&':'&','<':'<','>':'>','"':'"',"'":'''}[m]);}); }

async function getBotTokenOnce() {
  return new Promise((resolve, reject) => {
    db.ref('TelegramBot/token').once('value', snap => {
      resolve(snap.val() || null);
    }, err => reject(err));
  });
}

async function getTelegramFileURL(filePathOrId) {
  if (!filePathOrId) return null;
  if (telegramUrlCache[filePathOrId] !== undefined) return telegramUrlCache[filePathOrId];

  if (filePathOrId.startsWith('http://') || filePathOrId.startsWith('https://')) {
    telegramUrlCache[filePathOrId] = filePathOrId;
    return filePathOrId;
  }

  try {
    const token = await getBotTokenOnce();
    if (!token) {
      console.error('Bot token missing at TelegramBot/token');
      telegramUrlCache[filePathOrId] = null;
      return null;
    }

    if (filePathOrId.includes('/')) {
      const final = `https://api.telegram.org/file/bot${encodeURIComponent(token)}/${filePathOrId}`;
      telegramUrlCache[filePathOrId] = final;
      return final;
    }

    const apiUrl = `https://api.telegram.org/bot${encodeURIComponent(token)}/getFile?file_id=${encodeURIComponent(filePathOrId)}`;
    const resp = await fetch(apiUrl);
    const json = await resp.json();
    if (!json || !json.ok || !json.result || !json.result.file_path) {
      console.error('Telegram getFile failed', json);
      telegramUrlCache[filePathOrId] = null;
      return null;
    }
    const filePath = json.result.file_path;
    const final = `https://api.telegram.org/file/bot${encodeURIComponent(token)}/${filePath}`;
    telegramUrlCache[filePathOrId] = final;
    return final;

  } catch (err) {
    console.error('getTelegramFileURL error', err);
    telegramUrlCache[filePathOrId] = null;
    return null;
  }
}

/* ---------- UI layout ---------- */
function renderMainLayout(contentHTML) {
  appContainer.innerHTML = `
<header>
<h1>Video App</h1>
<nav>
<button onclick="navigate('home')" class="btn secondary-btn">🏠 Home</button>
<button onclick="navigate('history')" class="btn secondary-btn">📜 History</button>
<button onclick="navigate('profile')" class="btn secondary-btn">👤 Profile</button>
<button onclick="logout()" class="btn primary-btn">👋 Logout</button>
</nav>
</header>

<div id="filters-container" class="filters-row"></div>
<main id="main-content">${contentHTML}</main>
`;
}

/* ---------- Auth screens ---------- */
function renderAuthScreen() {
  const current = auth.currentUser;
  if (current && current.emailVerified) { navigate('home'); return; }

  appContainer.innerHTML = `
<header><h1>Video App</h1></header>
<div class="auth-container">
<h2>Login / Register</h2>
<form id="auth-form" class="form-card">
<input type="email" id="auth-email" placeholder="Email" required class="input-field"><br>
<input type="password" id="auth-password" placeholder="Password" required class="input-field"><br>
<input type="text" id="auth-username" placeholder="Username (for register)" class="input-field" style="display:none;"><br>
<button type="submit" data-mode="login" class="btn primary-btn">Login</button>
<button type="button" id="toggle-register" class="btn secondary-btn">Switch to Register</button>
</form>
<p id="auth-message" class="error-message"></p>
</div>
`;

  document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const mode = e.submitter.getAttribute('data-mode');
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const username = document.getElementById('auth-username').value.trim();
    const msgEl = document.getElementById('auth-message');
    msgEl.textContent = '';

    try {
      if (mode === 'login') {
        const cred = await auth.signInWithEmailAndPassword(email, password);
        const user = cred.user;
        if (!user.emailVerified) { showVerificationPopup(user); return; }
        loadVideosFromDb();
      } else {
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        const user = cred.user;
        if (user && username) await user.updateProfile({ displayName: username });
        await user.sendEmailVerification();
        renderEmailVerificationScreen(email);
      }
    } catch (err) {
      console.error(err);
      msgEl.textContent = err.message || 'Auth error';
    }
  });

  document.getElementById('toggle-register').addEventListener('click', function() {
    const usernameInput = document.getElementById('auth-username');
    const submitButton = document.querySelector('#auth-form button[type="submit"]');
    if (usernameInput.style.display === 'none') {
      usernameInput.style.display = 'block';
      submitButton.textContent = 'Register';
      submitButton.setAttribute('data-mode', 'register');
      this.textContent = 'Switch to Login';
    } else {
      usernameInput.style.display = 'none';
      submitButton.textContent = 'Login';
      submitButton.setAttribute('data-mode', 'login');
      this.textContent = 'Switch to Register';
    }
  });
}

/* ---------- Email Verification ---------- */
function renderEmailVerificationScreen(email) {
  appContainer.innerHTML = `
<header><h1>Video App</h1></header>
<div class="auth-container">
<h2>Email Verification</h2>
<p>A verification link has been sent to <strong>${escapeHtml(email)}</strong>.</p>
<p>Please click the link in your email to verify your account.</p>
<button id="resend-email" class="btn secondary-btn">Resend Email</button>
<button id="check-verified" class="btn primary-btn" style="margin-left:10px;">I have verified (Check)</button>
<p id="verify-msg" style="margin-top:12px;color:#333;"></p>
</div>
`;

  document.getElementById('resend-email').addEventListener('click', async () => {
    const cur = auth.currentUser;
    const statusEl = document.getElementById('verify-msg');
    statusEl.textContent = 'Sending...';
    try {
      if (cur) { await cur.sendEmailVerification(); statusEl.textContent = 'Verification email resent.'; }
      else statusEl.textContent = 'No active session.';
    } catch (err) { statusEl.textContent = 'Error: ' + (err.message || err); }
  });

  document.getElementById('check-verified').addEventListener('click', async () => {
    const cur = auth.currentUser;
    const statusEl = document.getElementById('verify-msg');
    statusEl.textContent = 'Checking...';
    try {
      if (cur) { await cur.reload(); if (cur.emailVerified) loadVideosFromDb(); else statusEl.textContent = 'Email not verified yet.'; }
      else statusEl.textContent = 'No user session.';
    } catch (err) { statusEl.textContent = 'Error: ' + (err.message || err); }
  });
}

/* ---------- Video rendering ---------- */
function renderHomeScreen(filteredVideos) {
  const videosToShow = filteredVideos || loadedVideos;
  const listHTML = videosToShow.map((v) =>
`<div class="video-card" data-video-id="${escapeHtml(v.id)}" onclick="onVideoCardClick('${escapeHtml(v.id)}')">
<img src="${escapeHtml(v.thumbnailUrl || 'https://via.placeholder.com/250x150?text=No+Thumbnail')}" alt="${escapeHtml(v.title)}" class="video-thumbnail">
<div class="video-title">${escapeHtml(v.title)}</div>
<div style="padding:8px;color:#666;font-size:.9rem;">
${escapeHtml(v.meta && v.meta.content ? v.meta.content : (v.title || ''))}<br>
<small>${escapeHtml(v.meta && v.meta.season ? v.meta.season : '')} ${v.meta && v.meta.episode ? ' • ' + escapeHtml(v.meta.episode) : ''}</small>
</div></div>`).join('');

  const homeContent = `<div class="page-header"><h2>Home - Videos</h2></div>
<div id="video-grid" class="grid-layout">${listHTML}</div>
<div id="video-player" class="video-player-container"></div>`;
  renderMainLayout(homeContent);
}

/* ---------- Video click handlers ---------- */
window.onVideoCardClick = async function(id) {
  const vid = loadedVideos.find(v => v.id === id);
  if (!vid) return;

  if (!vid.videoUrl && vid.videoId) {
    openBottomSheetLoading(vid);
    const url = await getTelegramFileURL(vid.videoId);
    vid.videoUrl = url;
    if (!url) { showBottomSheetError('Unable to get video file URL. Possibly Telegram/CORS or token issue.'); return; }
  }
  openBottomSheet(vid);
};

/* ---------- Bottom sheet ---------- */
function openBottomSheetLoading(vid) {
  bsTitle.textContent = vid.title;
  bsMeta.innerHTML = `<div class="loader-inline"></div><div>Preparing video...</div>`;
  bsPlayerWrap.innerHTML = '';
  openBackdrop();
}

function showBottomSheetError(msg) {
  bsMeta.innerHTML = `<div style="color:#b00">${escapeHtml(msg)}</div>`;
  bsPlayerWrap.innerHTML = '';
  openBackdrop();
}

function openBottomSheet(vid) {
  bsTitle.textContent = vid.title;
  const metaParts = [];
  if (vid.meta && vid.meta.content) metaParts.push(vid.meta.content);
  if (vid.meta && vid.meta.season) metaParts.push(vid.meta.season);
  if (vid.meta && vid.meta.episode) metaParts.push(vid.meta.episode);
  bsMeta.innerHTML = metaParts.map(p => `<div>${escapeHtml(p)}</div>`).join('');

  const videoEl = document.createElement('video');
  videoEl.controls = true;
  videoEl.autoplay = true;
  videoEl.playsInline = true;
  videoEl.preload = 'metadata';
  videoEl.className = 'video-element';
  videoEl.style.width = '100%';
  videoEl.setAttribute('controlslist', 'nodownload');
  videoEl.setAttribute('crossorigin', 'anonymous');

  const src = document.createElement('source');
  src.src = vid.videoUrl;
  src.type = 'video/mp4';
  videoEl.appendChild(src);

  bsPlayerWrap.innerHTML = '';
  bsPlayerWrap.appendChild(videoEl);

  openBackdrop();

  videoEl.addEventListener('stalled', () => { });
  videoEl.addEventListener('playing', () => { });
  videoEl.addEventListener('waiting', () => { });
  videoEl.addEventListener('canplay', () => { });

  const playPromise = videoEl.play();
  if (playPromise && playPromise.catch) playPromise.catch(err => console.warn('Autoplay prevented:', err));

  addToHistory(vid.title);
}

function openBackdrop() { bsBackdrop.style.display = 'flex'; setTimeout(()=> bsSheet.classList.add('open'), 10); bsBackdrop.setAttribute('aria-hidden','false'); }
function closeBackdrop() { bsSheet.classList.remove('open'); bsBackdrop.setAttribute('aria-hidden','true'); setTimeout(()=> bsBackdrop.style.display = 'none', 300); const v = bsPlayerWrap.querySelector('video'); if (v) { v.pause(); bsPlayerWrap.innerHTML=''; } }
bsClose.addEventListener('click', closeBackdrop);
bsBackdrop.addEventListener('click', (e) => { if (e.target === bsBackdrop) closeBackdrop(); });

/* ---------- Load videos ---------- */
async function loadVideosFromDb() {
  appContainer.innerHTML = `<div style="padding:30px">Loading videos...</div>`;
  const videosRef = db.ref('videos');
  videosRef.on('value', async (snap) => {
    const obj = snap.val() || {};
    const keys = Object.keys(obj || {});
    loadedVideos = [];

    const thumbPromises = keys.map(async (id) => {
      const v = obj[id];
      const title = v.title || 'Untitled';
      const description = v.description || '';
      const thumbId = v.thumbnailId || '';
      const videoId = v.videoId || '';
      const thumbUrl = thumbId ? await getTelegramFileURL(thumbId) : null;
      return { id, title, description, thumbnailId: thumbId, videoId, thumbnailUrl: thumbUrl, videoUrl: null, meta: null };
    });

    loadedVideos = await Promise.all(thumbPromises);

    if (window.filterModule) filterModule.initFilters(loadedVideos, onFilterChange);
    renderHomeScreen();
  }, (err) => {
    appContainer.innerHTML = `<div style="padding:30px">Error loading videos: ${escapeHtml(err.message || err)}</div>`;
  });
}

function onFilterChange(filters) {
  const filtered = filterModule.applyFilters(filters);
  renderHomeScreen(filtered);
}

/* ---------- Navigation & auth ---------- */
function navigate(screen) {
  const user = auth.currentUser;
  const verified = user && user.emailVerified;
  if (!verified && screen !== 'auth') { renderAuthScreen(); return; }

  switch (screen) {
    case 'home': renderHomeScreen(); break;
    case 'history': renderHistoryScreen(); break;
    case 'profile': renderProfileScreen(); break;
    case 'auth':
    default: renderAuthScreen(); break;
  }
}

window.logout = function() {
  auth.signOut().then(() => {
    localStorage.removeItem('userHistory');
    loadedVideos = [];
    navigate('auth');
  }).catch(err => { console.error('Sign out error', err); alert('Error signing out: ' + (err.message || err)); });
};

/* ---------- History / Profile ---------- */
function addToHistory(title) {
  let history = JSON.parse(localStorage.getItem('userHistory') || '[]');
  history.push({ title, watchedAt: new Date().toLocaleString() });
  localStorage.setItem('userHistory', JSON.stringify(history));
}

function renderHistoryScreen() {
  const history = JSON.parse(localStorage.getItem('userHistory') || '[]');
  let historyList = '<p><h3>No history yet. Start watching!</h3></p>';
  if (history.length > 0) historyList = '<ul class="history-list">' + history.slice().reverse().map(item => `<li><strong>${escapeHtml(item.title)}</strong> - Watched on <em>${escapeHtml(item.watchedAt)}</em></li>`).join('') + '</ul>';
  const historyContent = `<div class="page-header"><h2>History</h2></div>${historyList}`;
  renderMainLayout(historyContent);
}

function renderProfileScreen() {
  const user = auth.currentUser;
  const profileUser = user ? { username: user.displayName || 'user123', name: user.displayName || 'John Doe', email: user.email || 'test@example.com', joined: '2024-01-01' } : { username:'user123', name:'John Doe', email:'test@example.com', joined:'2024-01-01' };
  const profileContent = `<div class="page-header"><h2>Profile</h2></div>
<table class="profile-table">
<tr><th>Username:</th><td>${escapeHtml(profileUser.username)}</td></tr>
<tr><th>Name:</th><td>${escapeHtml(profileUser.name)}</td></tr>
<tr><th>Email:</th><td>${escapeHtml(profileUser.email)}</td></tr>
<tr><th>Member Since:</th><td>${escapeHtml(profileUser.joined)}</td></tr>
</table>`;
  renderMainLayout(profileContent);
}

/* ---------- Auth listener ---------- */
auth.onAuthStateChanged(async (user) => {
  if (user) {
    await user.reload();
    if (user.emailVerified) loadVideosFromDb();
    else renderEmailVerificationScreen(user.email || '');
  } else renderAuthScreen();
});

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', () => { navigate('auth'); });
