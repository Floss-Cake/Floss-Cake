/* ============================================================
 * 实验数据管理平台 · 纯静态零后端
 * 数据读取自 GitHub 仓库 data/ 目录下的 JSON 文件
 * ============================================================ */

/* ---------- 配置（部署前可按需修改） ---------- */
const CONFIG = {
  // 默认数据源（与实验 config.js 一致）
  repo: 'Floss-Cake/Floss-Cake',
  branch: 'main',
  dataDir: 'data',
  // ⚠️ 源码中不再内置任何 Token。Token 由登录页必填，仅存于浏览器 localStorage。
  //    建议使用细粒度只读 Token（仅授权 Floss-Cake/Floss-Cake 的 contents 读权限）。
  // 管理账号（门禁性质，GitHub Pages 源码公开，非真正安全）
  ADMIN_USER: 'admin',
  ADMIN_PASS: 'admin',
  perPage: 8,            // 表格分页
};

// 故事中文名（与实验 config 对应）
const STORY_NAMES = {
  swim: '游泳课', diningHall: '午餐', playground: '校运会失利',
  brokeleg: '摔伤腿', artClass: '美术课', failed: '待定',
};
const STORY_ORDER = ['swim', 'diningHall', 'playground', 'brokeleg', 'artClass'];

/* ---------- 运行时状态 ---------- */
let SESSION = null;          // {repo, branch, token, dataDir}
let RECORDS = [];            // 完整被试记录
let FILE_INDEX = [];         // 文件名索引 {name, sha, participantId, date}
let FILTER = { dateFrom: '', dateTo: '', story: '', option: '', www: '', minStories: 0, version: '' };
let PAGE = 1;

/* ============================================================
 * 工具函数
 * ============================================================ */
function $(sel) { return document.querySelector(sel); }
function $all(sel) { return Array.from(document.querySelectorAll(sel)); }

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.add('hidden'), 2400);
}

function fmtDate(d) {
  if (!d || isNaN(d)) return '—';
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function fmtDuration(sec) {
  if (sec == null) return '—';
  sec = Math.round(sec);
  const m = Math.floor(sec / 60), s = sec % 60;
  return m > 0 ? `${m}分${s}秒` : `${s}秒`;
}
function b64decode(b) {
  const bin = atob(b.replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// 从文件名解析 时间戳 + 被试编号
function parseFileName(name) {
  const base = name.replace(/\.json$/i, '');
  const m = base.match(/^(.*)Z-(.+)$/);
  let iso = null, pid = base;
  if (m) {
    // m[1] 形如 2026-07-15T10-04-33-385，转换为合法 ISO：2026-07-15T10:04:33.385Z
    iso = m[1].replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})/, 'T$1:$2:$3.$4') + 'Z';
    pid = m[2];
  }
  const date = iso ? new Date(iso) : null;
  return { participantId: pid, date };
}

/* ============================================================
 * GitHub 数据层
 * ============================================================ */
function ghHeaders(extra) {
  const h = { 'Accept': 'application/vnd.github+json' };
  if (SESSION.token) h['Authorization'] = `Bearer ${SESSION.token}`;
  return Object.assign(h, extra || {});
}

async function listFiles() {
  const url = `https://api.github.com/repos/${SESSION.repo}/contents/${SESSION.dataDir}?ref=${SESSION.branch}`;
  const resp = await fetch(url, { headers: ghHeaders() });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.message || `列目录失败 (${resp.status})`);
  }
  const arr = await resp.json();
  if (!Array.isArray(arr)) return [];
  return arr.filter(f => f.name.endsWith('.json')).map(f => {
    const { participantId, date } = parseFileName(f.name);
    return { name: f.name, sha: f.sha, size: f.size, participantId, date, loaded: false, content: null };
  });
}

async function fetchFileContent(idx) {
  const url = `https://api.github.com/repos/${SESSION.repo}/contents/${SESSION.dataDir}/${encodeURIComponent(idx.name)}?ref=${SESSION.branch}`;
  const resp = await fetch(url, { headers: ghHeaders() });
  if (!resp.ok) throw new Error(`读取 ${idx.name} 失败 (${resp.status})`);
  const j = await resp.json();
  return b64decode(j.content);
}

