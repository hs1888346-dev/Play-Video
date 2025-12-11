// ------------------ FAKE DATA / UI (unchanged mostly) ------------------

const FAKE_USER_DATA = {
    username: "user123",
    email: "test@example.com",
    name: "John Doe",
    joined: "2024-01-01"
};

const FAKE_VIDEOS_DATA = [
    { videoId: "v101", thumbnailId: "t101", title: "Video Title One" },
    { videoId: "v102", thumbnailId: "t102", title: "Exciting Video Two" },
    { videoId: "v103", thumbnailId: "t103", title: "A Third Content Piece" },
    { videoId: "v104", thumbnailId: "t104", title: "Final Video Four" },
];

let isLoggedIn = false; 

function getVideoData(index) {
    if (index >= 0 && index < FAKE_VIDEOS_DATA.length) {
        return FAKE_VIDEOS_DATA[index];
    }
    return null;
}

function getTelegramDownloadLink(fileId) {
    if (fileId.startsWith('t')) {
        return "https://via.placeholder.com/250x150?text=Telegram+Thumbnail";
    }
    return null; 
}

function addToHistory(videoTitle) {
    let history = JSON.parse(localStorage.getItem('userHistory') || '[]');
    const newEntry = { title: videoTitle, watchedAt: new Date().toLocaleString() };
    history.push(newEntry);
    localStorage.setItem('userHistory', JSON.stringify(history));
}

// ------------------ UI RENDERING ------------------

