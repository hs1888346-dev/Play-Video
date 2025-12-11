/* filter.js
   Exposes simple filter utilities on window:
   - initFilters(videos, onChangeCallback)
   - updateFiltersFromVideos(videos)
   - applyFilters(videos)
*/
(function(){
  // internal state
  let _videos = [];
  let _cb = null;

  function parseFields(video) {
    // ensure video has content/season/episode extracted
    const obj = { content: null, season: null, episode: null };
    if (!video) return obj;

    if (video.meta && typeof video.meta === 'object') {
      obj.content = video.meta.content || null;
      obj.season  = video.meta.season  || null;
      obj.episode = video.meta.episode || null;
      return obj;
    }
    // try description variations
    const desc = video.description || '';
    if (typeof desc === 'string') {
      // split by newline or '|' or '::' or ' - '
      const parts = desc.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
      if (parts.length >= 1) obj.content = parts[0];
      if (parts.length >= 2) obj.season = parts[1];
      if (parts.length >= 3) obj.episode = parts[2];
    } else if (typeof desc === 'object') {
      obj.content = desc.content || null;
      obj.season = desc.season || null;
      obj.episode = desc.episode || null;
    }
    return obj;
  }

  function buildUniqueLists(videos) {
    const contents = new Set();
    const seasonsByContent = {};
    const episodesByContentSeason = {};

    videos.forEach(v => {
      const p = parseFields(v);
      const content = p.content || (v.title || 'Unknown');
      const season = p.season || 'All Seasons';
      const episode = p.episode || 'All Episodes';

      contents.add(content);

      seasonsByContent[content] = seasonsByContent[content] || new Set();
      seasonsByContent[content].add(season);

      episodesByContentSeason[content] = episodesByContentSeason[content] || {};
      episodesByContentSeason[content][season] = episodesByContentSeason[content][season] || new Set();
      episodesByContentSeason[content][season].add(episode);

      // attach parsed meta for reuse
      v.meta = { content, season, episode };
    });

    return {
      contents: ['All'].concat(Array.from(contents)),
      seasonsByContent: Object.fromEntries(Object.entries(seasonsByContent).map(([k,s])=>[k, ['All'].concat(Array.from(s))])),
      episodesByContentSeason: Object.fromEntries(Object.entries(episodesByContentSeason).map(([k,v])=>{
        return [k, Object.fromEntries(Object.entries(v).map(([s,set])=>[s, ['All'].concat(Array.from(set))]))];
      }))
    };
  }

  function renderFilterControls(lists) {
    // ensure container exists
    let container = document.getElementById('filters-container');
    if (!container) {
      // create and insert above video grid (if exists) or at top
      container = document.createElement('div');
      container.id = 'filters-container';
      container.className = 'filters-row';
      const main = document.getElementById('main-content') || document.getElementById('app-container');
      if (main) {
        main.prepend(container);
      } else {
        document.body.prepend(container);
      }
    }
    container.innerHTML = `
      <select id="filter-content"></select>
      <select id="filter-season"></select>
      <select id="filter-episode"></select>
      <input type="text" id="filter-search" placeholder="Search title..." style="padding:10px;border-radius:8px;border:1px solid #ddd;min-width:180px;" />
    `;

    const fContent = document.getElementById('filter-content');
    const fSeason  = document.getElementById('filter-season');
    const fEpisode = document.getElementById('filter-episode');
    const fSearch  = document.getElementById('filter-search');

    function populate(selectEl, list) {
      selectEl.innerHTML = list.map(x => `<option value="${escapeHtml(x)}">${x}</option>`).join('');
    }

    populate(fContent, lists.contents);

    // initial populate for content = All
    populate(fSeason, lists.seasonsByContent['All'] || ['All']);
    populate(fEpisode, ['All']);

    // events
    fContent.addEventListener('change', () => {
      const c = fContent.value;
      const seasons = lists.seasonsByContent[c] || ['All'];
      populate(fSeason, seasons);
      // populate episodes based on first season
      const eps = lists.episodesByContentSeason[c] ? (lists.episodesByContentSeason[c][seasons[0]] || ['All']) : ['All'];
      populate(fEpisode, eps);
      triggerChange();
    });

    fSeason.addEventListener('change', () => {
      const c = fContent.value;
      const s = fSeason.value;
      const eps = (lists.episodesByContentSeason[c] && lists.episodesByContentSeason[c][s]) ? lists.episodesByContentSeason[c][s] : ['All'];
      populate(fEpisode, eps);
      triggerChange();
    });

    fEpisode.addEventListener('change', triggerChange);
    fSearch.addEventListener('input', debounce(triggerChange, 250));

    function triggerChange() {
      const filters = {
        content: fContent.value,
        season: fSeason.value,
        episode: fEpisode.value,
        search: fSearch.value.trim().toLowerCase()
      };
      if (_cb) _cb(filters);
    }
  }

  function escapeHtml(s) {
    return (s+'').replace(/[&<>"']/g, function(m){return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]);});
  }

  // Debounce helper
  function debounce(fn, wait) {
    let t;
    return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), wait); };
  }

  function applyFiltersToVideos(filters) {
    if (!filters) return _videos;
    const { content, season, episode, search } = filters;
    return _videos.filter(v => {
      const m = v.meta || {};
      if (content && content !== 'All' && m.content !== content) return false;
      if (season && season !== 'All' && m.season !== season) return false;
      if (episode && episode !== 'All' && m.episode !== episode) return false;
      if (search) {
        const combined = ((v.title||'') + ' ' + (m.content||'') + ' ' + (v.description||'')).toLowerCase();
        if (!combined.includes(search)) return false;
      }
      return true;
    });
  }

  // public API
  window.filterModule = {
    initFilters: function(videos, onChangeCallback) {
      _videos = (videos||[]).slice();
      _cb = onChangeCallback;
      const lists = buildUniqueLists(_videos);
      renderFilterControls(lists);
      // trigger initial change
      if (_cb) {
        _cb({ content: 'All', season: 'All', episode: 'All', search: '' });
      }
    },
    updateFiltersFromVideos: function(videos) {
      _videos = (videos||[]).slice();
      const lists = buildUniqueLists(_videos);
      renderFilterControls(lists);
    },
    applyFilters: function(filters) {
      return applyFiltersToVideos(filters);
    }
  };
})();
