// --- ⚙️ FAKE DATA/MOCK API FUNCTIONS ---

const FAKE_USER_DATA = {
    username: "user123",
    email: "test@example.com",
    name: "John Doe",
    joined: "2024-01-01"
};

// Updated to have multiple videos for proper list testing
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

// Function to generate the Telegram download link (CRITICAL: Needs backend)
function getTelegramDownloadLink(fileId) {
    // 🛑 IMPORTANT: This URL must point to YOUR SERVER endpoint (e.g., Node.js/Python server)
    // YOUR SERVER will use the Telegram Bot API to convert the File ID (t101, v101) 
    // into a streamable URL.

    // Placeholder URL for demonstration. Replace with your actual API endpoint:
    // return `https://your-backend.com/api/getfile/${fileId}`;

    // --- TEMPORARY FIX: Showing a Placeholder image for UI testing ---
    if (fileId.startsWith('t')) {
        return "https://via.placeholder.com/250x150?text=Telegram+Thumbnail";
    }
    // For video, we need a real link, or it won't play. Returning null will trigger an alert.
    return null; 
}

function addToHistory(videoTitle) {
    let history = JSON.parse(localStorage.getItem('userHistory') || '[]');
    const newEntry = { title: videoTitle, watchedAt: new Date().toLocaleString() };
    history.push(newEntry);
    localStorage.setItem('userHistory', JSON.stringify(history));
}


// --- 🖼️ UI RENDERING FUNCTIONS ---

const appContainer = document.getElementById('app-container');

// Renders the main structure with navigation
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
    appContainer.innerHTML = `
        <div class="auth-container">
            <h2>Login / Register / Email Verification</h2>
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

    // Handle form submission (Login/Register)
    document.getElementById('auth-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const mode = e.submitter.getAttribute('data-mode');
        // In a real app, send data to server here.
        
        // Faking success and moving to verification
        const email = document.getElementById('auth-email').value;
        renderEmailVerificationScreen(email);
    });

    // Handle switching between Login and Register
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
            <p>Please click the link to verify your account.</p>
            <button id="resend-email" class="btn secondary-btn">Resend Email</button>
            <button id="fake-verify" class="btn primary-btn" style="margin-left: 10px;">I have verified (Faking)</button>
        </div>
    `;
    
    // Faking verification success to proceed to Home
    document.getElementById('fake-verify').addEventListener('click', () => {
        isLoggedIn = true;
        navigate('home');
    });
}


// Renders the Home screen (Video List) - FIXED LISTING
function renderHomeScreen() {
    const videoListHTML = FAKE_VIDEOS_DATA.map((video, index) => {
        // 1. Create Telegram Download Link for Thumbnail (Placeholder used)
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
        // Reverse history so latest video is at the top
        historyList = '<ul class="history-list">' + history.reverse().map(item => 
            `<li>**${item.title}** - Watched on <em>${item.watchedAt}</em></li>`
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
    const user = FAKE_USER_DATA; // Replace with actual logged-in user data from server
    const profileContent = `
        <div class="page-header">
            <h2>Profile - User Details</h2>
        </div>
        <table class="profile-table">
            <tr><th>Username:</th><td>${user.username}</td></tr>
            <tr><th>Name:</th><td>${user.name}</td></tr>
            <tr><th>Email:</th><td>${user.email}</td></tr>
            <tr><th>Member Since:</th><td>${user.joined}</td></tr>
        </table>
    `;
    
    renderMainLayout(profileContent);
}


// --- 🎬 VIDEO PLAYBACK AND NAVIGATION ---

// Function to handle video play
window.playVideo = function(index) {
    const videoData = getVideoData(index);
    if (!videoData) return;
    
    // 1. IMPORTANT: Get the actual video stream URL
    const videoUrl = getTelegramDownloadLink(videoData.videoId);

    if (!videoUrl) {
         // Since we are using a placeholder, this alert will show. 
         alert("Cannot play video: Telegram Video ID needs to be converted to a direct URL by your backend server.");
         return;
    }
    
    // 2. Add to History
    addToHistory(videoData.title); 

    // 3. Render the Video Player
    const playerDiv = document.getElementById('video-player');
    playerDiv.innerHTML = `
        <h3 class="player-title">Now Playing: ${videoData.title}</h3>
        <video controls autoplay class="video-element">
            <source src="${videoUrl}" type="video/mp4">
            Your browser does not support the video tag.
        </video>
    `;
    // Scroll to the player
    playerDiv.scrollIntoView({ behavior: 'smooth' });
}


// Main router/navigation function
function navigate(screen) {
    if (!isLoggedIn) {
        if (screen !== 'auth') {
             // If not logged in, force authentication screen
             return renderAuthScreen(); 
        }
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

// Logout function
window.logout = function() {
    isLoggedIn = false; 
    localStorage.removeItem('userHistory'); 
    navigate('auth');
}

// --- 🚀 INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // Start with the authentication screen
    navigate('auth'); 
});