async function deleteFile(idx) {
  const url = `https://api.github.com/repos/${SESSION.repo}/contents/${SESSION.dataDir}/${encodeURIComponent(idx.name)}?ref=${SESSION.branch}`;
  const resp = await fetch(url, {
    method: 'DELETE',
    headers: ghHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      message: `admin: delete ${idx.name}`,
      sha: idx.sha,
      branch: SESSION.branch,
    }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.message || `删除失败 (${resp.status})`);
  }
  return true;
}

/* ============================================================
 * 数据加载（列目录 + 并发拉取内容）
 * ============================================================ */
async function loadData() {
  showLoading('列出数据文件…');
  try {
    const files = await listFiles();
    FILE_INDEX = files;
    $('#conn-meta').textContent = `仓库 ${SESSION.repo} · 共 ${files.length} 个文件`;

    // 并发拉取内容（限制并发，带进度）
    const pool = 6, total = files.length;
    let done = 0;
    const worker = async () => {
      while (true) {
        const i = FILE_INDEX.findIndex(f => !f.loaded && !f._loading);
        if (i < 0) return;
        FILE_INDEX[i]._loading = true;
        try {
          const txt = await fetchFileContent(FILE_INDEX[i]);
          FILE_INDEX[i].content = JSON.parse(txt);
        } catch (e) {
          FILE_INDEX[i].error = e.message;
        }
        FILE_INDEX[i].loaded = true;
        FILE_INDEX[i]._loading = false;
        done++;
        setProgress(done / total, `加载数据 ${done}/${total}`);
      }
    };
    const n = Math.min(pool, Math.max(1, total));
    await Promise.all(Array.from({ length: n }, worker));

    RECORDS = FILE_INDEX.map(buildRecord);
    RECORDS.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
    hideLoading();
    populateFilterOptions();
    PAGE = 1;
    renderAll();
  } catch (e) {
    hideLoading();
    $('#conn-meta').textContent = '连接失败：' + e.message;
    toast('加载失败：' + e.message);
  }
}

// 把索引 + 内容 构建成统一记录
function buildRecord(idx) {
  const c = idx.content || {};
  const choices = Array.isArray(c.choices) ? c.choices : [];
  // 按故事分组
  const byStory = {};
  for (const ch of choices) {
    const sid = ch.storyId || 'unknown';
    (byStory[sid] = byStory[sid] || []).push(ch);
  }
  const storiesDone = Object.keys(byStory).filter(s => byStory[s].length > 0);
  // 题目计数
  const qCount = choices.length;
  // 日期回退
  let date = idx.date;
  if ((!date || isNaN(date)) && c.timestamp) date = new Date(c.timestamp);
  return {
    file: idx.name,
    sha: idx.sha,
    pid: c.participant_id || idx.participantId,
    school: c.school || '',
    date,
    dateStr: fmtDate(date),
    version: c.experiment_version || '—',
    duration: c.metadata?.totalDuration ?? null,
    browser: c.browser || '',
    screen: c.screen || '',
    language: c.language || '',
    choices,
    byStory,
    storiesDone,
    qCount,
    loaded: idx.loaded,
    error: idx.error || null,
  };
}

/* ============================================================
 * 筛选
 * ============================================================ */
function getFiltered() {
  const from = FILTER.dateFrom ? new Date(FILTER.dateFrom + 'T00:00:00') : null;
  const to = FILTER.dateTo ? new Date(FILTER.dateTo + 'T23:59:59') : null;
  const term = (FILTER.www || '').toLowerCase();
  return RECORDS.filter(r => {
    if (from && (!r.date || r.date < from)) return false;
    if (to && (!r.date || r.date > to)) return false;
    if (FILTER.minStories && r.storiesDone.length < FILTER.minStories) return false;
    if (FILTER.version && r.version !== FILTER.version) return false;
    if (FILTER.story) {
      if (!r.byStory[FILTER.story] || r.byStory[FILTER.story].length === 0) return false;
      if (FILTER.option) {
        // 该故事下存在任一题选项 == 选中值
        const hit = r.byStory[FILTER.story].some(ch => ch.optionValue === FILTER.option);
        if (!hit) return false;
      }
    } else if (FILTER.option) {
      const hit = r.choices.some(ch => ch.optionValue === FILTER.option);
      if (!hit) return false;
    }
    if (term) {
      const hay = [r.pid, r.school, r.browser, r.screen, r.language, r.version].join(' ').toLowerCase();
      if (!hay.includes(term)) return false;
    }
    return true;
  });
}

