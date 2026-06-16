// ─── PLACEHOLDER → REAL TEAM MAPPING ────────────────────────────────────────
const PLACEHOLDER_MAP = {
  "UEFA Path A winner": "Bosnia & Herz.",
  "UEFA Path B winner": "Sweden",
  "UEFA Path C winner": "Türkiye",
  "UEFA Path D winner": "Czechia",
  "IC Path 1 winner":   "DR Congo",
  "IC Path 2 winner":   "Iraq"
};

function resolveName(name) {
  return PLACEHOLDER_MAP[name] || name;
}

// ─── FLAGS ───────────────────────────────────────────────────────────────────
const FLAGS = {
  "Mexico":"🇲🇽","South Africa":"🇿🇦","South Korea":"🇰🇷","Czechia":"🇨🇿",
  "Canada":"🇨🇦","Bosnia & Herz.":"🇧🇦","Qatar":"🇶🇦","Switzerland":"🇨🇭",
  "Brazil":"🇧🇷","Morocco":"🇲🇦","Haiti":"🇭🇹","Scotland":"🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  "USA":"🇺🇸","Paraguay":"🇵🇾","Australia":"🇦🇺","Türkiye":"🇹🇷",
  "Germany":"🇩🇪","Curaçao":"🇨🇼","Ivory Coast":"🇨🇮","Ecuador":"🇪🇨",
  "Netherlands":"🇳🇱","Japan":"🇯🇵","Sweden":"🇸🇪","Tunisia":"🇹🇳",
  "Belgium":"🇧🇪","Egypt":"🇪🇬","Iran":"🇮🇷","New Zealand":"🇳🇿",
  "Spain":"🇪🇸","Cape Verde":"🇨🇻","Saudi Arabia":"🇸🇦","Uruguay":"🇺🇾",
  "France":"🇫🇷","Senegal":"🇸🇳","Iraq":"🇮🇶","Norway":"🇳🇴",
  "Argentina":"🇦🇷","Algeria":"🇩🇿","Austria":"🇦🇹","Jordan":"🇯🇴",
  "Portugal":"🇵🇹","Uzbekistan":"🇺🇿","Colombia":"🇨🇴","DR Congo":"🇨🇩",
  "England":"🏴󠁧󠁢󠁥󠁮󠁧󠁿","Croatia":"🇭🇷","Ghana":"🇬🇭","Panama":"🇵🇦",
  "Czech Republic":"🇨🇿"
};
function flag(n) { return FLAGS[n] || "🏳"; }

// ─── TIME CONVERSION ─────────────────────────────────────────────────────────
// Parses "13:00 UTC-6" on date "2026-06-11" → converts to Stockholm (Europe/Stockholm)
// Returns { time: "22:00", date: "2026-06-12" } (date may shift if crossing midnight)
function toStockholm(dateStr, timeStr) {
  if (!dateStr || !timeStr) return { time: timeStr || '', date: dateStr || '' };

  try {
    // Parse "13:00 UTC-6" → hours=13, mins=0, offsetHours=-6
    const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*UTC([+-]\d+(?:\.\d+)?)?$/i);
    if (!match) return { time: timeStr, date: dateStr };

    const localH   = parseInt(match[1], 10);
    const localM   = parseInt(match[2], 10);
    const offset   = match[3] !== undefined ? parseFloat(match[3]) : 0; // e.g. -6

    // Convert to UTC: subtract the offset
    // e.g. 13:00 UTC-6  →  13 - (-6) = 19:00 UTC
    const totalUTCMinutes = localH * 60 + localM - offset * 60;

    // Build a UTC Date object from the match date + UTC time
    // We treat dateStr as the LOCAL date at that venue, but since we've derived
    // the UTC minute-of-day we can construct it directly.
    const [year, month, day] = dateStr.split('-').map(Number);

    // Start from midnight UTC of the match date, add UTC minutes
    const utcMs = Date.UTC(year, month - 1, day) + totalUTCMinutes * 60000;
    const utcDate = new Date(utcMs);

    // Format in Stockholm timezone
    const sweTime = utcDate.toLocaleTimeString('sv-SE', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Stockholm'
    });

    const sweDate = utcDate.toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Europe/Stockholm'
    }); // returns "2026-06-12" format

    return { time: sweTime, date: sweDate };
  } catch (e) {
    return { time: timeStr, date: dateStr };
  }
}

