/* Two-tab schedule view: results and upcoming matches for today/tomorrow in Thailand time. */
(() => {
  const STYLE_ID = 'bk16-schedule-tabs-style';
  let selectedView = 'schedule';
  let latestMatches = [];

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .schedule-summary.schedule-summary-compact{
        grid-template-columns:minmax(220px,360px);
        justify-content:end;
        padding:16px 30px 0;
      }
      .schedule-view-tabs{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:8px;
        margin:18px 30px 0;
        padding:6px;
        border:1px solid rgba(255,255,255,.10);
        border-radius:18px;
        background:rgba(255,255,255,.035);
      }
      .schedule-view-tab{
        min-height:46px;
        display:flex;
        align-items:center;
        justify-content:center;
        gap:9px;
        padding:0 16px;
        border:1px solid transparent;
        border-radius:13px;
        color:#9fb1c8;
        background:transparent;
        cursor:pointer;
        font-weight:800;
        transition:background .16s ease,border-color .16s ease,color .16s ease,transform .16s ease;
      }
      .schedule-view-tab:hover{
        color:#eef8ff;
        border-color:rgba(24,199,221,.22);
        background:rgba(24,199,221,.065);
      }
      .schedule-view-tab.active{
        color:#f4fdff;
        border-color:rgba(24,199,221,.48);
        background:linear-gradient(90deg,rgba(24,199,221,.18),rgba(124,58,237,.12));
        box-shadow:0 10px 24px rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.07);
      }
      .schedule-view-tab-count{
        min-width:28px;
        min-height:24px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        padding:0 8px;
        border-radius:999px;
        color:#bff8ff;
        background:rgba(24,199,221,.10);
        font-size:10px;
        font-weight:900;
      }
      .schedule-view-tab.active .schedule-view-tab-count{
        color:#06141d;
        background:linear-gradient(90deg,#67e8f9,#86efac);
      }
      .schedule-view-caption{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:14px;
        padding:17px 18px;
        border:1px solid rgba(255,255,255,.09);
        border-radius:18px;
        background:linear-gradient(90deg,rgba(24,199,221,.09),rgba(124,58,237,.055));
      }
      .schedule-view-caption strong{
        display:block;
        color:#f3f8ff;
        font-size:18px;
        letter-spacing:-.02em;
      }
      .schedule-view-caption span{
        display:block;
        margin-top:4px;
        color:#8497b0;
        font-size:12px;
      }
      .schedule-view-caption-badge{
        min-height:32px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        padding:0 11px;
        border:1px solid rgba(24,199,221,.20);
        border-radius:999px;
        color:#c8f7ff;
        background:rgba(24,199,221,.08);
        font-size:10px;
        font-weight:900;
        white-space:nowrap;
      }
      .schedule-empty-view{
        min-height:240px;
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        padding:32px 18px;
        border:1px dashed rgba(255,255,255,.14);
        border-radius:20px;
        color:#8ea0b7;
        background:rgba(255,255,255,.025);
        text-align:center;
      }
      .schedule-empty-view strong{color:#eef6ff;font-size:18px}
      .schedule-empty-view span{margin-top:7px;font-size:13px;line-height:1.6}
      .league-table-head,.league-row{
        grid-template-columns:104px minmax(280px,1fr) 96px 128px 160px;
      }
      .match-time{
        min-height:64px;
        padding:8px 10px;
        border-radius:16px;
      }
      .match-time strong{font-size:18px}
      .match-time small{
        display:flex;
        align-items:center;
        justify-content:center;
        gap:5px;
        color:#8da2be;
        font-size:9px;
      }
      .match-day-label{
        color:#bff8ff;
        font-weight:900;
      }
      @media(max-width:1100px){
        .league-row{grid-template-columns:104px minmax(0,1fr) 92px}
      }
      @media(max-width:680px){
        .schedule-summary.schedule-summary-compact{
          grid-template-columns:1fr;
          padding:13px 13px 0;
        }
        .schedule-view-tabs{
          margin:14px 13px 0;
          gap:6px;
          padding:5px;
        }
        .schedule-view-tab{
          min-height:43px;
          padding:0 9px;
          font-size:12px;
        }
        .schedule-view-tab-count{min-width:24px;min-height:22px;padding:0 7px}
        .schedule-view-caption{padding:14px}
        .schedule-view-caption strong{font-size:16px}
        .match-time{min-height:58px;padding:7px 8px}
        .match-time strong{font-size:17px}
      }
    `;
    document.head.appendChild(style);
  }

  const summary = document.querySelector('.schedule-summary');
  if (summary) {
    const stats = [...summary.querySelectorAll('.schedule-stat')];
    stats.slice(0,2).forEach(stat => stat.remove());
    summary.classList.add('schedule-summary-compact');
  }

  const subtitle = document.querySelector('.schedule-subtitle');
  if (subtitle) {
    subtitle.textContent = 'เวลาประเทศไทยอัตโนมัติ • เลือกดูผลการแข่งขันหรือโปรแกรมวันนี้–พรุ่งนี้ • แสดงสกอร์และสถานะล่าสุด';
  }

  const tabs = document.createElement('div');
  tabs.className = 'schedule-view-tabs';
  tabs.setAttribute('role','tablist');
  tabs.setAttribute('aria-label','เลือกประเภทตารางการแข่งขัน');
  tabs.innerHTML = `
    <button class="schedule-view-tab" type="button" role="tab" aria-selected="false" data-view="results">
      <span>ผลการแข่งขัน</span>
      <span class="schedule-view-tab-count" data-count="results">0</span>
    </button>
    <button class="schedule-view-tab active" type="button" role="tab" aria-selected="true" data-view="schedule">
      <span>ตารางการแข่งขัน</span>
      <span class="schedule-view-tab-count" data-count="schedule">0</span>
    </button>
  `;
  scheduleList.before(tabs);

  function isFinished(match) {
    return String(match?.status || '').toUpperCase() === 'FINISHED';
  }

  function stateRank(status='') {
    const state = matchState(status).key;
    return ({live:0,upcoming:1,cancelled:2,finished:3})[state] ?? 4;
  }

  function dayLabel(match) {
    const key = bangkokDateKey(new Date(match.utcDate));
    return key === bangkokDateKey() ? 'วันนี้' : 'พรุ่งนี้';
  }

  function shortThaiDate(match) {
    return new Date(match.utcDate).toLocaleDateString('th-TH', {
      day:'numeric',
      month:'short',
      timeZone:'Asia/Bangkok'
    });
  }

  function renderMatchRow(match, competition) {
    const kickoff = new Date(match.utcDate);
    const state = matchState(match.status);
    const time = kickoff.toLocaleTimeString('en-GB', {
      hour:'2-digit',
      minute:'2-digit',
      hour12:false,
      timeZone:'Asia/Bangkok'
    });
    const home = match.homeTeam?.shortName || match.homeTeam?.name || 'Home Team';
    const away = match.awayTeam?.shortName || match.awayTeam?.name || 'Away Team';
    const score = scoreText(match);

    return `
      <article class="league-row ${state.key}">
        <div class="match-time">
          <strong>${escapeHtml(time)}</strong>
          <small><span class="match-day-label">${escapeHtml(dayLabel(match))}</span><span>${escapeHtml(shortThaiDate(match))}</span></small>
        </div>
        <div class="match-teams"><strong class="match-team home">${escapeHtml(home)}</strong><span class="match-vs">VS</span><strong class="match-team away">${escapeHtml(away)}</strong></div>
        <div class="score-box"><span class="score-value ${score ? '' : 'pending'}">${escapeHtml(score || '—')}</span></div>
        <div class="status-box"><span class="status-pill ${state.key}">${escapeHtml(state.label)}</span><span class="status-detail">${escapeHtml(state.detail)}</span></div>
        <div class="channel-box"><span class="channel-pill">${escapeHtml(inferChannel(competition))}</span><span class="channel-detail">Broadcast channel</span></div>
      </article>`;
  }

  function renderCompetitionSection(competition, matches) {
    const meta = competitionPriority(competition);
    const sortedMatches = [...matches].sort((a,b) => {
      const stateDifference = stateRank(a.status) - stateRank(b.status);
      return stateDifference || new Date(a.utcDate) - new Date(b.utcDate);
    });

    return `
      <section class="league-section">
        <div class="league-section-head">
          <div class="league-title-copy">
            <h3 class="league-title">${escapeHtml(competition)}</h3>
            <div class="league-meta">${sortedMatches.length} match${sortedMatches.length === 1 ? '' : 'es'} • ${escapeHtml(meta.tier)}</div>
          </div>
          <span class="league-priority-chip">${escapeHtml(meta.tier)}</span>
        </div>
        <div class="league-table">
          <div class="league-table-head"><span>เวลา</span><span>คู่แข่งขัน</span><span>สกอร์</span><span>สถานะ</span><span>ช่อง</span></div>
          ${sortedMatches.map(match => renderMatchRow(match, competition)).join('')}
        </div>
      </section>`;
  }

  function renderSelectedView() {
    const results = latestMatches.filter(isFinished);
    const schedule = latestMatches.filter(match => !isFinished(match));
    const selected = selectedView === 'results' ? results : schedule;

    tabs.querySelector('[data-count="results"]').textContent = String(results.length);
    tabs.querySelector('[data-count="schedule"]').textContent = String(schedule.length);

    tabs.querySelectorAll('.schedule-view-tab').forEach(button => {
      const active = button.dataset.view === selectedView;
      button.classList.toggle('active',active);
      button.setAttribute('aria-selected',String(active));
    });

    const captionTitle = selectedView === 'results' ? 'ผลการแข่งขันวันนี้' : 'โปรแกรมการแข่งขันวันนี้และพรุ่งนี้';
    const captionSub = selectedView === 'results'
      ? 'แสดงเฉพาะคู่ที่แข่งขันจบแล้วตามเวลาประเทศไทย'
      : 'แสดงคู่ที่กำลังแข่งขัน คู่ที่ยังไม่เริ่ม และรายการที่เลื่อนหรือยกเลิก';

    if (!selected.length) {
      const emptyTitle = selectedView === 'results' ? 'ยังไม่มีผลการแข่งขัน' : 'ยังไม่มีโปรแกรมการแข่งขัน';
      const emptyText = selectedView === 'results'
        ? 'เมื่อการแข่งขันจบ ผลและสกอร์จะปรากฏในแท็บนี้'
        : 'ไม่พบการแข่งขันที่กำลังแข่งหรือยังไม่เริ่มในวันนี้และวันพรุ่งนี้';
      scheduleList.innerHTML = `
        <div class="schedule-view-caption">
          <div><strong>${escapeHtml(captionTitle)}</strong><span>${escapeHtml(captionSub)}</span></div>
          <span class="schedule-view-caption-badge">0 คู่</span>
        </div>
        <div class="schedule-empty-view"><strong>${escapeHtml(emptyTitle)}</strong><span>${escapeHtml(emptyText)}</span></div>`;
      return;
    }

    const groups = new Map();
    selected.forEach(match => {
      const competition = match.competition?.name || 'Football Match';
      if (!groups.has(competition)) groups.set(competition,[]);
      groups.get(competition).push(match);
    });

    const sections = [...groups.entries()]
      .map(([competition,items]) => ({competition,items,...competitionPriority(competition)}))
      .sort((a,b) => b.priority-a.priority)
      .map(section => renderCompetitionSection(section.competition,section.items))
      .join('');

    scheduleList.innerHTML = `
      <div class="schedule-view-caption">
        <div><strong>${escapeHtml(captionTitle)}</strong><span>${escapeHtml(captionSub)}</span></div>
        <span class="schedule-view-caption-badge">${selected.length} คู่</span>
      </div>
      ${sections}`;
  }

  function setLoading() {
    scheduleSource.textContent = 'LOADING';
    scheduleSource.classList.remove('fallback');
    refreshSchedule.classList.add('loading');
    refreshSchedule.disabled = true;
    scheduleList.innerHTML = `
      <div class="schedule-skeleton">
        <div class="skeleton-league"><div class="skeleton-league-head"></div><div class="skeleton-row"></div><div class="skeleton-row"></div></div>
      </div>`;
  }

  function updateMeta() {
    const now = new Date();
    scheduleUpdated.textContent = `${now.toLocaleTimeString('th-TH', {
      hour:'2-digit',
      minute:'2-digit',
      hour12:false,
      timeZone:'Asia/Bangkok'
    })} น.`;
    scheduleSource.textContent = 'LIVE API';
    scheduleSource.classList.remove('fallback');
  }

  async function loadTabbedSchedule() {
    if (!scheduleList || refreshSchedule.disabled) return;
    setLoading();

    try {
      const base = String(config.footballApiBaseUrl || '').trim().replace(/\/+$/,'');
      if (!base) throw new Error('ยังไม่ได้ตั้งค่า FOOTBALL_API_URL');

      const todayKey = bangkokDateKey();
      const tomorrowKey = shiftDate(todayKey,1);
      const visibleKeys = new Set([todayKey,tomorrowKey]);
      const url = new URL(`${base}/api/matches`);

      url.searchParams.set('dateFrom',shiftDate(todayKey,-1));
      url.searchParams.set('dateTo',tomorrowKey);

      const response = await fetch(url,{headers:{Accept:'application/json'},cache:'no-store'});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      latestMatches = (data.matches || []).filter(match =>
        visibleKeys.has(bangkokDateKey(new Date(match.utcDate)))
      );
      updateMeta();
      renderSelectedView();
    } catch (error) {
      console.warn(error);
      scheduleSource.textContent = 'API ERROR';
      scheduleSource.classList.add('fallback');
      scheduleList.innerHTML = `<div class="schedule-empty"><div class="schedule-empty-icon">!</div><strong>โหลดตารางการแข่งขันไม่สำเร็จ</strong><span>${escapeHtml(error.message || 'กรุณาตรวจสอบ Cloudflare Worker และการตั้งค่า API')}</span></div>`;
    } finally {
      refreshSchedule.classList.remove('loading');
      refreshSchedule.disabled = false;
    }
  }

  tabs.addEventListener('click', event => {
    const button = event.target.closest('.schedule-view-tab');
    if (!button) return;
    selectedView = button.dataset.view;
    renderSelectedView();
  });

  loadSchedule = loadTabbedSchedule;

  refreshSchedule?.addEventListener('click', event => {
    event.stopImmediatePropagation();
    loadTabbedSchedule();
  }, true);
})();