const appContainer = document.getElementById('app-container');

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
        <main id="main-content">
            ${contentHTML}
        </main>
    `;
}

function renderAuthScreen() {
    // If already logged in and email verified, go home
    const current = firebase.auth().currentUser;
    if (current && current.emailVerified) {
        isLoggedIn = true;
        return navigate('home');
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

    // Form submit - handle login or register
    document.getElementById('auth-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        const mode = e.submitter.getAttribute('data-mode');
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        const username = document.getElementById('auth-username').value;
        const msgEl = document.getElementById('auth-message');
        msgEl.textContent = '';

        try {
            if (mode === 'login') {
                // Sign in with Firebase
                const userCred = await firebase.auth().signInWithEmailAndPassword(email, password);
                const user = userCred.user;
                if (user && user.emailVerified) {
                    isLoggedIn = true;
                    navigate('home');
                } else {
                    // If not verified, show verification screen
                    renderEmailVerificationScreen(email);
                }
            } else {
                // Register new user
                const userCred = await firebase.auth().createUserWithEmailAndPassword(email, password);
                const user = userCred.user;
                // Optionally set displayName
                if (user && username) {
                    await user.updateProfile({ displayName: username });
                }
                // Send verification email
                await user.sendEmailVerification();
                renderEmailVerificationScreen(email);
            }
        } catch (err) {
            console.error(err);
            msgEl.textContent = err.message || 'Error during auth';
        }
    });

    // Toggle register/login
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

function renderEmailVerificationScreen(email) {
    appContainer.innerHTML = `
        <div class="auth-container">
            <h2>Email Verification</h2>
            <p>A verification link has been sent to <strong>${email}</strong>.</p>
            <p>Please click the link in your email to verify your account.</p>
            <button id="resend-email" class="btn secondary-btn">Resend Email</button>
            <button id="fake-verify" class="btn primary-btn" style="margin-left: 10px;">I have verified (Check)</button>
            <p id="verify-msg" style="margin-top:12px;color:#333;"></p>
        </div>
    `;

    const user = firebase.auth().currentUser;
    document.getElementById('resend-email').addEventListener('click', async () => {
        const statusEl = document.getElementById('verify-msg');
        statusEl.textContent = 'Sending verification email...';
        try {
            if (user) {
                await user.sendEmailVerification();
                statusEl.textContent = 'Verification email resent. Check your inbox.';
            } else {
                statusEl.textContent = 'No user session found. Try logging in again.';
            }
        } catch (err) {
            statusEl.textContent = 'Error: ' + (err.message || err);
        }
    });

    // Check if user has verified — attempt to reload user state
    document.getElementById('fake-verify').addEventListener('click', async () => {
        const statusEl = document.getElementById('verify-msg');
        statusEl.textContent = 'Checking...';
        try {
            const current = firebase.auth().currentUser;
            if (current) {
                await current.reload();
                if (current.emailVerified) {
                    isLoggedIn = true;
                    navigate('home');
                } else {
                    statusEl.textContent = 'Email not verified yet. Please check your email and click the verification link.';
                }
            } else {
                statusEl.textContent = 'No user session. Please log in or register.';
            }
        } catch (err) {
            statusEl.textContent = 'Error: ' + (err.message || err);
        }
    });
}

function renderHomeScreen() {
    const videoListHTML = FAKE_VIDEOS_DATA.map((video, index) => {
        const thumbnailUrl = getTelegramDownloadLink(video.thumbnailId); 
        return `
            <div class="video-card" data-video-index="${index}" onclick="playVideo(${index})">
                <img src="${thumbnailUrl}" alt="${video.title} Thumbnail" class="video-thumbnail">
                <div class="video-title">${video.title}</div>
            </div>
        `;
    }).join('');

    const homeContent = `
        <div class="page-header">
            <h2>Home - Video List</h2>
        </div>
        <div id="video-grid" class="grid-layout">
            ${videoListHTML}
        </div>
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
        <div class="page-header">
            <h2>History</h2>
        </div>
        ${historyList}
    `;
    
    renderMainLayout(historyContent);
}

function renderProfileScreen() {
    const user = firebase.auth().currentUser;
    const profileUser = user ? {
        username: user.displayName || FAKE_USER_DATA.username,
        name: user.displayName || FAKE_USER_DATA.name,
        email: user.email || FAKE_USER_DATA.email,
        joined: FAKE_USER_DATA.joined
    } : FAKE_USER_DATA;

    const profileContent = `
        <div class="page-header">
            <h2>Profile - User Details</h2>
        </div>
        <table class="profile-table">
            <tr><th>Username:</th><td>${profileUser.username}</td></tr>
            <tr><th>Name:</th><td>${profileUser.name}</td></tr>
            <tr><th>Email:</th><td>${profileUser.email}</td></tr>
            <tr><th>Member Since:</th><td>${profileUser.joined}</td></tr>
        </table>
    `;
    
    renderMainLayout(profileContent);
}

// ------------------ VIDEO PLAYBACK ------------------

window.playVideo = function(index) {
    const videoData = getVideoData(index);
    if (!videoData) return;
    
    const videoUrl = getTelegramDownloadLink(videoData.videoId);

    if (!videoUrl) {
         alert("Cannot play video: Telegram Video ID needs backend conversion to a direct URL.");
         return;
    }
    
    addToHistory(videoData.title); 

    const playerDiv = document.getElementById('video-player');
    playerDiv.innerHTML = `
        <h3 class="player-title">Now Playing: ${videoData.title}</h3>
        <video controls autoplay class="video-element">
            <source src="${videoUrl}" type="video/mp4">
            Your browser does not support the video tag.
        </video>
    `;
    playerDiv.scrollIntoView({ behavior: 'smooth' });
}

// ------------------ NAVIGATION & AUTH ------------------

function navigate(screen) {
    // If user not logged-in or not verified, force auth screen
    const current = firebase.auth().currentUser;
    const isVerified = current && current.emailVerified;
    if (!isVerified && screen !== 'auth') {
         return renderAuthScreen();
    }

    switch (screen) {
        case 'home':
            renderHomeScreen();
            break;
        case 'history':
            renderHistoryScreen();
            break;
        case 'profile':
            renderProfileScreen();
            break;
        case 'auth':
        default:
            renderAuthScreen();
            break;
    }
}

window.logout = function() {
    firebase.auth().signOut().then(() => {
        isLoggedIn = false;
        localStorage.removeItem('userHistory');
        navigate('auth');
    }).catch(err => {
        console.error('Sign out error', err);
        alert('Error signing out: ' + (err.message || err));
    });
}

// ------------------ INITIALIZATION & AUTH STATE LISTENER ------------------

document.addEventListener('DOMContentLoaded', () => {
    // Listen for auth state changes to update UI automatically
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            // If user signed in but not verified, show verification screen
            await user.reload();
            if (user.emailVerified) {
                isLoggedIn = true;
                navigate('home');
            } else {
                isLoggedIn = false;
                renderEmailVerificationScreen(user.email || '');
            }
        } else {
            isLoggedIn = false;
            navigate('auth');
        }
    });

    // Kick off initial screen
    navigate('auth');
});
