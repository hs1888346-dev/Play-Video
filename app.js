// --- Firebase Initialization ---
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
let botToken = null;

const appContainer = document.getElementById('app-container');

// --- Auth Screen ---
function renderAuthScreen() {
    appContainer.innerHTML = `
        <div class="auth-container">
            <h2>Login</h2>
            <input type="email" id="auth-email" placeholder="Email" class="input-field">
            <input type="password" id="auth-password" placeholder="Password" class="input-field">
            <button id="auth-login" class="btn primary-btn">Login</button>
        </div>
    `;
    document.getElementById('auth-login').addEventListener('click', loginUser);
}

// --- Firebase Email Login ---
function loginUser() {
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-password').value;

    firebase.auth().signInWithEmailAndPassword(email, pass)
    .then(userCred => {
        if(userCred.user.emailVerified){
            isLoggedIn = true;
            navigate('home');
        } else {
            alert("Please verify your email first!");
            userCred.user.sendEmailVerification()
            .then(()=> alert("Verification email sent!"))
            .catch(err=> alert(err.message));
        }
    })
    .catch(err=> alert(err.message));
}

// --- Telegram URL ---
function getTelegramFileURL(filePath){
    if(!filePath || !botToken) return null;
    return `https://api.telegram.org/file/bot${botToken}/${filePath}`;
}

// --- Fetch videos ---
function fetchVideos(callback){
    // Get bot token first
    db.ref('TelegramBot').once('value').then(snap=>{
        botToken = Object.values(snap.val())[0];
        db.ref('videos').once('value').then(snap=>{
            const videos = [];
            snap.forEach(child=>{
                const val = child.val();
                videos.push({
                    videoId: val.videoId,
                    thumbnailId: val.thumbnailId,
                    title: val.title,
                    description: val.description
                });
            });
            callback(videos);
        });
    });
}

// --- Render Home ---
function renderHomeScreen() {
    fetchVideos(videos=>{
        // Sort by description
        videos.sort((a,b)=>{
            const [c1,s1,e1] = a.description.split('/');
            const [c2,s2,e2] = b.description.split('/');
            if(c1!==c2) return c1.localeCompare(c2);
            if(s1!==s2) return s1.localeCompare(s2);
            return e1.localeCompare(e2);
        });

        const videoGrid = videos.map((v,i)=>{
            const thumb = getTelegramFileURL(v.thumbnailId);
            return `
                <div class="video-card" data-index="${i}">
                    <img src="${thumb}" class="video-thumbnail">
                    <div class="video-title">${v.title}</div>
                    <div class="video-meta">${v.description.split('/').join(' | ')}</div>
                </div>
            `;
        }).join('');

        appContainer.innerHTML = `
            <div id="video-grid" class="grid-layout">${videoGrid}</div>
        `;

        // Init filters
        filterModule.initFilters(videos, (filtered)=>{
            renderFilteredVideos(filtered);
        });

        // Video click event
        document.querySelectorAll('.video-card').forEach(card=>{
            card.addEventListener('click', ()=>{
                const idx = card.dataset.index;
                playVideo(videos[idx]);
            });
        });
    });
}

// --- Filtered render ---
function renderFilteredVideos(filtered){
    const grid = document.getElementById('video-grid');
    grid.innerHTML = filtered.map((v,i)=>{
        const thumb = getTelegramFileURL(v.thumbnailId);
        return `
            <div class="video-card" data-index="${i}">
                <img src="${thumb}" class="video-thumbnail">
                <div class="video-title">${v.title}</div>
                <div class="video-meta">${v.description.split('/').join(' | ')}</div>
            </div>
        `;
    }).join('');

    // Re-attach click events
    document.querySelectorAll('.video-card').forEach((card,i)=>{
        card.addEventListener('click', ()=> playVideo(filtered[i]));
    });
}

// --- Video Play Dialog ---
function playVideo(video){
    const dialog = document.getElementById('video-dialog');
    const title = document.getElementById('player-title');
    const player = document.getElementById('player-video');

    title.textContent = video.title;
    player.src = getTelegramFileURL(video.videoId);

    dialog.classList.remove('hidden');

    document.getElementById('close-dialog').onclick = ()=>{
        dialog.classList.add('hidden');
        player.pause();
        player.src = '';
    };
}

// --- Navigation ---
function navigate(screen){
    if(!isLoggedIn) return renderAuthScreen();
    if(screen==='home') renderHomeScreen();
}

// --- Init ---
document.addEventListener('DOMContentLoaded', ()=>{
    navigate('home');
});
