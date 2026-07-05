/**
 * ============================================================
 * Floss-Cake 实验后端 — 飞书多维表格数据写入 v3.0
 * ============================================================
 * 功能：
 *  - 渐进式写入：每完成一个故事即更新飞书表格同行
 *  - 自动创建/更新：按 participant_id 查找，不存在则新建
 *  - UTF-8 编码保证中文无乱码
 * ============================================================
 */

const http = require('http');
const https = require('https');
const { Buffer } = require('buffer');

const CONFIG = {
  port: 3456,
  feishu: {
    appId: 'cli_aac0b2e5c5b8dbee',
    appSecret: 'hchEdlkw0b5ZDuAs0wvtTgbtcW5HsxKc',
    baseAppToken: 'YzhDbKo8pax5cOsY43DcUNYznye',
    tableId: 'tbltLxwtBGtkpxmS',
  },
  allowedOrigins: ['*'],
};

// ============ 飞书 Token ============
let tokenCache = { token: null, expiresAt: 0 };

async function getToken() {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt) return tokenCache.token;
  const resp = await feishuPost('/auth/v3/tenant_access_token/internal', {
    app_id: CONFIG.feishu.appId,
    app_secret: CONFIG.feishu.appSecret,
  });
  tokenCache = { token: resp.tenant_access_token, expiresAt: Date.now() + (resp.expire - 60) * 1000 };
  return tokenCache.token;
}

function feishuPost(path, body) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(JSON.stringify(body), 'utf8');
    const token = tokenCache.token || '';
    const opts = {
      hostname: 'open.feishu.cn', path: '/open-apis' + path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': 'Bearer ' + token,
        'Content-Length': data.length,
      },
    };
    const req = https.request(opts, (res) => {
      let raw = ''; res.on('data', c => raw += c.toString('utf8'));
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch (_) { resolve(raw); } });
    });
    req.on('error', reject); req.write(data); req.end();
  });
}

// ============ 数据转换 ============
function choicesToFields(storyId, choices) {
  const fields = {};
  choices.forEach(c => {
    const qNum = (c.questionId || '').replace('q', '');
    if (qNum) fields[storyId + '_q' + qNum] = c.selectedValue || '';
  });
  return fields;
}

// ============ 渐进式写入 ============
async function progressiveWrite(payload) {
  const token = await getToken();
  const { baseAppToken, tableId } = CONFIG.feishu;
  const base = `https://open.feishu.cn/open-apis/bitable/v1/apps/${baseAppToken}/tables/${tableId}`;

  const participantId = payload.participant_id;

  // 1) 查找该 participant_id 是否已有记录
  let existingRecordId = null;
  try {
    const searchUrl = `${base}/records?filter=CurrentValue.[participant_id]="${encodeURIComponent(participantId)}"&page_size=1`;
    const searchResp = await fetchJSON('GET', searchUrl, token);
    if (searchResp.data && searchResp.data.items && searchResp.data.items.length > 0) {
      existingRecordId = searchResp.data.items[0].record_id;
    }
  } catch (e) { /* 查找失败，视为新记录 */ }

  // 2) 组装要写入的字段
  const storyFields = payload.storyId ? choicesToFields(payload.storyId, payload.questions || []) : {};
  const metaFields = {};
  if (!existingRecordId) {
    // 新建：写入元数据
    metaFields.participant_id = participantId;
    metaFields.experiment_version = payload.experiment_version || '';
    metaFields.story_order = payload.storyId || '';
    metaFields.start_time = payload.start_time || '';
    metaFields.end_time = payload.end_time || '';
    metaFields.duration_seconds = payload.duration_seconds || 0;
    metaFields.browser = (payload.browser || '').substring(0, 200);
    metaFields.language = payload.language || '';
    metaFields.screen_width = payload.screen_width || 0;
    metaFields.screen_height = payload.screen_height || 0;
  } else {
    // 更新：追加 story_order
    metaFields.story_order = payload.story_order || (payload.storyId || '');
    metaFields.end_time = payload.end_time || '';
    metaFields.duration_seconds = payload.duration_seconds || 0;
  }

  const allFields = { ...metaFields, ...storyFields };

  // 3) 写入（新建或更新）
  if (existingRecordId) {
    // 更新已有记录
    const updateUrl = `${base}/records/${existingRecordId}`;
    const updateResp = await fetchJSON('PUT', updateUrl, token, allFields);
    if (updateResp.code === 0) {
      return { success: true, record_id: existingRecordId, action: 'updated' };
    }
    return { success: false, error: updateResp.msg, code: updateResp.code };
  } else {
    // 创建新记录
    const createUrl = `${base}/records`;
    const createResp = await fetchJSON('POST', createUrl, token, { fields: allFields });
    if (createResp.code === 0) {
      const rid = createResp.data && createResp.data.record ? createResp.data.record.record_id : '';
      return { success: true, record_id: rid, action: 'created' };
    }
    return { success: false, error: createResp.msg, code: createResp.code };
  }
}