// ─── COOKIES ─────────────────────────────────────────────────────────────────
function setCookie(n, v, d) {
  const exp = new Date();
  exp.setTime(exp.getTime() + d * 864e5);
  document.cookie = `${n}=${encodeURIComponent(v)};expires=${exp.toUTCString()};path=/;SameSite=Lax`;
}
function getCookie(n) {
  const m = document.cookie.match(new RegExp('(^| )' + n + '=([^;]+)'));
  return m ? decodeURIComponent(m[2]) : null;
}
function saveFavs() {
  setCookie('wc26_favs', JSON.stringify([...favTeams]), 365);
  showToast('🍪 Favourites saved');
}
function loadFavs() {
  try { const r = getCookie('wc26_favs'); return r ? new Set(JSON.parse(r)) : new Set(); }
  catch(e) { return new Set(); }
}

// ─── STATE ────────────────────────────────────────────────────────────────────
let favTeams = loadFavs();
let currentView = 'all';
let filterRound = '';
let searchText = '';
let allMatches = [];   // fetched + placeholder-resolved + time-converted
let teamsGroups = {};  // team -> group

// ─── FETCH FROM openfootball ─────────────────────────────────────────────────
const API_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';

function setApiStatus(state, msg) {
  const el = document.getElementById('api-status');
  el.className = 'api-status ' + state;
  document.getElementById('api-status-text').textContent = msg;
}

async function fetchMatches() {
  setApiStatus('loading', 'Fetching live data…');
  document.getElementById('refresh-btn').textContent = '⟳ Refreshing…';
  try {
    const res = await fetch(API_URL + '?t=' + Date.now());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();

  allMatches = data.matches.map(m => {
  const team1 = resolveName(m.team1);
  const team2 = resolveName(m.team2);
  const swe = toStockholm(m.date, m.time);

  // raw feed nests the final score: score.ft = [home, away]
  const ft = m.score && m.score.ft;

  return {
    ...m,
    team1,
    team2,
    date: swe.date,
    time: swe.time,
    timeRaw: m.time,
    score1: ft ? ft[0] : null,
    score2: ft ? ft[1] : null
    // goals1 / goals2 already pass through unchanged via ...m
  };
});

    // Build team→group map
    teamsGroups = {};
    allMatches.forEach(m => {
      if (m.group) {
        [m.team1, m.team2].forEach(t => {
          if (!isPlaceholder(t)) teamsGroups[t] = m.group;
        });
      }
    });

    setApiStatus('ok', 'Live data — openfootball.github.io');
    render();
    renderSidebar();
  } catch(err) {
    setApiStatus('err', 'Fetch failed — showing cached data');
    allMatches = SEED_MATCHES;
    teamsGroups = {};
    allMatches.forEach(m => {
      if (m.group) [m.team1, m.team2].forEach(t => { if (!isPlaceholder(t)) teamsGroups[t] = m.group; });
    });
    render();
    renderSidebar();
  }
  document.getElementById('refresh-btn').textContent = '⟳ Refresh scores';
}

function isPlaceholder(name) {
  return !name || name.startsWith('W') || name.startsWith('L') || /^\d[A-Z]$/.test(name) || name.includes('/');
}

// ─── STATUS HELPERS ───────────────────────────────────────────────────────────
// m.date is now in Stockholm timezone, so compare against Stockholm "today"
function getStockholmToday() {
  const d = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
  return d; // "2026-06-14"
}

function getStatus(m) {
  const today = getStockholmToday();
  if (m.score1 != null) return 'ft';
  if (m.date < today)   return 'ft';
  if (m.date === today) return 'today';
  return 'upcoming';
}

function fmtDate(d) {
  // d is already a Stockholm-adjusted date string "YYYY-MM-DD"
  const [year, month, day] = d.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC'
  });
}

