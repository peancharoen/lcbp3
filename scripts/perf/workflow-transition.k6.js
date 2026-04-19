// ADR-021 T048: Performance Verification — P95 ≤ 5s for POST /workflow-engine/instances/:id/transition
// Clarify Q4: file ≤ 10MB (รวม ClamAV scan + Redlock + DB transaction)
//
// ใช้งาน:
//   k6 run --env BASE_URL=http://localhost:3001 \
//          --env USERNAME=admin --env PASSWORD=xxx \
//          --env INSTANCE_ID=<uuid> \
//          --env ATTACHMENT_UUID=<uuid> \
//          scripts/perf/workflow-transition.k6.js
//
// Prerequisite:
//   1. มี workflow instance ในสถานะ PENDING_REVIEW หรือ PENDING_APPROVAL
//   2. มีไฟล์แนบขนาด 5-10MB ที่ uploaded_by_user_id = <USERNAME>'s user_id
//      และ is_temporary = false (commit แล้วผ่าน Two-Phase)
//   3. User มีสิทธิ์เป็น assigned handler หรือ superadmin

import http from 'k6/http';
import { check, sleep } from 'k6';
import crypto from 'k6/crypto';
import { Trend } from 'k6/metrics';

// L1: สร้าง UUIDv4 จาก k6/crypto (built-in) แทน remote jslib
// รูปแบบตาม RFC 4122 section 4.4 — 16 bytes random + set version/variant bits
function uuidv4() {
  const bytes = new Uint8Array(crypto.randomBytes(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant RFC 4122
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return (
    hex.slice(0, 8) +
    '-' +
    hex.slice(8, 12) +
    '-' +
    hex.slice(12, 16) +
    '-' +
    hex.slice(16, 20) +
    '-' +
    hex.slice(20, 32)
  );
}

// Custom metric เฉพาะ transition endpoint (ไม่รวม login/upload)
const transitionDuration = new Trend('transition_duration_ms', true);

export const options = {
  scenarios: {
    // Smoke test — 1 VU, 10 iterations = sample 10 transitions
    smoke: {
      executor: 'per-vu-iterations',
      vus: 1,
      iterations: 10,
      maxDuration: '2m',
    },
  },
  thresholds: {
    // ADR-021 Clarify Q4: P95 ≤ 5000ms
    transition_duration_ms: ['p(95) < 5000'],
    http_req_failed: ['rate < 0.01'], // < 1% failure rate
  },
};

// ==============================================================
// Setup — authenticate ครั้งเดียว
// ==============================================================
export function setup() {
  const baseUrl = __ENV.BASE_URL || 'http://localhost:3001';
  const username = __ENV.USERNAME;
  const password = __ENV.PASSWORD;
  const instanceId = __ENV.INSTANCE_ID;
  const attachmentUuid = __ENV.ATTACHMENT_UUID;

  if (!username || !password || !instanceId || !attachmentUuid) {
    throw new Error('Missing env vars. Required: USERNAME, PASSWORD, INSTANCE_ID, ATTACHMENT_UUID');
  }

  const loginRes = http.post(`${baseUrl}/api/auth/login`, JSON.stringify({ username, password }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(loginRes, {
    'login successful': (r) => r.status === 200 || r.status === 201,
  });

  const body = loginRes.json();
  const token = body.accessToken || body.data?.accessToken || body.token;
  if (!token) {
    throw new Error(`Cannot extract token. Response: ${loginRes.body}`);
  }

  return { baseUrl, token, instanceId, attachmentUuid };
}

// ==============================================================
// Default scenario — POST transition พร้อมไฟล์แนบ 1 ไฟล์
// ==============================================================
export default function (data) {
  const { baseUrl, token, instanceId, attachmentUuid } = data;

  // ป้องกัน idempotency cache hit — สร้าง key ใหม่ทุกครั้ง
  const idempotencyKey = uuidv4();

  const payload = JSON.stringify({
    action: 'APPROVE',
    comment: `k6 perf test iter ${__ITER}`,
    attachmentPublicIds: [attachmentUuid],
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'Idempotency-Key': idempotencyKey,
    },
    tags: { name: 'workflow-transition' },
  };

  const start = Date.now();
  const res = http.post(`${baseUrl}/api/workflow-engine/instances/${instanceId}/transition`, payload, params);
  const duration = Date.now() - start;

  transitionDuration.add(duration);

  check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
    'duration < 5s (P95 SLA)': () => duration < 5000,
  });

  if (res.status >= 400) {
    console.error(`Iteration ${__ITER} failed: ${res.status} — ${res.body}`);
  }

  sleep(1); // เว้นระหว่างแต่ละ iteration ให้ worker breathe
}

// ==============================================================
// Teardown — รายงานผลสรุป (k6 auto-report ให้แล้ว ใช้นี้เมื่อต้องการ custom)
// ==============================================================
export function teardown(data) {
  console.log(`Perf test done. Instance: ${data.instanceId}`);
}