function fetchJSON(method, url, token, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = body ? Buffer.from(JSON.stringify(body), 'utf8') : null;
    const opts = {
      hostname: u.hostname, path: u.pathname + u.search, method,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': 'Bearer ' + token,
      },
    };
    if (data) opts.headers['Content-Length'] = data.length;
    const req = https.request(opts, (res) => {
      let raw = ''; res.on('data', c => raw += c.toString('utf8'));
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch (_) { resolve(raw); } });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// ============ HTTP 服务 ============
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method === 'POST' && req.url === '/api/submit') {
    let chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', async () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        const body = JSON.parse(raw);

        // 已存在 record_id → 直接 PATCH 更新
        const recordId = body.record_id || body.feishu_record_id || '';
        if (recordId) {
          const token = await getToken();
          const { baseAppToken, tableId } = CONFIG.feishu;
          const fields = choicesToFields(body.storyId || body.story_id || '', body.questions || body.choices || []);
          // 追加 story_order
          fields.story_order = body.story_order || body.storyId || '';
          fields.end_time = body.end_time || '';
          fields.duration_seconds = body.duration_seconds || 0;

          const patchUrl = `https://open.feishu.cn/open-apis/bitable/v1/apps/${baseAppToken}/tables/${tableId}/records/${recordId}`;
          const patchResp = await fetchJSON('PUT', patchUrl, token, { fields });
          if (patchResp.code === 0) {
            console.log(`[updated] participant=${body.participant_id} story=${body.storyId} rid=${recordId}`);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: true, record_id: recordId, action: 'updated' }));
          } else {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: false, error: patchResp.msg, code: patchResp.code }));
          }
          return;
        }

        // 新建记录
        if (body.storiesData && Array.isArray(body.storiesData)) {
          const results = [];
          for (const s of body.storiesData) {
            const r = await progressiveWrite({
              participant_id: body.participant_id,
              experiment_version: body.experiment_version,
              storyId: s.storyId,
              questions: s.choices || [],
              story_order: body.story_order || '',
              start_time: body.start_time, end_time: body.end_time,
              duration_seconds: body.duration_seconds,
              browser: body.browser, language: body.language,
              screen_width: body.screen_width, screen_height: body.screen_height,
            });
            results.push(r);
          }
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: true, results }));
        } else {
          const r = await progressiveWrite(body);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: true, results: [r] }));
        }
      } catch (e) {
        console.error('[Error]', e.message);
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ status: 'ok', time: new Date().toISOString() }));
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(CONFIG.port, () => {
  console.log(`[Floss-Cake Backend v3] 端口 ${CONFIG.port} | UTF-8 | 渐进式写入`);
  console.log(`[Floss-Cake Backend v3] 飞书 Base: ${CONFIG.feishu.baseAppToken}`);
});
