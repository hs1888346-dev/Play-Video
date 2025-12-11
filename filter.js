// --- 🎯 FILTER MODULE ---
const filterModule = (() => {
    let videos = [];
    let callback = null;

    function initFilters(videoList, cb) {
        videos = videoList;
        callback = cb;
        renderFilters();
    }

    function renderFilters() {
        const container = document.getElementById('filters-container');
        container.innerHTML = '';

        const contentSet = new Set();
        const seasonSet = new Set();
        const episodeSet = new Set();

        videos.forEach(v=>{
            const [content, season, episode] = v.description.split('/');
            contentSet.add(content);
            seasonSet.add(season);
            episodeSet.add(episode);
        });

        const createDropdown = (label, options) => {
            const select = document.createElement('select');
            select.classList.add('filter-dropdown');
            const allOption = document.createElement('option');
            allOption.value = 'All';
            allOption.text = `All ${label}`;
            select.appendChild(allOption);
            options.forEach(opt=>{
                const option = document.createElement('option');
                option.value = opt;
                option.text = opt;
                select.appendChild(option);
            });
            return select;
        }

        const contentDropdown = createDropdown('Content', Array.from(contentSet));
        const seasonDropdown = createDropdown('Season', Array.from(seasonSet));
        const episodeDropdown = createDropdown('Episode', Array.from(episodeSet));

        container.appendChild(contentDropdown);
        container.appendChild(seasonDropdown);
        container.appendChild(episodeDropdown);

        [contentDropdown, seasonDropdown, episodeDropdown].forEach(drop=>{
            drop.addEventListener('change', applyFilters);
        });
    }

    function applyFilters() {
        const selects = document.querySelectorAll('.filter-dropdown');
        const [contentSel, seasonSel, episodeSel] = selects;

        let filtered = videos.filter(v=>{
            const [content, season, episode] = v.description.split('/');
            return (contentSel.value==='All' || contentSel.value===content)
                && (seasonSel.value==='All' || seasonSel.value===season)
                && (episodeSel.value==='All' || episodeSel.value===episode);
        });

        if(callback) callback(filtered);
    }

    return { initFilters };
})();