/* ============================================================
 * 渲染
 * ============================================================ */
function renderAll() {
  renderStats(RECORDS);
  renderTable();
}

function renderStats(all) {
  const box = $('#stats');
  const total = all.length;
  const withDur = all.filter(r => r.duration != null);
  const avgDur = withDur.length ? withDur.reduce((s, r) => s + r.duration, 0) / withDur.length : null;
  const lastDate = all.reduce((m, r) => (r.date && (!m || r.date > m) ? r.date : m), null);
  // 各故事作答人数
  const storyCount = {};
  for (const sid of STORY_ORDER) {
    storyCount[sid] = all.filter(r => r.byStory[sid] && r.byStory[sid].length).length;
  }
  // 选项分布（按当前故事筛选或全局）
  const optPool = FILTER.story
    ? all.flatMap(r => r.byStory[FILTER.story] || [])
    : all.flatMap(r => r.choices);
  const optCnt = { A: 0, B: 0, C: 0 };
  for (const c of optPool) if (optCnt[c.optionValue] != null) optCnt[c.optionValue]++;
  const optSum = optCnt.A + optCnt.B + optCnt.C || 1;

  let storyDist = '';
  for (const sid of STORY_ORDER) {
    const n = storyCount[sid];
    const pct = total ? Math.round(n / total * 100) : 0;
    storyDist += `<div class="dist-row"><span class="name">${STORY_NAMES[sid] || sid}</span>
      <span class="bar"><i style="width:${pct}%"></i></span><span class="pct">${n}</span></div>`;
  }
  let optDist = '';
  for (const k of ['A', 'B', 'C']) {
    const pct = Math.round(optCnt[k] / optSum * 100);
    const color = k === 'A' ? 'var(--A)' : k === 'B' ? 'var(--B)' : 'var(--C)';
    optDist += `<div class="dist-row"><span class="name">选项 ${k}</span>
      <span class="bar"><i style="width:${pct}%;background:${color}"></i></span><span class="pct">${pct}%</span></div>`;
  }

  box.innerHTML = `
    <div class="stat-card">
      <div class="k">被试总数</div><div class="v">${total}</div>
      <div class="sub">${FILTER.story ? '已按故事筛选' : '全部数据'}</div>
    </div>
    <div class="stat-card">
      <div class="k">平均实验时长</div><div class="v">${avgDur != null ? fmtDuration(avgDur) : '—'}</div>
      <div class="sub">基于 ${withDur.length} 条有效记录</div>
    </div>
    <div class="stat-card">
      <div class="k">最近录入</div><div class="v" style="font-size:18px">${lastDate ? fmtDate(lastDate) : '—'}</div>
      <div class="sub">最新被试编号</div>
    </div>
    <div class="stat-card">
      <div class="k">各故事作答人数</div>
      <div class="dist">${storyDist}</div>
    </div>
    <div class="stat-card">
      <div class="k">选项分布 ${FILTER.story ? '（' + (STORY_NAMES[FILTER.story] || FILTER.story) + '）' : '（全部）'}</div>
      <div class="dist">${optDist}</div>
    </div>`;
}

