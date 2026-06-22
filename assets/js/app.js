const channels = Array.isArray(window.BK16_CHANNELS) ? window.BK16_CHANNELS : [];
const config = window.BK16_CONFIG || {};

const $ = (selector) => document.querySelector(selector);
const video = $('#v');
const grid = $('#grid-sports');
const statusBox = $('#status');
const featuredLogo = $('#featuredLogo');
const featuredName = $('#featuredName');
const lastUpdated = $('#lastUpdated');
const tabChannels = $('#tabChannels');
const tabSchedule = $('#tabSchedule');
const channelsPanel = $('#channelsPanel');
const schedulePanel = $('#schedulePanel');
const scheduleList = $('#scheduleList');
const scheduleDateLabel = $('#scheduleDateLabel');
const scheduleCount = $('#scheduleCount');
const scheduleUpdated = $('#scheduleUpdated');
const scheduleSource = $('#scheduleSource');
const refreshSchedule = $('#refreshSchedule');

const playerModal = $('#playerModal');
const modalLogo = $('#modalLogo');
const modalName = $('#modalName');
const modalNote = $('#modalNote');
const closeModal = $('#closeModal');
const nonIosButtons = $('#nonIosButtons');
const iosButtons = $('#iosButtons');
const btnMobilePlayer = $('#btnMobilePlayer');
const btnOpenTab = $('#btnOpenTab');
const btnIOSTab = $('#btnIOSTab');
const btnVLC = $('#btnVLC');
const btnLiftplay = $('#btnLiftplay');
const btnInfuse = $('#btnInfuse');
const btnNPlayer = $('#btnNPlayer');

let hls = null;
let selectedChannel = null;
let activeKey = null;
let playToken = 0;
let fallbackTimer = null;
let scheduleTimer = null;

const isAndroid = () => /Android/i.test(navigator.userAgent);
const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isDesktop = () => !isAndroid() && !isIOS();
const isHls = (url) => /\.m3u8(?:$|\?)/i.test(url || '');

function escapeHtml(value='') {
  return String(value)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#039;');
}

function setStatus(message, type='normal') {
  if (!statusBox) return;
  statusBox.textContent = message;
  statusBox.classList.toggle('bad', type === 'bad');
  statusBox.classList.toggle('ok', type === 'ok');
}

function getGroup(channel={}) {
  const text = `${channel.name || ''} ${channel.id || ''}`.toLowerCase();
  if (text.includes('world cup') || text.includes('fifa')) return 'FIFA / World Cup';
  if (text.includes('mono')) return 'MonoMax';
  if (text.includes('bein')) return 'beIN Sports';
  if (text.includes('true') || text.includes('spotv')) return 'True / SPOTV';
  if (text.includes('red bull')) return 'Red Bull TV';
  if (text.includes('fox')) return 'Fox Sports';
  return 'Sports Channel';
}

function normalizedChannels() {
  return channels.map((channel,index) => ({
    ...channel,
    _key:`${channel.id || 'channel'}-${index}`,
    _group:getGroup(channel)
  }));
}

function updateNowPlaying(channel) {
  selectedChannel = channel;
  if (featuredLogo) {
    featuredLogo.src = channel.logo || '';
    featuredLogo.alt = channel.name || '';
  }
  if (featuredName) featuredName.textContent = channel.name || 'IPTV by BK-16';
}

function setActive(key) {
  activeKey = key;
  document.querySelectorAll('.channel-card').forEach(card => {
    card.classList.toggle('active', card.dataset.key === key);
  });
}

function renderChannels() {
  if (!grid) return;
  const list = normalizedChannels();
  grid.innerHTML = '';

  if (!list.length) {
    grid.innerHTML = '<div class="empty">ยังไม่มีรายการช่องในระบบ</div>';
    return;
  }

  list.forEach(channel => {
    const card = document.createElement('article');
    card.className = 'channel-card';
    card.dataset.key = channel._key;
    card.tabIndex = 0;
    card.setAttribute('role','button');
    card.setAttribute('aria-label',`เล่น ${channel.name}`);
    card.innerHTML = `
      <span class="on-air-badge">ON AIR</span>
      <div class="logo-box">
        <img loading="lazy" src="${escapeHtml(channel.logo)}" alt="${escapeHtml(channel.name)}">
      </div>
      <div class="channel-meta">
        <div class="channel-name">${escapeHtml(channel.name)}</div>
      </div>
    `;
    const choose = () => {
      playChannel(channel);
      requestAnimationFrame(() => {
        $('.hero')?.scrollIntoView({behavior:'smooth',block:'start'});
      });
    };
    card.addEventListener('click',choose);
    card.addEventListener('keydown',event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        choose();
      }
    });
    grid.appendChild(card);
  });

  if (activeKey) setActive(activeKey);
}

