/* Two-day schedule view: show only matches for today and tomorrow in Thailand time. */
(() => {
  const STYLE_ID = 'bk16-two-day-schedule-style';

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .schedule-day-group{display:grid;gap:14px}
      .schedule-day-group+.schedule-day-group{margin-top:10px}
      .schedule-day-head{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:16px 18px;border:1px solid rgba(255,255,255,.10);border-radius:18px;background:linear-gradient(90deg,rgba(24,199,221,.13),rgba(124,58,237,.08));box-shadow:inset 0 1px 0 rgba(255,255,255,.04)}
      .schedule-day-head.tomorrow{background:linear-gradient(90deg,rgba(124,58,237,.15),rgba(24,199,221,.07))}
      .schedule-day-title{margin:0;color:#f4f8ff;font-size:20px;font-weight:800;letter-spacing:-.02em}
      .schedule-day-subtitle{margin-top:4px;color:#8ea0b7;font-size:12px}
      .schedule-day-count{display:inline-flex;align-items:center;justify-content:center;min-height:34px;padding:0 12px;border:1px solid rgba(24,199,221,.22);border-radius:999px;color:#c8f7ff;background:rgba(24,199,221,.08);font-size:11px;font-weight:800;white-space:nowrap}
      .schedule-day-empty{padding:26px 18px;border:1px dashed rgba(255,255,255,.13);border-radius:18px;color:#8ea0b7;background:rgba(255,255,255,.025);text-align:center;font-size:13px}
      @media(max-width:680px){.schedule-day-head{padding:14px}.schedule-day-title{font-size:17px}.schedule-day-count{min-height:30px;padding:0 10px;font-size:10px}}
    `;
    document.head.appendChild(style);
  }

  const countLabel = scheduleCount?.closest('.schedule-stat-copy')?.querySelector('small');
  if (countLabel) countLabel.textContent = 'แมตช์วันนี้–พรุ่งนี้';

  const subtitle = document.querySelector('.schedule-subtitle');
  if (subtitle) {
    subtitle.textContent = 'เวลาประเทศไทยอัตโนมัติ • แสดงเฉพาะการแข่งขันวันนี้และวันพรุ่งนี้ • แสดงสกอร์และสถานะล่าสุด';
  }

  function thaiDateFromKey(key) {
    return new Date(`${key}T12:00:00+07:00`);
  }

  function dayHeading(key, todayKey) {
    const isToday = key === todayKey;
    const date = thaiDateFromKey(key);
    const fullDate = date.toLocaleDateString('th-TH', {
      weekday:'long',
      day:'numeric',
      month:'long',
      year:'numeric',
      timeZone:'Asia/Bangkok'
    });
    return {
      title:isToday ? 'วันนี้' : 'พรุ่งนี้',
      fullDate,
      className:isToday ? 'today' : 'tomorrow'
    };
  }

  function stateRank(status='') {
    const state = matchState(status).key;
    return ({live:0,upcoming:1,finished:2,cancelled:3})[state] ?? 4;
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
    const date = kickoff.toLocaleDateString('en-GB', {
      day:'2-digit',
      month:'short',
      timeZone:'Asia/Bangkok'
    });
    const home = match.homeTeam?.shortName || match.homeTeam?.name || 'Home Team';
    const away = match.awayTeam?.shortName || match.awayTeam?.name || 'Away Team';
    const score = scoreText(match);

    return `
      <article class="league-row ${state.key}">
        <div class="match-time"><strong>${escapeHtml(time)}</strong><small>${escapeHtml(date)} • Thailand</small></div>
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
          <div class="league-table-head"><span>Thailand time</span><span>Match</span><span>Score</span><span>Status</span><span>Channel</span></div>
          ${sortedMatches.map(match => renderMatchRow(match, competition)).join('')}
        </div>
      </section>`;
  }

  function renderDayGroup(key, matches, todayKey) {
    const heading = dayHeading(key, todayKey);
    const groups = new Map();

    matches.forEach(match => {
      const competition = match.competition?.name || 'Football Match';
      if (!groups.has(competition)) groups.set(competition, []);
      groups.get(competition).push(match);
    });

    const sections = [...groups.entries()]
      .map(([competition, items]) => ({competition,items,...competitionPriority(competition)}))
      .sort((a,b) => b.priority - a.priority)
      .map(section => renderCompetitionSection(section.competition, section.items))
      .join('');

    return `
      <section class="schedule-day-group">
        <div class="schedule-day-head ${heading.className}">
          <div>
            <h3 class="schedule-day-title">${escapeHtml(heading.title)}</h3>
            <div class="schedule-day-subtitle">${escapeHtml(heading.fullDate)}</div>
          </div>
          <span class="schedule-day-count">${matches.length} คู่</span>
        </div>
        ${sections || `<div class="schedule-day-empty">ไม่มีการแข่งขันใน${heading.title}</div>`}
      </section>`;
  }

  function updateTwoDayMeta(total) {
    const now = new Date();
    scheduleDateLabel.textContent = 'วันนี้และพรุ่งนี้';
    scheduleCount.textContent = String(total);
    scheduleUpdated.textContent = `${now.toLocaleTimeString('th-TH', {
      hour:'2-digit',
      minute:'2-digit',
      hour12:false,
      timeZone:'Asia/Bangkok'
    })} น.`;
    scheduleSource.textContent = 'LIVE API';
    scheduleSource.classList.remove('fallback');
  }

  function renderTwoDaySchedule(matches) {
    const todayKey = bangkokDateKey();
    const tomorrowKey = shiftDate(todayKey,1);
    const grouped = new Map([[todayKey,[]],[tomorrowKey,[]]]);

    matches.forEach(match => {
      const key = bangkokDateKey(new Date(match.utcDate));
      if (grouped.has(key)) grouped.get(key).push(match);
    });

    const total = [...grouped.values()].reduce((sum,items) => sum + items.length,0);
    updateTwoDayMeta(total);
    scheduleList.innerHTML = [todayKey,tomorrowKey]
      .map(key => renderDayGroup(key, grouped.get(key), todayKey))
      .join('');
  }

  async function loadTwoDaySchedule() {
    if (!scheduleList || refreshSchedule.disabled) return;
    renderScheduleLoading();

    try {
      const base = String(config.footballApiBaseUrl || '').trim().replace(/\/+$/,'');
      if (!base) throw new Error('ยังไม่ได้ตั้งค่า FOOTBALL_API_URL');

      const todayKey = bangkokDateKey();
      const tomorrowKey = shiftDate(todayKey,1);
      const visibleKeys = new Set([todayKey,tomorrowKey]);
      const url = new URL(`${base}/api/matches`);

      // Query one UTC buffer day to keep early-morning Thailand matches correct,
      // but display only today and tomorrow in Thailand time.
      url.searchParams.set('dateFrom',shiftDate(todayKey,-1));
      url.searchParams.set('dateTo',tomorrowKey);

      const response = await fetch(url,{headers:{Accept:'application/json'},cache:'no-store'});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      const matches = (data.matches || []).filter(match =>
        visibleKeys.has(bangkokDateKey(new Date(match.utcDate)))
      );
      renderTwoDaySchedule(matches);
    } catch (error) {
      console.warn(error);
      updateScheduleMeta(0,'error');
      scheduleDateLabel.textContent = 'วันนี้และพรุ่งนี้';
      scheduleList.innerHTML = `<div class="schedule-empty"><div class="schedule-empty-icon">!</div><strong>โหลดตารางการแข่งขันไม่สำเร็จ</strong><span>${escapeHtml(error.message || 'กรุณาตรวจสอบ Cloudflare Worker และการตั้งค่า API')}</span></div>`;
    } finally {
      refreshSchedule.classList.remove('loading');
      refreshSchedule.disabled = false;
    }
  }

  // Replace the original one-day loader for tab switching, visibility refresh and timer refresh.
  loadSchedule = loadTwoDaySchedule;

  // The original refresh listener holds the old function reference, so intercept it first.
  refreshSchedule?.addEventListener('click', event => {
    event.stopImmediatePropagation();
    loadTwoDaySchedule();
  }, true);
})();