function isFav(m) { return favTeams.has(m.team1) || favTeams.has(m.team2); }
function isKO(r)  {
  return ['Round of 32','Round of 16','Quarter-final','Semi-final','Match for third place','Final'].includes(r);
}

// ─── SIDEBAR ─────────────────────────────────────────────────────────────────
function renderSidebar() {
  const byGroup = {};
  Object.entries(teamsGroups).forEach(([team, grp]) => {
    if (!byGroup[grp]) byGroup[grp] = [];
    if (!byGroup[grp].includes(team)) byGroup[grp].push(team);
  });

  const groupKeys = Object.keys(byGroup).sort();
  let html = '';
  groupKeys.forEach(g => {
    html += `<div class="group-label">${g}</div><div class="team-grid">`;
    byGroup[g].sort().forEach(team => {
      const sel = favTeams.has(team);
      html += `<button class="team-btn${sel?' selected':''}" data-team="${team}">
        <span class="team-flag">${flag(team)}</span>
        <span class="team-name">${team}</span>
        <span class="team-check"></span>
      </button>`;
    });
    html += '</div>';
  });

  document.getElementById('team-list').innerHTML = html;
  const n = favTeams.size;
  document.getElementById('fav-count-label').innerHTML =
    n > 0 ? `<b>${n}</b> team${n===1?'':'s'} selected` : 'Select teams to filter your schedule';
  document.getElementById('hd-favs').textContent = n;
}

// ─── MAIN RENDER ──────────────────────────────────────────────────────────────
function render() {
  if (!allMatches.length) return;
  const today = getStockholmToday();

  let live=0, upcoming=0, played=0;
  allMatches.forEach(m => {
    const s = getStatus(m);
    if (s==='ft') played++;
    else upcoming++;
  });
  document.getElementById('hd-live').textContent = live;
  document.getElementById('hd-upcoming').textContent = upcoming;
  document.getElementById('hd-played').textContent = played;

  let matches = [...allMatches];

  if (currentView === 'favs') {
    if (favTeams.size === 0) {
      document.getElementById('matches-output').innerHTML = `
        <div class="empty-state"><div class="big">⭐</div>
        <h3>No favourite teams yet</h3>
        <p>Pick teams from the left panel to see only their matches.</p></div>`;
      document.getElementById('result-count').innerHTML = '';
      return;
    }
    matches = matches.filter(isFav);
  }

  if (filterRound) {
    if (filterRound === 'group') matches = matches.filter(m => !!m.group);
    else matches = matches.filter(m => m.round === filterRound);
  }

  if (searchText) {
    const q = searchText.toLowerCase();
    matches = matches.filter(m =>
      m.team1.toLowerCase().includes(q) ||
      m.team2.toLowerCase().includes(q) ||
      (m.ground||'').toLowerCase().includes(q) ||
      (m.group||'').toLowerCase().includes(q)
    );
  }

  if (!matches.length) {
    document.getElementById('matches-output').innerHTML = `
      <div class="empty-state"><div class="big">🔍</div>
      <h3>No matches found</h3><p>Try adjusting your filters or search.</p></div>`;
    document.getElementById('result-count').innerHTML = '';
    return;
  }

  document.getElementById('result-count').innerHTML = `<b>${matches.length}</b> match${matches.length===1?'':'es'}`;

  const ROUND_ORDER = [
    'Matchday 1','Matchday 2','Matchday 3','Matchday 4','Matchday 5',
    'Matchday 6','Matchday 7','Matchday 8','Matchday 9','Matchday 10',
    'Matchday 11','Matchday 12','Matchday 13','Matchday 14','Matchday 15',
    'Matchday 16','Matchday 17',
    'Round of 32','Round of 16','Quarter-final','Semi-final','Match for third place','Final'
  ];

  const byRound = {};
  matches.forEach(m => {
    if (!byRound[m.round]) byRound[m.round] = [];
    byRound[m.round].push(m);
  });

  let html = '';
  ROUND_ORDER.filter(r => byRound[r]).forEach(round => {
    const ms = byRound[round];
    const ko = isKO(round);
    html += `<div class="round-group">
      <div class="round-header">${ko?'⚡':'🏟️'} ${round} <span class="round-count">${ms.length} match${ms.length===1?'':'es'}</span></div>
      <div class="matches-grid">`;
    ms.forEach(m => html += matchCard(m));
    html += '</div></div>';
  });

  document.getElementById('matches-output').innerHTML = html;
}

