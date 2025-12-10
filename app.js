// --- ⚙️ FAKE DATA/MOCK API FUNCTIONS (Replace with your actual backend/DB calls) ---

// In a real application, you'd make fetch/axios calls to your server for these.
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
    // ... more videos
];

// Mock function to check authentication state
let isLoggedIn = false; 

// The 'db' structure you mentioned: videos/<uniqueid>/(videoId, thumbnailId, title)
// 'uniqueid' is assumed to be the index in the FAKE_VIDEOS_DATA array here for simplicity.
function getVideoData(index) {
    if (index >= 0 && index < FAKE_VIDEOS_DATA.length) {
        return FAKE_VIDEOS_DATA[index];
    }
    return null;
}

// Function to generate the Telegram download link
// **IMPORTANT**: You need to replace this with your actual logic to convert 
// Telegram File ID (thumbnailId/videoId) into a direct download URL.
function getTelegramDownloadLink(fileId) {
    // This is a PLACEHOLDER. Your backend needs to serve the file ID securely.
    // Example: return `https://yourdomain.com/api/download/${fileId}`;
    return `https://placeholder.com/download/${fileId}`; 
}

// Function to add video to history (Mock)
function addToHistory(videoTitle) {
    let history = JSON.parse(localStorage.getItem('userHistory') || '[]');
    const newEntry = { title: videoTitle, watchedAt: new Date().toLocaleString() };
    history.push(newEntry);
    localStorage.setItem('userHistory', JSON.stringify(history));
}


// --- 🖼️ UI RENDERING FUNCTIONS ---

const appContainer = document.getElementById('app-container');

// Renders the Login/Register/Email Verification screen
function renderAuthScreen() {
    appContainer.innerHTML = `
        <h2>Login / Register</h2>
        <form id="auth-form">
            <input type="email" id="auth-email" placeholder="Email" required><br>
            <input type="password" id="auth-password" placeholder="Password" required><br>
            <input type="text" id="auth-username" placeholder="Username (for register)" style="display:none;"><br>
            <button type="submit" data-mode="login">Login</button>
            <button type="button" id="toggle-register">Switch to Register</button>
        </form>
        <p id="auth-message" style="color:red;"></p>
    `;

    // Handle form submission (Login/Register)
    document.getElementById('auth-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const mode = e.submitter.getAttribute('data-mode');
        // 1. **SEND DATA TO SERVER** (Login, Register, or Email Verification)
        // 2. **IF SUCCESSFUL**:
        if (mode === 'login' || mode === 'register') {
            // Faking success and moving to verification
            renderEmailVerificationScreen('test@example.com');
        }
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


// Renders the Email Verification screen
function renderEmailVerificationScreen(email) {
    appContainer.innerHTML = `
        <h2>Email Verification</h2>
        <p>A verification link has been sent to <strong>${email}</strong>.</p>
        <p>Please click the link to verify your account.</p>
        <button id="resend-email">Resend Email</button>
        <button id="fake-verify">I have verified (Faking)</button>
    `;
    
    // In a real app, the verification link clicked by the user would change 'isLoggedIn' 
    // and then call navigate('home'). We'll fake it here.
    document.getElementById('fake-verify').addEventListener('click', () => {
        isLoggedIn = true;
        navigate('home');
    });
}


// Renders the main content (Home, History, Profile)
function renderMainLayout(contentHTML) {
    appContainer.innerHTML = `
        <header>
            <h1>Video App</h1>
            <nav>
                <button onclick="navigate('home')">🏠 Home</button>
                <button onclick="navigate('history')">📜 History</button>
                <button onclick="navigate('profile')">👤 Profile</button>
                <button onclick="logout()">👋 Logout</button>
            </nav>
        </header>
        <main id="main-content">
            ${contentHTML}
        </main>
    `;
}

// Renders the Home screen (Video List)
function renderHomeScreen() {
    let videoListHTML = FAKE_VIDEOS_DATA.map((video, index) => {
        // 1. Create Telegram Download Link for Thumbnail
        const thumbnailUrl = getTelegramDownloadLink(video.thumbnailId); 
        
        return `
            <div class="video-item" data-video-index="${index}" onclick="playVideo(${index})">
                <img src="${thumbnailUrl}" alt="Video Thumbnail" style="width:200px; height:150px; object-fit:cover;">
                <p>${video.title}</p>
            </div>
        `;
    }).join('');

    const homeContent = `
        <h2>Home - Video List</h2>
        <div id="video-grid">
            ${videoListHTML}
        </div>
        <div id="video-player" style="margin-top: 20px;"></div>
    `;
    
    renderMainLayout(homeContent);
}


// Renders the History screen
function renderHistoryScreen() {
    const history = JSON.parse(localStorage.getItem('userHistory') || '[]');
    
    let historyList = '<h3>No history yet.</h3>';
    if (history.length > 0) {
        historyList = '<ul>' + history.map(item => 
            `<li>**${item.title}** - Watched on ${item.watchedAt}</li>`
        ).join('') + '</ul>';
    }

    const historyContent = `
        <h2>History</h2>
        ${historyList}
    `;
    
    renderMainLayout(historyContent);
}


// Renders the Profile screen
function renderProfileScreen() {
    const user = FAKE_USER_DATA; // Replace with actual logged-in user data from server
    const profileContent = `
        <h2>Profile</h2>
        <table>
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
function playVideo(index) {
    const videoData = getVideoData(index);
    if (!videoData) return;
    
    // 1. Create Telegram Download Link for Video
    const videoUrl = getTelegramDownloadLink(videoData.videoId);

    // 2. Add to History
    addToHistory(videoData.title); 

    // 3. Render the Video Player
    const playerDiv = document.getElementById('video-player');
    playerDiv.innerHTML = `
        <h3>Now Playing: ${videoData.title}</h3>
        <video width="640" height="360" controls autoplay>
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
function logout() {
    isLoggedIn = false; // Clear auth state (or clear token in real app)
    localStorage.removeItem('userHistory'); // Optional: clear local data
    navigate('auth');
}

// --- 🚀 INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // Check if the user is already logged in (e.g., check for a valid token in localStorage)
    // For this example, we start with the auth screen.
    navigate('auth'); 
});

               
