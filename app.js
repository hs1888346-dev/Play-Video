/**********************************
  APP.JS — FIXED VERSION
**********************************/

const BOT_TOKEN = "YOUR_TELEGRAM_BOT_TOKEN";  // ← यहाँ अपना Bot Token डालो

function buildVideoUrl(fileId) {
    return fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`)
      .then(r => r.json())
      .then(d => {
        if (!d.ok || !d.result.file_path) throw new Error("Invalid file_id");
        return `https://api.telegram.org/file/bot${BOT_TOKEN}/${d.result.file_path}`;
      });
}

function renderApp(user) {
    const app = document.getElementById("main-content");

    app.innerHTML = `
      <header>
        <h1>All Videos</h1>
        <nav>
          <button id="logout-btn" class="btn secondary-btn">Logout</button>
        </nav>
      </header>

      <div id="videos-grid" class="grid-layout"></div>
    `;

    document.getElementById("logout-btn").onclick = () => firebase.auth().signOut();

    loadVideos();
}

function loadVideos() {
    const ref = firebase.database().ref("videos");
    ref.on("value", snap => {
        const data = snap.val() || {};
        let videos = Object.values(data);

        videos.forEach(v => {
            if (!v.id) v.id = Math.random().toString(36).substr(2,8);
        });

        videos.forEach(v => {
            if (!v.meta) {
                const desc = v.description || "";
                const parts = desc.split("/");
                v.meta = {
                    content: parts[0] || "Unknown",
                    season: parts[1] || "S0",
                    episode: parts[2] || "E0"
                };
            }
        });

        videos.sort((a,b)=>{
          const A = a.meta || {};
          const B = b.meta || {};

          const sA = parseInt((A.season||"").replace(/\D/g,'')) || 0;
          const sB = parseInt((B.season||"").replace(/\D/g,'')) || 0;

          const eA = parseInt((A.episode||"").replace(/\D/g,'')) || 0;
          const eB = parseInt((B.episode||"").replace(/\D/g,'')) || 0;

          if (A.content !== B.content) return (A.content||"").localeCompare(B.content||"");
          if (sA !== sB) return sA - sB;
          return eA - eB;
        });

        filterModule.initFilters(videos, filters => {
            const filtered = filterModule.applyFilters(filters);
            displayVideos(filtered);
        });
    });
}

function displayVideos(videos) {
    const grid = document.getElementById("videos-grid");
    grid.innerHTML = "";

    videos.forEach(video => {
        const card = document.createElement("div");
        card.className = "video-card";

        const thumb = video.thumbnailId
            ? `https://api.telegram.org/file/bot${BOT_TOKEN}/${video.thumbnailId}`
            : "";

        card.innerHTML = `
          <img class="video-thumbnail" src="${thumb}" />
          <div class="video-title">${video.title || "Untitled"}</div>
        `;

        card.onclick = () => openVideoPlayer(video);
        grid.appendChild(card);
    });
}

function openVideoPlayer(video) {
    const backdrop = document.getElementById("bs-backdrop");
    const sheet = document.getElementById("bs-sheet");
    const wrap = document.getElementById("bs-player-wrap");

    document.getElementById("bs-title").textContent = video.title;
    document.getElementById("bs-meta").textContent =
      `${video.meta.content} — ${video.meta.season} — ${video.meta.episode}`;

    wrap.innerHTML = `<div>Loading video...</div>`;

    backdrop.style.display = "flex";

    setTimeout(() => sheet.classList.add("open"), 20);

    buildVideoUrl(video.videoId).then(url => {
        wrap.innerHTML = `
          <video class="video-element" controls autoplay src="${url}"></video>
        `;
    });
}

document.getElementById("bs-close").onclick = closeSheet;
document.getElementById("bs-backdrop").onclick = e => {
    if (e.target.id === "bs-backdrop") closeSheet();
};

function closeSheet() {
    const sheet = document.getElementById("bs-sheet");
    const backdrop = document.getElementById("bs-backdrop");

    sheet.classList.remove("open");
    setTimeout(() => { backdrop.style.display = "none"; }, 300);
}

firebase.auth().onAuthStateChanged(user => {
    if (user) renderApp(user);
    else document.getElementById("main-content").innerHTML = "Not logged in";
});