function matchCard(m) {
  const st  = getStatus(m);
  const fav = isFav(m);
  const ko  = isKO(m.round);
  const t = m.time || '';

  let scoreHtml;
  if (m.score1 != null) {
    scoreHtml = `<div class="score-block">
      <span class="score-num">${m.score1}</span>
      <span class="score-dash">-</span>
      <span class="score-num">${m.score2}</span></div>`;
  } else {
    scoreHtml = `<div class="score-block tbd">
      <span class="score-num">-</span>
      <span class="score-dash">v</span>
      <span class="score-num">-</span></div>`;
  }

  const badges = {
    live:    '<span class="status-badge live">● Live</span>',
    ft:      '<span class="status-badge ft">FT</span>',
    today:   '<span class="status-badge today">Today</span>',
    upcoming:'<span class="status-badge soon">📅</span>'
  };

  const badge = m.group
    ? `<span class="match-badge group">${m.group}</span>`
    : `<span class="match-badge knockout">${m.round}</span>`;

  const scorers = arr => (arr || [])
    .map(g => `<div class="goal-entry">⚽ ${g.name} <span class="goal-min">${g.minute}'</span></div>`)
    .join('');
  const hasGoals = (m.goals1 && m.goals1.length) || (m.goals2 && m.goals2.length);
  const goalsHtml = hasGoals ? `
    <div class="match-goals">
      <div class="goals-col">${scorers(m.goals1)}</div>
      <div class="goals-col right">${scorers(m.goals2)}</div>
    </div>` : '';

  return `<div class="match-card${fav?' favorite':''}" data-team1="${m.team1}" data-team2="${m.team2}" style="cursor: pointer;">
    <div class="match-meta">
      <span class="match-date">${fmtDate(m.date)}</span>
      ${badge}
    </div>
    <div class="match-body">
      <div class="team-side">
        <span class="team-emoji">${flag(m.team1)}</span>
        <span class="team-label">${m.team1}</span>
      </div>
      ${scoreHtml}
      <div class="team-side right">
        <span class="team-emoji">${flag(m.team2)}</span>
        <span class="team-label">${m.team2}</span>
      </div>
    </div>
    ${goalsHtml}
    <div class="match-footer">
      <span class="venue-info">📍 ${m.ground||'—'}</span>
      <span class="match-time">${t ? t + ' CEST' : ''}</span>
      ${badges[st]||''}
    </div>
  </div>`;
}

// ─── EVENTS ──────────────────────────────────────────────────────────────────
document.getElementById('team-list').addEventListener('click', e => {
  const btn = e.target.closest('.team-btn');
  if (!btn) return;
  const team = btn.dataset.team;
  if (favTeams.has(team)) favTeams.delete(team); else favTeams.add(team);
  saveFavs();
  renderSidebar();
  render();
});

document.getElementById('btn-clear').addEventListener('click', () => {
  favTeams.clear(); saveFavs(); renderSidebar(); render();
});

document.getElementById('btn-my-matches').addEventListener('click', () => {
  currentView = 'favs';
  document.querySelectorAll('.view-tab').forEach(t => t.classList.remove('active'));
  document.querySelector('[data-view="favs"]').classList.add('active');
  render();
});

document.querySelectorAll('.view-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    currentView = tab.dataset.view;
    document.querySelectorAll('.view-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    render();
  });
});

document.getElementById('filter-round').addEventListener('change', e => {
  filterRound = e.target.value; render();
});

document.getElementById('search-box').addEventListener('input', e => {
  searchText = e.target.value.trim(); render();
});

document.getElementById('refresh-btn').addEventListener('click', fetchMatches);

