// Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCh3l_nm0h0rftal0-NZH0Nl5Vuf0MU_gM",
  authDomain: "noteapp-1ad69.firebaseapp.com",
  databaseURL: "https://noteapp-1ad69-default-rtdb.firebaseio.com",
  projectId: "noteapp-1ad69",
  storageBucket: "noteapp-1ad69.appspot.com",
  messagingSenderId: "33056669455",
  appId: "1:33056669455:web:21b7f7f58847112b9a487a",
  measurementId: "G-RXS945QBFY"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let isLoggedIn = false;
let FAKE_VIDEOS_DATA = [];
let BOT_TOKEN = "";

// --- Authentication ---
function renderAuthScreen() {
    const appContainer = document.getElementById('app-container');
    appContainer.innerHTML = `
        <div class="auth-container">
            <h2>Login</h2>
            <form id="auth-form" class="form-card">
                <input type="email" id="auth-email" placeholder="Email" required class="input-field"><br>
                <input type="password" id="auth-password" placeholder="Password" required class="input-field"><br>
                <button type="submit" class="btn primary-btn">Login</button>
            </form>
            <p id="auth-message" class="error-message"></p>
        </div>
    `;

    document.getElementById('auth-form').addEventListener('submit', async e => {
        e.preventDefault();
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        try {
            const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
            if (!userCredential.user.emailVerified) {
                renderEmailVerificationScreen(email);
                return;
            }
            isLoggedIn = true;
            navigate('home');
        } catch(err) {
            document.getElementById('auth-message').innerText = err.message;
        }
    });
}

function renderEmailVerificationScreen(email) {
    const appContainer = document.getElementById('app-container');
    appContainer.innerHTML = `
        <div class="auth-container">
            <h2>Email Verification</h2>
            <p>Please verify your email: <strong>${email}</strong></p>
            <button id="resend-email" class="btn secondary-btn">Resend Email</button>
            <button id="fake-verify" class="btn primary-btn">I have verified</button>
        </div>
    `;
    document.getElementById('resend-email').addEventListener('click', async () => {
        const user = firebase.auth().currentUser;
        await user.sendEmailVerification();
        alert("Verification email sent!");
    });
    document.getElementById('fake-verify').addEventListener('click', () => {
        navigate('home');
    });
}

// --- Telegram Video URL ---
function getTelegramStreamLink(fileId) {
    return `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileId}`;
}

// --- Video Rendering ---
function renderHomeScreen() {
    const appContainer = document.getElementById('app-container');

    // Generate filters
    const filters = generateFilters(FAKE_VIDEOS_DATA);
    const filterHTML = renderFilterDropdowns(filters);

    // Render videos sorted
    const videosSorted = [...FAKE_VIDEOS_DATA].sort((a,b)=>{
        const [c1,s1,e1] = a.description.split('/');
        const [c2,s2,e2] = b.description.split('/');
        if(c1!==c2) return c1.localeCompare(c2);
        if(s1!==s2) return s1.localeCompare(s2);
        return e1.localeCompare(e2);
    });

    const videoListHTML = videosSorted.map((v, idx)=>{
        const thumbUrl = getTelegramStreamLink(v.thumbnailId);
        return `
            <div class="video-card" onclick="playVideo(${idx})">
                <img src="${thumbUrl}" alt="${v.title}" class="video-thumbnail">
                <div class="video-title">${v.title}</div>
                <div style="font-size:0.85em;color:#555;">${v.description.split('/').join('<br>')}</div>
            </div>
        `;
    }).join('');

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
        ${filterHTML}
        <div id="video-grid" class="grid-layout">
            ${videoListHTML}
        </div>

        <div class="video-dialog" id="video-dialog">
            <div class="video-dialog-content">
                <span class="video-dialog-close" onclick="closeVideo()">×</span>
                <video controls id="video-player"></video>
            </div>
        </div>
    `;

    // Filter change
    document.getElementById('filter-content').addEventListener('change',()=>applyFilterRender(videosSorted));
    document.getElementById('filter-season').addEventListener('change',()=>applyFilterRender(videosSorted));
    document.getElementById('filter-episode').addEventListener('change',()=>applyFilterRender(videosSorted));
}

function applyFilterRender(videosSorted){
    const filtered = applyFilters(videosSorted);
    const grid = document.getElementById('video-grid');
    grid.innerHTML = filtered.map((v,idx)=>{
        const thumbUrl = getTelegramStreamLink(v.thumbnailId);
        return `
            <div class="video-card" onclick="playVideo(${idx})">
                <img src="${thumbUrl}" alt="${v.title}" class="video-thumbnail">
                <div class="video-title">${v.title}</div>
                <div style="font-size:0.85em;color:#555;">${v.description.split('/').join('<br>')}</div>
            </div>
        `;
    }).join('');
}

// Play video in dialog
window.playVideo = function(index){
    const video = FAKE_VIDEOS_DATA[index];
    const videoDialog = document.getElementById('video-dialog');
    const player = document.getElementById('video-player');
    player.src = getTelegramStreamLink(video.videoId);
    videoDialog.style.display = 'flex';
    player.play();
}

window.closeVideo = function(){
    const videoDialog = document.getElementById('video-dialog');
    const player = document.getElementById('video-player');
    player.pause();
    player.src = '';
    videoDialog.style.display = 'none';
}

// --- Navigation ---
function navigate(screen){
    if(!isLoggedIn && screen!=='auth'){ renderAuthScreen(); return; }

    switch(screen){
        case 'home': renderHomeScreen(); break;
        case 'history': renderHistoryScreen(); break;
        case 'profile': renderProfileScreen(); break;
        case 'auth': renderAuthScreen(); break;
    }
}

// --- Logout ---
window.logout = function(){
    isLoggedIn = false;
    navigate('auth');
}

// --- Fetch Bot Token & Videos ---
async function fetchBotTokenAndVideos(){
    const tokenSnap = await db.ref('TelegramBot').once('value');
    BOT_TOKEN = Object.values(tokenSnap.val())[0]; 

    const videosSnap = await db.ref('videos').once('value');
    FAKE_VIDEOS_DATA = Object.values(videosSnap.val());
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async ()=>{
    await fetchBotTokenAndVideos();
    navigate('auth');
});

// --- Profile & History placeholders ---
function renderHistoryScreen(){ alert("History not implemented yet"); }
function renderProfileScreen(){ alert("Profile not implemented yet"); }
