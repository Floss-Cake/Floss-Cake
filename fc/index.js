/**
 * ============================================================
 * Floss-Cake Serverless — 阿里云 FC Web 函数
 * ============================================================
 *
 * 部署环境变量:
 *   FEISHU_APP_ID      飞书应用 App ID
 *   FEISHU_APP_SECRET  飞书应用 App Secret
 *   FEISHU_BASE_TOKEN  飞书多维表格 ID
 *   FEISHU_TABLE_ID    数据表 ID
 *
 * 启动: node index.js  (监听 9000 端口)
 * 调用: POST /api/submit  →  {"success":true,"record_id":"xxx"}
 * ============================================================
 */

const http = require('http');
const https = require('https');
const { Buffer } = require('buffer');

const PORT = process.env.PORT || 9000;

// ========= 飞书 Token 缓存 =========
let tokenCache = { token: null, expiresAt: 0 };

async function getToken() {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt) return tokenCache.token;
  const resp = await feishuPost('/auth/v3/tenant_access_token/internal', {
    app_id: process.env.FEISHU_APP_ID,
    app_secret: process.env.FEISHU_APP_SECRET,
  });
  tokenCache = { token: resp.tenant_access_token, expiresAt: Date.now() + (resp.expire - 60) * 1000 };
  return tokenCache.token;
}

function feishuPost(path, body) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(JSON.stringify(body), 'utf8');
    const opts = {
      hostname: 'open.feishu.cn', path: '/open-apis' + path, method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Authorization': 'Bearer ' + (tokenCache.token || ''), 'Content-Length': data.length },
    };
    const req = https.request(opts, res => { let r = ''; res.on('data', c => r += c.toString('utf8')); res.on('end', () => { try { resolve(JSON.parse(r)); } catch (_) { resolve(r); } }); });
    req.on('error', reject); req.write(data); req.end();
  });
}

// ========= 数据转换 =========
function choicesToFields(storyId, choices) {
  const f = {};
  choices.forEach(c => { const n = String(c.questionId || '').replace('q', ''); if (n) f[storyId + '_q' + n] = c.selectedValue || ''; });
  return f;
}

// ========= 写入飞书 =========
async function writeRecord(payload) {
  const token = await getToken();
  const { FEISHU_BASE_TOKEN: base, FEISHU_TABLE_ID: table } = process.env;
  const rpc = (method, path, body) => new Promise((res, rej) => {
    const u = new URL(path, 'https://open.feishu.cn');
    const d = body ? Buffer.from(JSON.stringify(body), 'utf8') : null;
    const o = { hostname: u.hostname, path: u.pathname + u.search, method, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Authorization': 'Bearer ' + token } };
    if (d) o.headers['Content-Length'] = d.length;
    const rq = https.request(o, rs => { let b = ''; rs.on('data', c => b += c.toString('utf8')); rs.on('end', () => { try { res(JSON.parse(b)); } catch (_) { res(b); } }); });
    rq.on('error', rej);
    if (d) rq.write(d);
    rq.end();
  });

  const storyFields = choicesToFields(payload.storyId || '', payload.questions || []);
  const recordId = payload.feishu_record_id || '';

  if (recordId) {
    const updt = await rpc('PUT', `/open-apis/bitable/v1/apps/${base}/tables/${table}/records/${recordId}`, {
      fields: { story_order: payload.story_order || payload.storyId || '', end_time: payload.end_time || '', duration_seconds: payload.duration_seconds || 0, ...storyFields }
    });
    if (updt.code === 0) return { success: true, record_id: recordId, action: 'updated' };
    return { success: false, error: updt.msg, code: updt.code };
  }

  const meta = {
    participant_id: payload.participant_id, experiment_version: payload.experiment_version || '',
    story_order: payload.story_order || payload.storyId || '',
    start_time: payload.start_time || '', end_time: payload.end_time || '',
    duration_seconds: payload.duration_seconds || 0,
    browser: (payload.browser || '').substring(0, 200), language: payload.language || '',
    screen_width: payload.screen_width || 0, screen_height: payload.screen_height || 0,
  };
  const crt = await rpc('POST', `/open-apis/bitable/v1/apps/${base}/tables/${table}/records`, { fields: { ...meta, ...storyFields } });
  if (crt.code === 0) return { success: true, record_id: crt.data?.record?.record_id || '', action: 'created' };
  return { success: false, error: crt.msg, code: crt.code };
}

// ========= HTTP Server =========
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // 健康检查
  if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (req.method !== 'POST' || !String(req.url).includes('/api/submit')) {
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Not Found' }));
    return;
  }

  try {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', async () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        const body = JSON.parse(raw);

        // 单故事写入
        if (!body.storiesData || !Array.isArray(body.storiesData)) {
          const r = await writeRecord(body);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: true, results: [r] }));
          return;
        }

        // 多故事批量写入
        const results = [];
        for (const s of body.storiesData) {
          const r = await writeRecord({
            participant_id: body.participant_id, experiment_version: body.experiment_version,
            storyId: s.storyId, questions: s.choices || [],
            story_order: body.story_order || '', start_time: body.start_time,
            end_time: body.end_time, duration_seconds: body.duration_seconds,
            browser: body.browser, language: body.language,
            screen_width: body.screen_width, screen_height: body.screen_height,
            feishu_record_id: body.feishu_record_id || '',
          });
          results.push(r);
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, results }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: false, error: e.message }));
  }
});

server.listen(PORT, () => {
  console.log(`[Floss-Cake FC] listening on port ${PORT}`);
});