function renderTable() {
  const filtered = getFiltered();
  $('#result-count').textContent = `共 ${filtered.length} 条`;
  const head = $('#table-head');
  head.innerHTML = `<tr>
    <th>被试编号</th><th>所属学校</th><th>录入时间</th><th>版本</th><th>时长</th>
    <th>完成故事</th><th>故事覆盖</th><th>操作</th>
  </tr>`;

  const body = $('#table-body');
  if (!filtered.length) {
    body.innerHTML = '';
    $('#table-empty').classList.remove('hidden');
    return;
  }
  $('#table-empty').classList.add('hidden');

  const start = (PAGE - 1) * CONFIG.perPage;
  const pageRows = filtered.slice(start, start + CONFIG.perPage);

  body.innerHTML = pageRows.map(r => {
    const stories = r.storiesDone.map(s => `<span class="story-name">${STORY_NAMES[s] || s}</span>`).join(' · ') || '—';
    return `<tr>
      <td class="pid">${esc(r.pid)}</td>
      <td>${esc(r.school) || '<span class="muted">—</span>'}</td>
      <td>${r.dateStr}</td>
      <td>${esc(r.version)}</td>
      <td>${fmtDuration(r.duration)}</td>
      <td>${r.storiesDone.length} / 5</td>
      <td>${stories}</td>
      <td><div class="row-actions">
        <button class="link-btn" data-act="detail" data-pid="${esc(r.pid)}">详情</button>
        <button class="link-btn" data-act="dl" data-pid="${esc(r.pid)}">下载</button>
        <button class="link-btn danger" data-act="del" data-pid="${esc(r.pid)}">删除</button>
      </div></td>
    </tr>`;
  }).join('');

  // 分页条
  const pages = Math.ceil(filtered.length / CONFIG.perPage);
  if (pages > 1) {
    let pager = '<tr><td colspan="8"><div class="row-actions" style="justify-content:center;gap:6px;padding-top:8px">';
    for (let p = 1; p <= pages; p++) {
      pager += `<button class="link-btn" data-act="page" data-page="${p}" style="${p === PAGE ? 'font-weight:700;color:var(--brand-ink)' : ''}">${p}</button>`;
    }
    pager += '</div></td></tr>';
    body.innerHTML += pager;
  }
}

/* ============================================================
 * 详情抽屉
 * ============================================================ */
function openDetail(pid) {
  const r = RECORDS.find(x => x.pid === pid);
  if (!r) return;
  $('#drawer-title').textContent = '被试详情 · ' + r.pid;
  let meta = `<div class="meta-grid">
    <div class="it"><b>编号</b>${esc(r.pid)}</div>
    <div class="it"><b>所属学校</b>${esc(r.school) || '—'}</div>
    <div class="it"><b>录入时间</b>${r.dateStr}</div>
    <div class="it"><b>版本</b>${esc(r.version)}</div>
    <div class="it"><b>时长</b>${fmtDuration(r.duration)}</div>
    <div class="it"><b>浏览器</b>${esc(r.browser)}</div>
    <div class="it"><b>屏幕</b>${esc(r.screen)}</div>
    <div class="it"><b>语言</b>${esc(r.language)}</div>
    <div class="it"><b>完成故事</b>${r.storiesDone.length} / 5</div>
  </div>`;
  if (!r.loaded || r.error) {
    meta += `<p class="muted">⚠️ 内容未加载：${esc(r.error || '未知')}</p>`;
  }
  let blocks = '';
  for (const sid of STORY_ORDER) {
    const qs = r.byStory[sid];
    if (!qs || !qs.length) continue;
    const opts = qs.map((q, i) => {
      const picked = q.optionValue;
      return `<div class="q-item">
        <div class="q-stem">Q${i + 1}. ${esc(q.questionStem || '')}</div>
        <div class="q-opts">
          <div class="q-opt picked"><span class="chip ${picked}">${esc(picked)}</span>
            <span class="lbl">${esc(q.optionLabel || '')}</span></div>
        </div>
      </div>`;
    }).join('');
    blocks += `<div class="story-block"><h3>${STORY_NAMES[sid] || sid}（${qs.length} 题）</h3>${opts}</div>`;
  }
  $('#drawer-body').innerHTML = meta + blocks;
  $('#drawer').classList.remove('hidden');
}

/* ============================================================
 * 导出
 * ============================================================ */
