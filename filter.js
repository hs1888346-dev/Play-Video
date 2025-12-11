// --- 🎛️ Filter Logic ---
window.generateFilters = function(videos) {
    const contentSet = new Set();
    const seasonSet = new Set();
    const episodeSet = new Set();

    videos.forEach(v => {
        const [content, season, episode] = v.description.split('/');
        contentSet.add(content);
        seasonSet.add(season);
        episodeSet.add(episode);
    });

    const contentOptions = ['All', ...[...contentSet].sort()];
    const seasonOptions = ['All', ...[...seasonSet].sort()];
    const episodeOptions = ['All', ...[...episodeSet].sort()];

    return { contentOptions, seasonOptions, episodeOptions };
}

// Populate dropdowns
window.renderFilterDropdowns = function(filters) {
    return `
        <div class="filter-container">
            <select id="filter-content">
                ${filters.contentOptions.map(c => `<option value="${c}">${c}</option>`).join('')}
            </select>
            <select id="filter-season">
                ${filters.seasonOptions.map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
            <select id="filter-episode">
                ${filters.episodeOptions.map(e => `<option value="${e}">${e}</option>`).join('')}
            </select>
        </div>
    `;
}

// Filter videos based on selected dropdown
window.applyFilters = function(videos) {
    const contentVal = document.getElementById('filter-content').value;
    const seasonVal = document.getElementById('filter-season').value;
    const episodeVal = document.getElementById('filter-episode').value;

    return videos.filter(v => {
        const [content, season, episode] = v.description.split('/');
        return (contentVal === 'All' || content === contentVal) &&
               (seasonVal === 'All' || season === seasonVal) &&
               (episodeVal === 'All' || episode === episodeVal);
    });
}
