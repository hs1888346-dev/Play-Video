/*********************************************************
 * Video App - Firebase Auth + Realtime DB + Telegram
 * - Reads Telegram bot token from DB: TelegramBot/token
 * - Loads videos from DB: videos/<uniqueId>/{videoId,thumbnailId,title,description}
 * - Converts Telegram file_id -> direct file URL using getFile endpoint
 * - Email verification popup + resend verification
 *********************************************************/

/* ------------------ Utilities & Fake fallback ------------------ */
const FAKE_USER_DATA = { username: "user123", email: "test@example.com", name: "John Doe", joined: "2024-01-01" };

const appContainer = document.getElementById('app-container');

function showToast(msg) {
  // simple inline toast
  console.log('[TOAST]', msg);
  // optionally show in UI
}

/* ------------------ Firebase refs ------------------ */
const auth = firebase.auth();
const db = firebase.database();

/* ------------------ Token helper ------------------ */
/**
 * Returns the bot token string stored at /TelegramBot/token in Realtime DB.
 * Resolves to null if token missing.
 */
function getBotTokenOnce() {
  return new Promise((resolve, reject) => {
    const tokenRef = db.ref('TelegramBot/token');
    tokenRef.once('value', snap => {
      const token = snap.val() || null;
      resolve(token);
    }, err => reject(err));
  });
}

/* ------------------ Telegram helper ------------------ */
/**
 * Convert a Telegram `file_id` to a direct file URL using Telegram getFile API.
 * Reads bot token from DB at runtime. Returns null on failure.
 *
 * Note: Browser CORS may block Telegram API on some setups — if that happens,
 * use a tiny server-side proxy.
 */
async function getTelegramFileURL(fileId) {
  try {
    if (!fileId) return null;

    const token = await getBotTokenOnce();
    if (!token) {
      console.error('Telegram bot token not found in DB (TelegramBot/token).');
      return null;
    }

    // 1) Call getFile to get file_path
    const apiUrl = `https://api.telegram.org/bot${encodeURIComponent(token)}/getFile?file_id=${encodeURIComponent(fileId)}`;

    const resp = await fetch(apiUrl);
    const json = await resp.json();

    if (!json || !json.ok || !json.result || !json.result.file_path) {
      console.error('Telegram getFile error:', json);
      return null;
    }

    const filePath = json.result.file_path; // e.g. "photos/file_123.jpg" or "videos/file_456.mp4"
    // 2) Build direct file URL
    const fileUrl = `https://api.telegram.org/file/bot${encodeURIComponent(token)}/${filePath}`;

    return fileUrl;
  } catch (err) {
    console.error('Error in getTelegramFileURL:', err);
    return null;
  }
}

