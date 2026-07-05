/**
 * ============================================================
 * Floss-Cake 实验后端 — 飞书多维表格数据写入
 * ============================================================
 * 接收前端实验数据，调用飞书 Open API 写入多维表格
 *
 * 启动: node backend/server.js
 * 默认端口: 3456
 * ============================================================
 */

const http = require('http');
const https = require('https');

// ============ 配置 ============
const CONFIG = {
  port: 3456,

  feishu: {
    appId: 'cli_aac0b2e5c5b8dbee',
    appSecret: 'hchEdlkw0b5ZDuAs0wvtTgbtcW5HsxKc',
    baseAppToken: 'YzhDbKo8pax5cOsY43DcUNYznye',
    tableId: 'tbltLxwtBGtkpxmS',
  },

  // CORS 白名单
  allowedOrigins: [
    'https://by4tander.github.io',
    'http://localhost:8080',
    'http://127.0.0.1:8080',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://localhost:3000',
    'null', // 本地文件访问
  ],
};

// ============ 飞书 Token 缓存 ============
let tokenCache = { token: null, expiresAt: 0 };

async function getTenantToken() {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }
  const resp = await feishuPost('/auth/v3/tenant_access_token/internal', {
    app_id: CONFIG.feishu.appId,
    app_secret: CONFIG.feishu.appSecret,
  });
  tokenCache = {
    token: resp.tenant_access_token,
    expiresAt: Date.now() + (resp.expire - 60) * 1000,
  };
  return tokenCache.token;
}

function feishuPost(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const opts = {
      hostname: 'open.feishu.cn',
      path: '/open-apis' + path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (tokenCache.token || ''),
        'Content-Length': Buffer.byteLength(data),
      },
    };
    const req = https.request(opts, (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); } catch (_) { resolve(raw); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ============ 数据转换：实验数据 → 飞书表格行 ============
function transformToTableRow(body) {
  const row = {};

  // 元数据
  row.participant_id = body.participant_id || '';
  row.experiment_version = body.experiment_version || '';
  row.story_order = body.story_order || '';
  row.start_time = body.start_time || '';
  row.end_time = body.end_time || '';
  row.duration_seconds = body.duration_seconds || 0;
  row.browser = (body.browser || '').substring(0, 200);
  row.language = body.language || '';
  row.screen_width = body.screen_width || 0;
  row.screen_height = body.screen_height || 0;

  // 多故事数据：storiesData 格式
  // [{storyId, storyName, choices:[{questionId, selectedValue, selectedLabel}, ...]}, ...]
  const storiesData = body.storiesData || [];
  // 兼容旧格式：单故事 questions 数组
  const legacyQuestions = body.questions || [];

  // 构建 story_order 字符串
  if (!row.story_order && storiesData.length > 0) {
    row.story_order = storiesData.map(s => s.storyId).join(',');
  }

  storiesData.forEach(story => {
    const prefix = story.storyId; // swim, diningHall, playground, brokeleg
    const choices = story.choices || [];
    choices.forEach(c => {
      const qNum = (c.questionId || '').replace('q', '');
      if (qNum) {
        row[prefix + '_q' + qNum] = c.selectedValue || '';
        row[prefix + '_q' + qNum + '_text'] = c.selectedLabel || '';
      }
    });
  });

  // 兼容：旧格式单故事 questions
  if (storiesData.length === 0 && legacyQuestions.length > 0) {
    const storyId = body.story_id || 'unknown';
    const prefix = storyId;
    legacyQuestions.forEach(q => {
      const qNum = (q.questionId || '').replace('q', '');
      if (qNum) {
        row[prefix + '_q' + qNum] = q.selectedValue || q.choice || '';
        row[prefix + '_q' + qNum + '_text'] = q.selectedLabel || q.label || '';
      }
    });
  }

  return row;
}

// ============ 写入飞书多维表格 ============
async function writeToFeishuBase(rowData) {
  const token = await getTenantToken();
  const { baseAppToken, tableId } = CONFIG.feishu;

  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ fields: rowData });
    const opts = {
      hostname: 'open.feishu.cn',
      path: `/open-apis/bitable/v1/apps/${baseAppToken}/tables/${tableId}/records`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
        'Content-Length': Buffer.byteLength(data),
      },
    };
    const req = https.request(opts, (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); } catch (_) { resolve(raw); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ============ HTTP Server ============
const server = http.createServer(async (req, res) => {
  // CORS
  const origin = req.headers.origin || '';
  if (CONFIG.allowedOrigins.includes(origin) || CONFIG.allowedOrigins.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    // 放行所有 origin（开发调试用，生产环境请收紧）
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/api/submit') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      try {
        const parsed = JSON.parse(body);
        const rowData = transformToTableRow(parsed);

        console.log('[提交] participant:', rowData.participant_id, 'story:', rowData.story_name);
        const result = await writeToFeishuBase(rowData);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        if (result.code === 0) {
          console.log('[成功] record_id:', result.data ? result.data.record.record_id : 'ok');
          res.end(JSON.stringify({ success: true, record_id: result.data?.record?.record_id }));
        } else {
          console.error('[飞书错误]', JSON.stringify(result));
          res.end(JSON.stringify({ success: false, error: result.msg || result, code: result.code }));
        }
      } catch (e) {
        console.error('[服务器错误]', e.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // Health check
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', time: new Date().toISOString() }));
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(CONFIG.port, () => {
  console.log(`[Floss-Cake Backend] 启动成功, 端口 ${CONFIG.port}`);
  console.log(`[Floss-Cake Backend] 飞书 Base: ${CONFIG.feishu.baseAppToken}`);
});
