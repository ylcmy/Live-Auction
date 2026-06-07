/**
 * 预生成用户 Token 脚本
 *
 * 批量注册用户并保存 JWT token 到 JSON 文件，
 * 供 Artillery 压测直接使用，跳过运行时 HTTP 注册/登录。
 *
 * 用法: node pre-gen-tokens.cjs [count] [output]
 *   count  - 生成用户数 (默认 1200)
 *   output - 输出文件路径 (默认 ./reports/pre-gen-tokens.json)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const TARGET = process.env.TARGET || 'http://localhost:3002';
const COUNT = parseInt(process.argv[2] || '1200', 10);
const OUTPUT = process.argv[3] || path.join(__dirname, 'reports', 'pre-gen-tokens.json');
const CONCURRENCY = 50; // 并发注册数

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 100 });

function httpPost(urlStr, pathPart, payload) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const body = JSON.stringify(payload);
    const req = http.request({
      hostname: url.hostname,
      port: url.port || 80,
      path: pathPart,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      agent: httpAgent,
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function registerAndGetToken(index) {
  const username = `loadtest_${index}_${Date.now()}`;
  const password = 'Test1234!';
  const nickname = `LoadTest_${index}`;

  try {
    await httpPost(TARGET, '/api/auth/register', { username, password, nickname, role: 'user' });
  } catch {} // ignore duplicate

  const res = await httpPost(TARGET, '/api/auth/login', { username, password });
  if (res.status === 200) {
    const data = JSON.parse(res.body);
    return data?.data?.accessToken || null;
  }
  return null;
}

async function main() {
  console.log(`\n=== 预生成 Token ===`);
  console.log(`目标: ${TARGET}`);
  console.log(`用户数: ${COUNT}`);
  console.log(`并发: ${CONCURRENCY}`);
  console.log(`输出: ${OUTPUT}\n`);

  const tokens = [];
  const start = Date.now();

  // 分批并发注册
  for (let batch = 0; batch < COUNT; batch += CONCURRENCY) {
    const batchSize = Math.min(CONCURRENCY, COUNT - batch);
    const promises = Array.from({ length: batchSize }, (_, i) => registerAndGetToken(batch + i));
    const results = await Promise.all(promises);
    tokens.push(...results.filter(Boolean));

    const done = Math.min(batch + CONCURRENCY, COUNT);
    process.stdout.write(`\r  进度: ${done}/${COUNT} (成功: ${tokens.length})`);
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n\n完成: ${tokens.length}/${COUNT} tokens (${elapsed}s)`);

  // 写入文件
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(tokens, null, 0));
  console.log(`已保存: ${OUTPUT}`);
}

main().catch(console.error);