function exportCSV() {
  const filtered = getFiltered();
  if (!filtered.length) return toast('没有可导出的数据');
  const header = ['被试编号', '所属学校', '录入时间', '版本', '时长_秒', '浏览器', '屏幕', '语言', '完成故事数', '故事覆盖'];
  const storyCols = [];
  for (const sid of STORY_ORDER) {
    // 该故事出现的最大题数
    const maxQ = Math.max(0, ...filtered.map(r => r.byStory[sid]?.length || 0));
    for (let i = 1; i <= maxQ; i++) storyCols.push(`${sid}_q${i}`);
  }
  const rows = [header.concat(storyCols).join(',')];
  for (const r of filtered) {
    const base = [
      r.pid, r.school, r.dateStr, r.version, r.duration ?? '',
      r.browser, r.screen, r.language, r.storiesDone.length,
      r.storiesDone.map(s => STORY_NAMES[s] || s).join('|'),
    ];
    const sc = [];
    for (const sid of STORY_ORDER) {
      const qs = r.byStory[sid] || [];
      const maxQ = Math.max(0, ...filtered.map(x => x.byStory[sid]?.length || 0));
      for (let i = 1; i <= maxQ; i++) sc.push(qs[i - 1]?.optionValue || '');
    }
    rows.push(base.concat(sc).map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
  }
  downloadFile('\uFEFF' + rows.join('\n'), `experiment_data_${Date.now()}.csv`, 'text/csv;charset=utf-8');
  toast('CSV 已导出');
}

function exportJSON() {
  const filtered = getFiltered();
  if (!filtered.length) return toast('没有可导出的数据');
  const payload = filtered.map(r => ({
    participant_id: r.pid, school: r.school, timestamp: r.date?.toISOString?.() || null,
    experiment_version: r.version, duration_seconds: r.duration,
    browser: r.browser, screen: r.screen, language: r.language,
    stories_done: r.storiesDone, choices: r.choices,
  }));
  downloadFile(JSON.stringify(payload, null, 2), `experiment_data_${Date.now()}.json`, 'application/json');
  toast('JSON 已导出');
}

function downloadFile(text, name, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click();
  a.remove(); URL.revokeObjectURL(url);
}

/* ============================================================
 * 登录
 * ============================================================ */
function tryLogin(e) {
  e.preventDefault();
  const user = $('#username').value.trim();
  const pc = $('#passcode').value;
  const token = $('#token').value.trim();
  if (user !== CONFIG.ADMIN_USER || pc !== CONFIG.ADMIN_PASS) {
    $('#login-error').textContent = '账号或密码错误';
    return;
  }
  if (!token) {
    $('#login-error').textContent = '请输入 GitHub Token';
    return;
  }
  SESSION = {
    repo: $('#cfg-repo').value.trim() || CONFIG.repo,
    branch: $('#cfg-branch').value.trim() || CONFIG.branch,
    token,
    dataDir: $('#cfg-datadir').value.trim() || CONFIG.dataDir,
  };
  localStorage.setItem('fc_admin_session', JSON.stringify(SESSION));
  $('#login-view').classList.add('hidden');
  $('#app-view').classList.remove('hidden');
  loadData();
}

function logout() {
  localStorage.removeItem('fc_admin_session');
  SESSION = null;
  $('#app-view').classList.add('hidden');
  $('#login-view').classList.remove('hidden');
}

function restoreSession() {
  try {
    const s = JSON.parse(localStorage.getItem('fc_admin_session') || 'null');
    if (s && s.repo) {
      SESSION = s;
      $('#login-view').classList.add('hidden');
      $('#app-view').classList.remove('hidden');
      loadData();
      return true;
    }
  } catch (_) {}
  return false;
}

/* ============================================================
 * UI 辅助
 * ============================================================ */
function showLoading(text) {
  $('#loading-text').textContent = text || '加载中…';
  $('#progress-bar').style.width = '0%';
  $('#loading').classList.remove('hidden');
}
function setProgress(p, text) {
  $('#progress-bar').style.width = Math.round(p * 100) + '%';
  if (text) $('#loading-text').textContent = text;
}
function hideLoading() { $('#loading').classList.add('hidden'); }

function populateFilterOptions() {
  const storySel = $('#f-story');
  storySel.innerHTML = '<option value="">全部</option>';
  for (const sid of STORY_ORDER) {
    if (RECORDS.some(r => r.byStory[sid]?.length)) {
      const o = document.createElement('option');
      o.value = sid; o.textContent = STORY_NAMES[sid] || sid;
      storySel.appendChild(o);
    }
  }
  const verSel = $('#f-version');
  verSel.innerHTML = '<option value="">全部</option>';
  const vers = [...new Set(RECORDS.map(r => r.version).filter(Boolean))];
  for (const v of vers) {
    const o = document.createElement('option');
    o.value = v; o.textContent = v;
    verSel.appendChild(o);
  }
}

/* ============================================================
 * 事件绑定
 * ============================================================ */
function bindEvents() {
  $('#login-form').addEventListener('submit', tryLogin);
  $('#btn-logout').addEventListener('click', logout);
  $('#btn-refresh').addEventListener('click', loadData);
  $('#btn-export-csv').addEventListener('click', exportCSV);
  $('#btn-export-json').addEventListener('click', exportJSON);

  const onFilter = () => {
    FILTER.dateFrom = $('#f-date-from').value;
    FILTER.dateTo = $('#f-date-to').value;
    FILTER.story = $('#f-story').value;
    FILTER.option = $('#f-option').value;
    FILTER.www = $('#f-search').value.trim().toLowerCase();
    FILTER.minStories = parseInt($('#f-minstories').value, 10) || 0;
    FILTER.version = $('#f-version').value;
    PAGE = 1;
    renderStats(RECORDS);
    renderTable();
  };
  ['f-date-from', 'f-date-to', 'f-story', 'f-option', 'f-minstories', 'f-version']
    .forEach(id => $('#' + id).addEventListener('change', onFilter));
  let st;
  $('#f-search').addEventListener('input', () => { clearTimeout(st); st = setTimeout(onFilter, 250); });

  $('#btn-reset').addEventListener('click', () => {
    FILTER = { dateFrom: '', dateTo: '', story: '', option: '', www: '', minStories: 0, version: '' };
    ['f-date-from', 'f-date-to', 'f-story', 'f-option', 'f-search', 'f-minstories', 'f-version']
      .forEach(id => { const el = $('#' + id); if (el.tagName === 'SELECT') el.value = ''; else el.value = ''; });
    PAGE = 1; renderStats(RECORDS); renderTable();
  });

  // 表格点击事件委托
  $('#table-body').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    const pid = btn.dataset.pid;
    if (act === 'detail') return openDetail(pid);
    if (act === 'page') { PAGE = parseInt(btn.dataset.page, 10); return renderTable(); }
    if (act === 'dl') {
      const r = RECORDS.find(x => x.pid === pid);
      if (r) downloadFile(JSON.stringify(r.choices ? {
        participant_id: r.pid, school: r.school, timestamp: r.date?.toISOString?.() || null,
        experiment_version: r.version, choices: r.choices,
      } : {}, null, 2), `${pid}.json`, 'application/json');
      return;
    }
    if (act === 'del') {
      if (!confirm(`确认删除被试 ${pid} 的数据？此操作不可恢复。`)) return;
      const rec = RECORDS.find(x => x.pid === pid);
      const idx = FILE_INDEX.find(f => f.name === rec?.file);
      if (!idx) return toast('未找到文件');
      if (!SESSION.token) return toast('需要 GitHub Token 才能删除');
      try {
        await deleteFile(idx);
        FILE_INDEX = FILE_INDEX.filter(f => f !== idx);
        RECORDS = RECORDS.filter(r => r.pid !== pid);
        toast('已删除');
        renderStats(RECORDS); renderTable();
      } catch (err) { toast('删除失败：' + err.message); }
    }
  });

  $('#drawer-close').addEventListener('click', () => $('#drawer').classList.add('hidden'));
  $('#drawer-mask').addEventListener('click', () => $('#drawer').classList.add('hidden'));
}

/* ============================================================
 * 启动
 * ============================================================ */
bindEvents();
if (!restoreSession()) {
  $('#login-view').classList.remove('hidden');
}