function clearFallbackTimer() {
  if (fallbackTimer) clearTimeout(fallbackTimer);
  fallbackTimer = null;
}

function stopStream() {
  clearFallbackTimer();
  if (hls) {
    hls.destroy();
    hls = null;
  }
  video?.pause();
  video?.removeAttribute('src');
  video?.load();
}

function openExternal(channel) {
  if (!channel) return;
  const opened = window.open(channel.url,'_blank','noopener,noreferrer');
  setStatus(opened ? `เปิด ${channel.name} ในแท็บใหม่แล้ว` : 'เบราว์เซอร์บล็อกการเปิดหน้าต่างใหม่', opened ? 'ok' : 'bad');
}

function androidIntent(url) {
  try {
    const parsed = new URL(url);
    const scheme = parsed.protocol.replace(':','');
    return `intent://${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}` +
      `#Intent;scheme=${scheme};action=android.intent.action.VIEW;` +
      `category=android.intent.category.BROWSABLE;type=application/vnd.apple.mpegurl;` +
      `S.browser_fallback_url=${encodeURIComponent(url)};end`;
  } catch {
    return url;
  }
}

function openFallbackModal(channel, reason='') {
  selectedChannel = channel;
  modalLogo.src = channel.logo || '';
  modalLogo.alt = channel.name || '';
  modalName.textContent = channel.name || 'External Player';

  if (isIOS()) {
    nonIosButtons.style.display = 'none';
    iosButtons.style.display = 'block';
    modalNote.textContent = 'ช่องนี้ไม่สามารถเล่นภายในหน้าเว็บได้ กรุณาเลือกแอป Player ที่ติดตั้งในเครื่อง';
  } else {
    nonIosButtons.style.display = '';
    iosButtons.style.display = 'none';
    modalNote.textContent = isAndroid()
      ? 'กรุณาเปิดช่องนี้ด้วยแอป Player บน Android'
      : 'กรุณาเลือกวิธีเปิดช่องนี้จากตัวเลือกด้านล่าง';
  }
  playerModal.classList.add('show');
  setStatus(reason ? `เล่นบนหน้าเว็บไม่ได้: ${reason}` : 'กรุณาเปิดด้วย Player ภายนอก','bad');
}

function showFallback(channel, token, reason='') {
  if (token !== playToken) return;
  stopStream();
  if (isDesktop()) openExternal(channel);
  else openFallbackModal(channel,reason);
}

function playChannel(channel) {
  if (!video) return;
  playToken += 1;
  const token = playToken;
  updateNowPlaying(channel);
  setActive(channel._key);
  playerModal.classList.remove('show');
  stopStream();
  setStatus(`กำลังเตรียมสัญญาณ ${channel.name}...`);

  if (String(channel.url).startsWith('http://')) {
    showFallback(channel,token,'ลิงก์ HTTP ถูกบล็อกบนเว็บไซต์ HTTPS');
    return;
  }
  if (!isHls(channel.url)) {
    showFallback(channel,token,'ลิงก์นี้ไม่ใช่ HLS stream');
    return;
  }

  fallbackTimer = setTimeout(() => {
    const playing = !video.paused && !video.ended && video.readyState >= 2;
    if (!playing) showFallback(channel,token,'โหลดสัญญาณนานเกินไป');
  },9000);

  const onPlaying = () => {
    if (token !== playToken) return;
    clearFallbackTimer();
    setStatus(`กำลังเล่น ${channel.name}`,'ok');
  };
  video.addEventListener('playing',onPlaying,{once:true});

  if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = channel.url;
    video.play().catch(error => showFallback(channel,token,error.message));
    return;
  }

  if (window.Hls?.isSupported()) {
    hls = new Hls({enableWorker:true,lowLatencyMode:true,maxBufferLength:30});
    hls.loadSource(channel.url);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED,() => {
      video.play().catch(error => showFallback(channel,token,error.message));
    });
    hls.on(Hls.Events.ERROR,(_event,data) => {
      if (data.fatal) showFallback(channel,token,data.details || 'HLS error');
    });
    return;
  }

  showFallback(channel,token,'เบราว์เซอร์นี้ไม่รองรับ HLS');
}