document.getElementById('sidebar-team-search').addEventListener('input', e => {
  const term = e.target.value.toLowerCase();

  document.querySelectorAll('.team-btn').forEach(btn => {
    const match = btn.dataset.team.toLowerCase().includes(term);
    btn.style.display = match ? 'flex' : 'none';
  });

  // Hide both the label AND its grid together so no gap appears
  document.querySelectorAll('.group-label').forEach(label => {
    const grid = label.nextElementSibling;
    const hasVisible = grid && Array.from(grid.children).some(b => b.style.display !== 'none');
    label.style.display = hasVisible ? '' : 'none';
    if (grid) grid.style.display = hasVisible ? '' : 'none';
  });

  // Scroll the team list back to top so results always start at the top
  document.getElementById('team-list').scrollTop = 0;
});

// ─── MODAL ───────────────────────────────────────────────────────────────────
const modal = document.getElementById('match-modal');
const closeModalBtn = document.getElementById('close-modal');

closeModalBtn.addEventListener('click', () => modal.classList.remove('open'));
modal.addEventListener('click', e => {
  if (e.target === modal) modal.classList.remove('open');
});

document.getElementById('matches-output').addEventListener('click', e => {
  const card = e.target.closest('.match-card');
  if (!card) return;

  const t1 = card.dataset.team1;
  const t2 = card.dataset.team2;
  const container = document.getElementById('modal-teams-container');
  container.innerHTML = '';

  if (isPlaceholder(t1) && isPlaceholder(t2)) {
    container.innerHTML = '<div class="modal-team-row"><div class="modal-team-row-name" style="text-align: center; width: 100%;">Teams not yet decided</div></div>';
  } else {
    [t1, t2].forEach(team => {
      if (isPlaceholder(team)) return;
      const isFaved = favTeams.has(team);
      const row = document.createElement('div');
      row.className = `modal-team-row ${isFaved ? 'is-fav' : ''}`;
      row.innerHTML = `
        <span class="modal-team-row-flag">${flag(team)}</span>
        <div class="modal-team-row-name">${team}</div>
        <button class="fav-toggle ${isFaved ? 'active' : ''}" data-team="${team}">
          ${isFaved ? '⭐ Added' : '☆ Add to list'}
        </button>
      `;
      container.appendChild(row);
    });
  }

  modal.classList.add('open');
});

document.getElementById('modal-teams-container').addEventListener('click', e => {
  const btn = e.target.closest('.fav-toggle');
  if (!btn) return;
  const team = btn.dataset.team;
  if (favTeams.has(team)) {
    favTeams.delete(team);
  } else {
    favTeams.add(team);
  }
  saveFavs();
  renderSidebar();
  render();
  const isFaved = favTeams.has(team);
  btn.className = `fav-toggle ${isFaved ? 'active' : ''}`;
  btn.textContent = isFaved ? '⭐ Added' : '☆ Add to list';
  btn.parentElement.className = `modal-team-row ${isFaved ? 'is-fav' : ''}`;
});

// ─── TOAST ───────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// ─── HAMBURGER SIDEBAR ───────────────────────────────────────────────────────
const sidebar        = document.getElementById('sidebar');
const hamburgerBtn   = document.getElementById('hamburger-btn');
const sidebarClose   = document.getElementById('sidebar-close');
const sidebarOverlay = document.getElementById('sidebar-overlay');

function openSidebar() {
  sidebar.classList.add('open');
  sidebarOverlay.classList.add('visible');
  hamburgerBtn.setAttribute('aria-expanded', 'true');
  hamburgerBtn.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeSidebar() {
  sidebar.classList.remove('open');
  sidebarOverlay.classList.remove('visible');
  hamburgerBtn.setAttribute('aria-expanded', 'false');
  hamburgerBtn.classList.remove('active');
  document.body.style.overflow = '';
}

hamburgerBtn.addEventListener('click', () => {
  sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
});
sidebarClose.addEventListener('click', closeSidebar);
sidebarOverlay.addEventListener('click', closeSidebar);

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeSidebar();
});

// ─── AUTO REFRESH EVERY 5 MIN ────────────────────────────────────────────────
setInterval(fetchMatches, 5 * 60 * 1000);

// ─── INIT ────────────────────────────────────────────────────────────────────
fetchMatches();