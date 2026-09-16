// File: specs/999-test-plan/scripts/sc002-load-test.js
// Change Log:
// - 2026-09-16: สร้าง load-test script สำหรับ SC002 round-2 (D10 → 4B.1/4B.2/4B.5/4B.6/4C.4)
//   pure Node ไม่มี dependency ภายนอก — login ตรงกับ backend (port 3000) เพื่อได้ JWT
//   แล้วยิง /api/ai/intent/classify + /api/ai/admin/host/metrics + clear-failed
//
// ข้อจำกัดที่ต้องรู้ตอนอ่านผล (SC-004):
//   - classify endpoint มี ThrottlerGuard 30 req/min ต่อ req.ip — การยิง 50 ทีเดียวจาก
//     host เดียวจะเจอ HTTP 429 ส่วนหนึ่ง "ตาม production design" (per-IP rate limit)
//   - สคริปต์นี้แยกนับ 429 ออกจาก semaphore_overflow เพื่อไม่ให้ตีความผิด
//   - โหมด waves (≤30 ต่อนาที) วัด semaphore ภายใต้ concurrency ที่ผ่าน throttle ได้จริง
//
// ใช้งาน:
//   node sc002-load-test.js login
//   node sc002-load-test.js concurrent 50
//   node sc002-load-test.js pattern 50
//   node sc002-load-test.js llm 50
//   node sc002-load-test.js metrics 50
//   node sc002-load-test.js clear-failed ai-vector-deletion
//
// env: BASE_URL (default http://localhost:3000), LCBP3_USER, LCBP3_PASS

'use strict';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const USERNAME = process.env.LCBP3_USER || 'superadmin';
const PASSWORD = process.env.LCBP3_PASS || 'Center2025';

/** คำถามที่ควรโดน pattern match (keyword ตรง intent) */
const PATTERN_QUERIES = [
  'สรุปเอกสารนี้',
  'ขอ RFA ล่าสุด',
  'ค้นหาเอกสาร',
  'แสดง transmittal',
  'รายการ circulation',
];

/** คำถามที่ควรหลุดไป LLM fallback (ไม่ตรง pattern ใดเลย) */
const LLM_QUERIES = [
  'ช่วยวิเคราะห์ความเสี่ยงของสัญญาฉบับนี้ให้หน่อยว่ามีจุดไหนควรระวังบ้าง',
  'อยากทราบแนวทางการจัดทำรายงานประจำเดือนที่เหมาะสมสำหรับโครงการก่อสร้างขนาดใหญ่',
  'ถ้าต้องการเปรียบเทียบผลการตรวจสอบคุณภาพงานคอนกรีตระหว่างผู้รับเหมา 2 รายควรดูตัวชี้วัดอะไร',
  'อธิบายขั้นตอนการขออนุมัติเปลี่ยนแปลงแบบก่อสร้างแบบละเอียดให้หน่อย',
  'ช่วยแนะนำวิธีจัดการปัญหางานล่าช้าของช่างไฟฟ้าในโครงการ',
];

async function login() {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });
  const body = await res.json();
  if (res.status !== 200 || !body?.data?.access_token) {
    throw new Error(`login failed: HTTP ${res.status} ${JSON.stringify(body)}`);
  }
  return body.data.access_token;
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