closeModal?.addEventListener('click',() => playerModal.classList.remove('show'));
playerModal?.addEventListener('click',event => {
  if (event.target === playerModal) playerModal.classList.remove('show');
});
document.addEventListener('keydown',event => {
  if (event.key === 'Escape') playerModal?.classList.remove('show');
});
btnMobilePlayer?.addEventListener('click',() => {
  if (!selectedChannel) return;
  if (isAndroid()) window.location.href = androidIntent(selectedChannel.url);
  else openExternal(selectedChannel);
});
btnOpenTab?.addEventListener('click',() => openExternal(selectedChannel));
btnIOSTab?.addEventListener('click',() => openExternal(selectedChannel));
btnVLC?.addEventListener('click',() => selectedChannel && (window.location.href = `vlc://${selectedChannel.url}`));
btnLiftplay?.addEventListener('click',() => selectedChannel && (window.location.href = `liftplay://${selectedChannel.url}`));
btnInfuse?.addEventListener('click',() => selectedChannel && (window.location.href = `infuse://x-callback-url/play?url=${encodeURIComponent(selectedChannel.url)}`));
btnNPlayer?.addEventListener('click',() => {
  if (!selectedChannel) return;
  window.location.href = selectedChannel.url
    .replace(/^https:\/\//i,'nplayer-https://')
    .replace(/^http:\/\//i,'nplayer-http://');
});

function activateTab(name) {
  const showChannels = name === 'channels';
  tabChannels.classList.toggle('active',showChannels);
  tabSchedule.classList.toggle('active',!showChannels);
  tabChannels.setAttribute('aria-selected',String(showChannels));
  tabSchedule.setAttribute('aria-selected',String(!showChannels));
  channelsPanel.hidden = !showChannels;
  schedulePanel.hidden = showChannels;
  if (!showChannels) loadSchedule();
}

tabChannels?.addEventListener('click',() => activateTab('channels'));
tabSchedule?.addEventListener('click',() => activateTab('schedule'));

function bangkokDateKey(date=new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA',{
    timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type,part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function shiftDate(key,days) {
  const date = new Date(`${key}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate()+days);
  return date.toISOString().slice(0,10);
}

function matchState(status='') {
  const value = String(status).toUpperCase();
  if (['IN_PLAY','PAUSED'].includes(value)) return {key:'live',label:value === 'PAUSED' ? 'HT' : 'LIVE',detail:value === 'PAUSED' ? 'Half-time' : 'In play'};
  if (value === 'FINISHED') return {key:'finished',label:'FT',detail:'Full time'};
  if (['POSTPONED','CANCELLED','SUSPENDED'].includes(value)) return {key:'cancelled',label:value,detail:'Schedule changed'};
  return {key:'upcoming',label:'UPCOMING',detail:'Scheduled'};
}

function competitionPriority(name='') {
  const text = name.toLowerCase();
  const rules = [
    ['world cup',1000,'Featured'],['champions league',950,'Elite'],['premier league',930,'Top league'],
    ['la liga',920,'Top league'],['serie a',915,'Top league'],['bundesliga',910,'Top league'],
    ['ligue 1',900,'Top league'],['europa league',890,'Major cup'],['fa cup',870,'Major cup']
  ];
  const match = rules.find(([key]) => text.includes(key));
  return match ? {priority:match[1],tier:match[2]} : {priority:100,tier:'Standard'};
}

function inferChannel(competition='') {
  const text = competition.toLowerCase();
  if (text.includes('world cup')) return 'MonoMax / Mono29';
  if (text.includes('premier league')) return 'True Premier Football';
  if (['champions league','europa league','la liga','serie a','bundesliga','ligue 1'].some(key => text.includes(key))) return 'beIN SPORTS';
  return 'TBD';
}

function renderScheduleLoading() {
  scheduleSource.textContent = 'LOADING';
  scheduleSource.classList.remove('fallback');
  scheduleCount.textContent = '—';
  refreshSchedule.classList.add('loading');
  refreshSchedule.disabled = true;
  scheduleList.innerHTML = `
    <div class="schedule-skeleton">
      <div class="skeleton-league"><div class="skeleton-league-head"></div><div class="skeleton-row"></div><div class="skeleton-row"></div></div>
      <div class="skeleton-league"><div class="skeleton-league-head"></div><div class="skeleton-row"></div></div>
    </div>`;
}

function updateScheduleMeta(total,source='live') {
  const now = new Date();
  scheduleDateLabel.textContent = now.toLocaleDateString('th-TH',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Bangkok'});
  scheduleCount.textContent = String(total);
  scheduleUpdated.textContent = `${now.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Bangkok'})} น.`;
  scheduleSource.textContent = source === 'live' ? 'LIVE API' : 'API ERROR';
  scheduleSource.classList.toggle('fallback',source !== 'live');
}

function scoreText(match) {
  const score = match?.score || {};
  for (const candidate of [score.fullTime,score.regularTime,score.halfTime]) {
    if (Number.isFinite(candidate?.home) && Number.isFinite(candidate?.away)) return `${candidate.home} - ${candidate.away}`;
  }
  return '';
}

function renderSchedule(matches) {
  updateScheduleMeta(matches.length,'live');
  if (!matches.length) {
    scheduleList.innerHTML = '<div class="schedule-empty"><div class="schedule-empty-icon">⚽</div><strong>ไม่พบการแข่งขันในวันนี้</strong><span>API ทำงานปกติ แต่ไม่มีแมตช์ที่ตรงกับวันที่ประเทศไทย</span></div>';
    return;
  }

  const groups = new Map();
  matches.forEach(match => {
    const competition = match.competition?.name || 'Football Match';
    if (!groups.has(competition)) groups.set(competition,[]);
    groups.get(competition).push(match);
  });

  const sections = [...groups.entries()].map(([competition,items]) => ({
    competition,items, ...competitionPriority(competition)
  })).sort((a,b) => b.priority-a.priority);

  scheduleList.innerHTML = sections.map(section => {
    const rows = section.items.sort((a,b) => new Date(a.utcDate)-new Date(b.utcDate)).map(match => {
      const kickoff = new Date(match.utcDate);
      const state = matchState(match.status);
      const time = kickoff.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Bangkok'});
      const date = kickoff.toLocaleDateString('en-GB',{day:'2-digit',month:'short',timeZone:'Asia/Bangkok'});
      const home = match.homeTeam?.shortName || match.homeTeam?.name || 'Home Team';
      const away = match.awayTeam?.shortName || match.awayTeam?.name || 'Away Team';
      const score = scoreText(match);
      return `
        <article class="league-row ${state.key}">
          <div class="match-time"><strong>${escapeHtml(time)}</strong><small>${escapeHtml(date)} • Thailand</small></div>
          <div class="match-teams"><strong class="match-team home">${escapeHtml(home)}</strong><span class="match-vs">VS</span><strong class="match-team away">${escapeHtml(away)}</strong></div>
          <div class="score-box"><span class="score-value ${score ? '' : 'pending'}">${escapeHtml(score || '—')}</span></div>
          <div class="status-box"><span class="status-pill ${state.key}">${escapeHtml(state.label)}</span><span class="status-detail">${escapeHtml(state.detail)}</span></div>
          <div class="channel-box"><span class="channel-pill">${escapeHtml(inferChannel(section.competition))}</span><span class="channel-detail">Broadcast channel</span></div>
        </article>`;
    }).join('');
    return `
      <section class="league-section">
        <div class="league-section-head"><div class="league-title-copy"><h3 class="league-title">${escapeHtml(section.competition)}</h3><div class="league-meta">${section.items.length} match${section.items.length === 1 ? '' : 'es'} • ${escapeHtml(section.tier)}</div></div><span class="league-priority-chip">${escapeHtml(section.tier)}</span></div>
        <div class="league-table"><div class="league-table-head"><span>Thailand time</span><span>Match</span><span>Score</span><span>Status</span><span>Channel</span></div>${rows}</div>
      </section>`;
  }).join('');
}

async function loadSchedule() {
  if (!scheduleList || refreshSchedule.disabled) return;
  renderScheduleLoading();
  try {
    const base = String(config.footballApiBaseUrl || '').trim().replace(/\/+$/,'');
    if (!base) throw new Error('ยังไม่ได้ตั้งค่า FOOTBALL_API_URL');
    const today = bangkokDateKey();
    const url = new URL(`${base}/api/matches`);
    url.searchParams.set('dateFrom',shiftDate(today,-1));
    url.searchParams.set('dateTo',shiftDate(today,1));
    const response = await fetch(url,{headers:{Accept:'application/json'},cache:'no-store'});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const matches = (data.matches || []).filter(match => bangkokDateKey(new Date(match.utcDate)) === today);
    renderSchedule(matches);
  } catch (error) {
    console.warn(error);
    updateScheduleMeta(0,'error');
    scheduleList.innerHTML = `<div class="schedule-empty"><div class="schedule-empty-icon">!</div><strong>โหลดตารางการแข่งขันไม่สำเร็จ</strong><span>${escapeHtml(error.message || 'กรุณาตรวจสอบ Cloudflare Worker และการตั้งค่า API')}</span></div>`;
  } finally {
    refreshSchedule.classList.remove('loading');
    refreshSchedule.disabled = false;
  }
}

refreshSchedule?.addEventListener('click',loadSchedule);
document.addEventListener('visibilitychange',() => {
  if (!document.hidden && !schedulePanel.hidden) loadSchedule();
});
scheduleTimer = setInterval(() => {
  if (!document.hidden && !schedulePanel.hidden) loadSchedule();
},60000);

function init() {
  renderChannels();
  if (lastUpdated) {
    const now = new Date();
    lastUpdated.textContent = `${now.getFullYear()}:${String(now.getMonth()+1).padStart(2,'0')}:${String(now.getDate()).padStart(2,'0')}`;
  }
  const first = normalizedChannels()[0];
  if (first) playChannel(first);
  else setStatus('ยังไม่มีรายการช่อง','bad');
}

init();