/* ------------------ Video list & rendering ------------------ */
let loadedVideos = []; // each item: { id, title, description, thumbnailUrl, videoUrl }

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
    <main id="main-content">${contentHTML}</main>
  `;
}

function renderAuthScreen() {
  // If already signed in & verified, go home
  const current = auth.currentUser;
  if (current && current.emailVerified) {
    navigate('home');
    return;
  }

  appContainer.innerHTML = `
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
        if (!user.emailVerified) {
          // Show verification popup/instruction
          showVerificationPopup(user);
          return;
        }
        // Verified
        navigate('home');
      } else {
        // register
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        const user = cred.user;
        if (user && username) {
          await user.updateProfile({ displayName: username });
        }
        // send verification
        await user.sendEmailVerification();
        renderEmailVerificationScreen(email);
      }
    } catch (err) {
      console.error(err);
      msgEl.textContent = err.message || 'Authentication error';
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

/* Verification UI: page shown after registration or when not verified */
function renderEmailVerificationScreen(email) {
  appContainer.innerHTML = `
    <div class="auth-container">
      <h2>Email Verification</h2>
      <p>A verification link has been sent to <strong>${email}</strong>.</p>
      <p>Please click the link in your email to verify your account.</p>
      <button id="resend-email" class="btn secondary-btn">Resend Email</button>
      <button id="check-verified" class="btn primary-btn" style="margin-left:10px;">I have verified (Check)</button>
      <p id="verify-msg" style="margin-top:12px;color:#333;"></p>
    </div>
  `;

  document.getElementById('resend-email').addEventListener('click', async () => {
    const cur = auth.currentUser;
    const statusEl = document.getElementById('verify-msg');
    statusEl.textContent = 'Sending verification email...';
    try {
      if (cur) {
        await cur.sendEmailVerification();
        statusEl.textContent = 'Verification email resent. Check your inbox.';
      } else {
        statusEl.textContent = 'No active session found. Log in again.';
      }
    } catch (err) {
      statusEl.textContent = 'Error: ' + (err.message || err);
    }
  });

  document.getElementById('check-verified').addEventListener('click', async () => {
    const cur = auth.currentUser;
    const statusEl = document.getElementById('verify-msg');
    statusEl.textContent = 'Checking verification...';
    try {
      if (cur) {
        await cur.reload();
        if (cur.emailVerified) {
          navigate('home');
        } else {
          statusEl.textContent = 'Email not verified yet. Please click the link in your email and then press Check.';
        }
      } else {
        statusEl.textContent = 'No active session. Please log in or register.';
      }
    } catch (err) {
      statusEl.textContent = 'Error: ' + (err.message || err);
    }
  });
}

/* Popup for prompting verification after login attempt */
function showVerificationPopup(user) {
  // Simple popup element
  const popup = document.createElement('div');
  popup.style.position = 'fixed';
  popup.style.left = '0';
  popup.style.top = '0';
  popup.style.right = '0';
  popup.style.bottom = '0';
  popup.style.background = 'rgba(0,0,0,0.45)';
  popup.style.display = 'flex';
  popup.style.alignItems = 'center';
  popup.style.justifyContent = 'center';
  popup.style.zIndex = 9999;

  const box = document.createElement('div');
  box.style.background = '#fff';
  box.style.padding = '20px';
  box.style.borderRadius = '8px';
  box.style.maxWidth = '420px';
  box.style.width = '90%';
  box.innerHTML = `
    <h3>Email Not Verified</h3>
    <p>Please verify your email to continue. Click the button below to resend the verification link.</p>
    <div style="margin-top:10px;">
      <button id="popup-resend" class="btn secondary-btn">Resend Verification Email</button>
      <button id="popup-close" class="btn primary-btn" style="margin-left:8px;">Close</button>
    </div>
    <p id="popup-msg" style="margin-top:8px;color:#333"></p>
  `;

  popup.appendChild(box);
  document.body.appendChild(popup);

  document.getElementById('popup-resend').addEventListener('click', async () => {
    const msgEl = document.getElementById('popup-msg');
    msgEl.textContent = 'Sending...';
    try {
      await user.sendEmailVerification();
      msgEl.textContent = 'Verification email sent. Check your inbox.';
    } catch (err) {
      msgEl.textContent = 'Error sending: ' + (err.message || err);
    }
  });

  document.getElementById('popup-close').addEventListener('click', () => {
    popup.remove();
  });
}

/* ------------------ Video / Home / History / Profile ------------------ */

function renderHomeScreen() {
  // build grid from loadedVideos
  const listHTML = loadedVideos.map((v, idx) => `
    <div class="video-card" data-video-index="${idx}" onclick="playLoadedVideo(${idx})">
      <img src="${v.thumbnailUrl || 'https://via.placeholder.com/250x150?text=No+Thumbnail'}" alt="${v.title}" class="video-thumbnail">
      <div class="video-title">${v.title}</div>
    </div>
  `).join('');

  const homeContent = `
    <div class="page-header"><h2>Home - Videos</h2></div>
    <div id="video-grid" class="grid-layout">${listHTML}</div>
    <div id="video-player" class="video-player-container"></div>
  `;

  renderMainLayout(homeContent);
}

function renderHistoryScreen() {
  const history = JSON.parse(localStorage.getItem('userHistory') || '[]');
  let historyList = '<p><h3>No history yet. Start watching!</h3></p>';
  if (history.length > 0) {
    historyList = '<ul class="history-list">' + history.slice().reverse().map(item =>
      `<li><strong>${item.title}</strong> - Watched on <em>${item.watchedAt}</em></li>`
    ).join('') + '</ul>';
  }

  const historyContent = `
    <div class="page-header"><h2>History</h2></div>
    ${historyList}
  `;
  renderMainLayout(historyContent);
}

function renderProfileScreen() {
  const user = auth.currentUser;
  const profileUser = user ? {
    username: user.displayName || FAKE_USER_DATA.username,
    name: user.displayName || FAKE_USER_DATA.name,
    email: user.email || FAKE_USER_DATA.email,
    joined: FAKE_USER_DATA.joined
  } : FAKE_USER_DATA;

  const profileContent = `
    <div class="page-header"><h2>Profile</h2></div>
    <table class="profile-table">
      <tr><th>Username:</th><td>${profileUser.username}</td></tr>
      <tr><th>Name:</th><td>${profileUser.name}</td></tr>
      <tr><th>Email:</th><td>${profileUser.email}</td></tr>
      <tr><th>Member Since:</th><td>${profileUser.joined}</td></tr>
    </table>
  `;
  renderMainLayout(profileContent);
}

/* Play a loaded video (object from loadedVideos) */
window.playLoadedVideo = function(index) {
  const data = loadedVideos[index];
  if (!data) return;

  // Add to history
  addToHistory(data.title);

  const playerDiv = document.getElementById('video-player');
  playerDiv.innerHTML = `
    <h3 class="player-title">Now Playing: ${data.title}</h3>
    <video controls autoplay class="video-element">
      <source src="${data.videoUrl}" type="video/mp4">
      Your browser does not support the video tag.
    </video>
    <p style="margin-top:10px;">${data.description || ''}</p>
  `;
  playerDiv.scrollIntoView({ behavior: 'smooth' });
};

/* History util */
function addToHistory(title) {
  let history = JSON.parse(localStorage.getItem('userHistory') || '[]');
  history.push({ title, watchedAt: new Date().toLocaleString() });
  localStorage.setItem('userHistory', JSON.stringify(history));
}

/* ------------------ Load videos from Firebase DB ------------------ */
/**
 * Reads /videos/* from realtime db and converts Telegram IDs to direct URLs.
 * Populates `loadedVideos`.
 */
async function loadVideosFromDb() {
  const videosRef = db.ref('videos');
  // show loading UI
  appContainer.innerHTML = `<div style="padding:30px">Loading videos...</div>`;

  videosRef.on('value', async (snap) => {
    const obj = snap.val() || {};
    const keys = Object.keys(obj);
    loadedVideos = [];

    // convert sequentially (so token is read once internally by getTelegramFileURL's helper which calls getBotTokenOnce each time)
    for (let id of keys) {
      const v = obj[id];
      const title = v.title || 'Untitled';
      const description = v.description || '';
      const thumbId = v.thumbnailId || '';
      const videoId = v.videoId || '';

      // convert to URLs (may take time)
      const [thumbUrl, videoUrl] = await Promise.all([
        thumbId ? getTelegramFileURL(thumbId) : null,
        videoId ? getTelegramFileURL(videoId) : null
      ]);

      loadedVideos.push({
        id,
        title,
        description,
        thumbnailUrl: thumbUrl,
        videoUrl: videoUrl
      });
    }

    // After load, render home
    renderHomeScreen();
  }, (err) => {
    console.error('Videos DB read error', err);
    appContainer.innerHTML = `<div style="padding:30px">Error loading videos: ${err.message || err}</div>`;
  });
}

/* ------------------ Navigation & Auth state ------------------ */
function navigate(screen) {
  const user = auth.currentUser;
  const verified = user && user.emailVerified;

  if (!verified && screen !== 'auth') {
    // Force auth if not verified
    renderAuthScreen();
    return;
  }

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
  }).catch(err => {
    console.error('Sign out error', err);
    alert('Error signing out: ' + (err.message || err));
  });
};

/* ------------------ Auth state listener & init ------------------ */
auth.onAuthStateChanged(async (user) => {
  if (user) {
    // reload to ensure emailVerified is fresh
    await user.reload();
    if (user.emailVerified) {
      // load videos once verified
      loadVideosFromDb();
    } else {
      renderEmailVerificationScreen(user.email || '');
    }
  } else {
    // not signed in
    renderAuthScreen();
  }
});

// Kick things off
document.addEventListener('DOMContentLoaded', () => {
  navigate('auth');
});