function summarize(name, results) {
  const ok = results.filter(
    (r) => r.httpStatus >= 200 && r.httpStatus < 300
  );
  const throttled = results.filter((r) => r.httpStatus === 429);
  const errors = results.filter(
    (r) => !(r.httpStatus >= 200 && r.httpStatus < 300) && r.httpStatus !== 429
  );
  const overflow = ok.filter((r) => r.method === 'semaphore_overflow');
  const latencies = ok.map((r) => r.latencyMs).sort((a, b) => a - b);

  const methods = {};
  for (const r of ok) {
    methods[r.method || 'unknown'] = (methods[r.method || 'unknown'] || 0) + 1;
  }

  const summary = {
    scenario: name,
    total: results.length,
    http2xx: ok.length,
    http429_throttled: throttled.length,
    httpOther_errors: errors.map((e) => `${e.httpStatus}`).join(',') || 'none',
    semaphore_overflow: overflow.length,
    semaphore_overflow_pct_of_200:
      ok.length > 0 ? ((overflow.length / ok.length) * 100).toFixed(1) : 'n/a',
    latency_ms: {
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      max: latencies.length ? latencies[latencies.length - 1] : 0,
    },
    methods,
  };
  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

async function fireClassify(token, query) {
  const t0 = performance.now();
  try {
    const res = await fetch(`${BASE_URL}/api/ai/intent/classify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query }),
    });
    const latencyMs = performance.now() - t0;
    const body = res.ok ? await res.json() : null;
    return {
      httpStatus: res.status,
      latencyMs,
      method: body?.data?.method ?? body?.method ?? undefined,
      intent: body?.data?.intentCode ?? body?.intentCode ?? undefined,
    };
  } catch (err) {
    return {
      httpStatus: -1,
      latencyMs: performance.now() - t0,
      error: String(err),
    };
  }
}

async function fireMetrics(token) {
  const t0 = performance.now();
  const res = await fetch(`${BASE_URL}/api/ai/admin/host/metrics`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await res.arrayBuffer();
  return { httpStatus: res.status, latencyMs: performance.now() - t0, method: 'metrics' };
}

async function scenarioConcurrent(token, count) {
  console.log(`firing ${count} concurrent classify requests...`);
  const queries = Array.from(
    { length: count },
    (_, i) => LLM_QUERIES[i % LLM_QUERIES.length]
  );
  const results = await Promise.all(queries.map((q) => fireClassify(token, q)));
  return summarize(`concurrent-${count}`, results);
}

async function scenarioSequential(token, name, pool, count) {
  console.log(`firing ${count} sequential ${name} requests...`);
  const results = [];
  for (let i = 0; i < count; i++) {
    results.push(await fireClassify(token, pool[i % pool.length]));
  }
  return summarize(`${name}-${count}`, results);
}

async function scenarioMetrics(token, count) {
  console.log(`firing ${count} sequential host/metrics requests...`);
  const results = [];
  for (let i = 0; i < count; i++) {
    results.push(await fireMetrics(token));
  }
  return summarize(`host-metrics-${count}`, results);
}

/** 4B.6 — trigger clear-failed บน queue แล้ววัดเวลาจนกว่า zset จะว่าง */
async function scenarioClearFailed(token, queueName) {
  console.log(`triggering clear-failed on ${queueName}...`);
  const t0 = performance.now();
  const res = await fetch(
    `${BASE_URL}/api/ai/admin/queues/${queueName}/clear-failed`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    }
  );
  const body = await res.json().catch(() => ({}));
  console.log(`clear-failed trigger: HTTP ${res.status}`, JSON.stringify(body).slice(0, 300));
  const trackingId = body?.data?.trackingId ?? body?.trackingId;
  if (!trackingId) {
    console.log('no trackingId returned — cannot poll status');
    return;
  }
  // poll status ทุก 500ms จน completed/failed
  for (let i = 0; i < 240; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const s = await fetch(
      `${BASE_URL}/api/ai/admin/queues/clear-failed/${trackingId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const sb = await s.json().catch(() => ({}));
    const status = sb?.data?.status ?? sb?.status;
    if (status === 'completed' || status === 'failed') {
      const elapsed = performance.now() - t0;
      console.log(
        JSON.stringify(
          {
            scenario: 'clear-failed',
            trackingId,
            status,
            clearedCount: sb?.data?.clearedCount ?? sb?.clearedCount,
            elapsed_ms: Math.round(elapsed),
            under_5s: elapsed < 5000,
          },
          null,
          2
        )
      );
      return;
    }
  }
  console.log('clear-failed poll timed out after 120s');
}

async function main() {
  const [cmd, arg] = [process.argv[2], process.argv[3]];
  if (cmd === 'login') {
    const token = await login();
    console.log(`login OK — token length ${token.length}`);
    return;
  }
  const token = await login();
  switch (cmd) {
    case 'concurrent':
      await scenarioConcurrent(token, parseInt(arg || '50', 10));
      break;
    case 'pattern':
      await scenarioSequential(token, 'pattern', PATTERN_QUERIES, parseInt(arg || '50', 10));
      break;
    case 'llm':
      await scenarioSequential(token, 'llm', LLM_QUERIES, parseInt(arg || '50', 10));
      break;
    case 'metrics':
      await scenarioMetrics(token, parseInt(arg || '50', 10));
      break;
    case 'clear-failed':
      await scenarioClearFailed(token, arg || 'ai-vector-deletion');
      break;
    default:
      console.error(
        'usage: node sc002-load-test.js [login|concurrent N|pattern N|llm N|metrics N|clear-failed QUEUE]'
      );
      process.exit(1);
  }
}

main().catch((err) => {
  console.error('load test failed:', err);
  process.exit(1);
});
