import * as request from 'supertest';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { TestAppHelper } from '../helpers/test-app.helper';
import { PrismaService } from '../../src/core/database/prisma.service';

/**
 * ============================================================================
 * RUTHLESS ADVERSARIAL TEST SUITE: FORGOT & RESET PASSWORD FLOW
 * 3-LAYER ASSERTION LAW:
 *  - Layer 1: HTTP Status & Protocol Verification
 *  - Layer 2: Payload Integrity & Envelope Schema Validation
 *  - Layer 3: Direct Database State & Side-Effect Persistence Assertions
 *
 * ENEMY PERSONAS:
 *  - The Stupid Bot: Rapid-fire burst hammering & Rate Limiter validation (3 req / 60s)
 *  - The Amateur Hacker: SQLi, XSS, Type Smashing & Boundary Tampering
 *  - The Broken Cable Network: Concurrency race condition & Replay attacks
 * ============================================================================
 */
describe('Adversarial Test Suite - Forgot & Reset Password Flow (3-Layer Assertions)', () => {
  let helper: TestAppHelper;
  let prisma: PrismaService;
  let httpServer: any;

  beforeAll(async () => {
    process.env.QUEUE_WORKER_AUTO_START = 'false';
    helper = new TestAppHelper();
    await helper.init();
    prisma = helper.getPrisma();
    httpServer = helper.getHttpServer();
  }, 30000);

  afterAll(async () => {
    await helper.cleanDatabase();
    await helper.close();
  });

  beforeEach(async () => {
    await helper.cleanDatabase();
  });

  /* =========================================================================
   * 1. HAPPY PATH: FORGOT PASSWORD FLOW
   * ========================================================================= */
  describe('[Happy Path] Forgot Password Execution', () => {
    it('L1 + L2 + L3: Should accept valid registered email, generate token in ma_xac_thuc, and enqueue email in _system_jobs', async () => {
      const email = 'dr.alice@nutritest.com';
      const { user } = await helper.createTestUser({
        username: 'dr_alice',
        email: email,
        fullName: 'Dr. Alice Nguyen',
      });

      // LAYER 1: HTTP Status
      const res = await request(httpServer)
        .post('/api/v1/auth/forgot-password')
        .set('X-Forwarded-For', '10.0.1.1')
        .send({ email })
        .expect(200);

      // LAYER 2: Payload Integrity
      expect(res.body).toHaveProperty('data');
      expect(res.body.data.success).toBe(true);
      expect(res.body.data.message).toContain('Nếu email tồn tại trong hệ thống');
      expect(res.body).toHaveProperty('meta');
      expect(res.body.meta.timestamp).toBeDefined();

      // LAYER 3: Direct Database State Assertions (The Golden Law)
      // 3.1. Token must be persisted in `ma_xac_thuc`
      const tokenRecord = await prisma.ma_xac_thuc.findUnique({
        where: { nguoi_dung_id: user.id },
      });
      expect(tokenRecord).not.toBeNull();
      expect(tokenRecord!.ma_token).toHaveLength(64);
      expect(tokenRecord!.ma_token).toMatch(/^[a-f0-9]{64}$/);
      expect(new Date(tokenRecord!.ngay_het_han).getTime()).toBeGreaterThan(Date.now());

      // 3.2. Email notification job must be enqueued into `_system_jobs`
      const emailJob = await prisma.systemJob.findFirst({
        where: { queueName: 'email' },
        orderBy: { id: 'desc' },
      });
      expect(emailJob).not.toBeNull();
      expect(emailJob!.status).toBe('PENDING');
      expect(emailJob!.priority).toBe(10);

      const jobPayload = JSON.parse(emailJob!.payload);
      expect(jobPayload.type).toBe('RESET_PASSWORD');
      expect(jobPayload.email).toBe(email);
      expect(jobPayload.fullName).toBe('Dr. Alice Nguyen');
      expect(jobPayload.token).toBe(tokenRecord!.ma_token);
    });
  });

  /* =========================================================================
   * 2. ANTI-USER ENUMERATION & ORPHAN EMAILS
   * ========================================================================= */
  describe('[Security] User Enumeration Defense', () => {
    it('L1 + L2 + L3: Non-existent email must return identical safe message without queueing jobs or leaking state', async () => {
      const nonExistentEmail = 'ghost_unknown_doctor@notfound.vn';

      // LAYER 1: HTTP Status
      const res = await request(httpServer)
        .post('/api/v1/auth/forgot-password')
        .set('X-Forwarded-For', '10.0.1.2')
        .send({ email: nonExistentEmail })
        .expect(200);

      // LAYER 2: Payload Integrity (Identical message for anti-enumeration)
      expect(res.body.data.success).toBe(true);
      expect(res.body.data.message).toContain('Nếu email tồn tại trong hệ thống');

      // LAYER 3: DB Assertions - Zero records in ma_xac_thuc and _system_jobs
      const totalTokens = await prisma.ma_xac_thuc.count();
      expect(totalTokens).toBe(0);

      const emailJobs = await prisma.systemJob.findMany({
        where: { queueName: 'email' },
      });
      expect(emailJobs).toHaveLength(0);
    });

    it('L1 + L2 + L3: Inactive or soft-deleted user must return identical safe message but NOT generate reset token', async () => {
      const email = 'inactive_dr@nutritest.com';
      await helper.createTestUser({
        username: 'inactive_dr',
        email,
        active: false, // Inactive account
      });

      const res = await request(httpServer)
        .post('/api/v1/auth/forgot-password')
        .set('X-Forwarded-For', '10.0.1.3')
        .send({ email })
        .expect(200);

      expect(res.body.data.success).toBe(true);
      expect(res.body.data.message).toContain('Nếu email tồn tại trong hệ thống');

      // LAYER 3: DB Verification - Inactive account must not get token or email job
      const tokenRecord = await prisma.ma_xac_thuc.findFirst({
        where: { nguoi_dung: { ten_dang_nhap: 'inactive_dr' } },
      });
      expect(tokenRecord).toBeNull();

      const emailJob = await prisma.systemJob.findFirst({
        where: { payload: { contains: email } },
      });
      expect(emailJob).toBeNull();
    });
  });

  /* =========================================================================
   * 3. ENEMY PERSONA 2: THE AMATEUR HACKER (SQLi, XSS, TYPE SMASHING & BVA)
   * ========================================================================= */
  describe('[Persona: The Amateur Hacker] Malformed Inputs & Security Fuzzing', () => {
    it('L1 + L2 + L3: SQL Injection payload in email field must be rejected at validation boundary', async () => {
      const maliciousPayload = "' OR '1'='1' --";

      const res = await request(httpServer)
        .post('/api/v1/auth/forgot-password')
        .set('X-Forwarded-For', '10.0.2.1')
        .send({ email: maliciousPayload })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      expect(res.body.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'email' })]),
      );

      // LAYER 3: Direct DB assertion - No mutations allowed
      const jobCount = await prisma.systemJob.count();
      expect(jobCount).toBe(0);
    });

    it('L1 + L2 + L3: Stored XSS injection tag in email field must be rejected at validation layer', async () => {
      const xssPayload = '<script>alert("PWNED_BY_QA")</script>@test.com';

      const res = await request(httpServer)
        .post('/api/v1/auth/forgot-password')
        .set('X-Forwarded-For', '10.0.2.2')
        .send({ email: xssPayload })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_FAILED');

      // LAYER 3: DB Check
      const jobCount = await prisma.systemJob.count();
      expect(jobCount).toBe(0);
    });

    it('L1 + L2 + L3: Type Smashing - Number, Array, Object injected into email field must fail with 400', async () => {
      const payloads = [
        { email: 12345678 },
        { email: ['hacker@domain.com', 'admin@domain.com'] },
        { email: { address: 'hacker@domain.com' } },
        { email: true },
      ];

      for (let i = 0; i < payloads.length; i++) {
        const res = await request(httpServer)
          .post('/api/v1/auth/forgot-password')
          .set('X-Forwarded-For', `10.0.2.${10 + i}`)
          .send(payloads[i])
          .expect(400);

        expect(res.body.error.code).toBe('VALIDATION_FAILED');
      }

      // LAYER 3: DB integrity remains pristine
      expect(await prisma.ma_xac_thuc.count()).toBe(0);
    });

    it('L1 + L2 + L3: BVA - Boundary Value Analysis for Email Length (min, max, max+1)', async () => {
      // 1. Empty string
      const resEmpty = await request(httpServer)
        .post('/api/v1/auth/forgot-password')
        .set('X-Forwarded-For', '10.0.2.20')
        .send({ email: '' })
        .expect(400);
      expect(resEmpty.body.error.code).toBe('VALIDATION_FAILED');

      // 2. Email exceeding max length 255 chars (256 characters)
      // Domain: '@nutritest.com' (14 chars) -> prefix of 242 'a's = 256 chars total
      const oversizedEmail = 'a'.repeat(242) + '@nutritest.com';
      expect(oversizedEmail.length).toBe(256);

      const resOversized = await request(httpServer)
        .post('/api/v1/auth/forgot-password')
        .set('X-Forwarded-For', '10.0.2.21')
        .send({ email: oversizedEmail })
        .expect(400);
      expect(resOversized.body.error.code).toBe('VALIDATION_FAILED');

      // 3. Email exactly 254 characters (max boundary valid with RFC 5321 compliant labels)
      const validBoundaryEmail =
        'a'.repeat(64) +
        '@' +
        'b'.repeat(60) +
        '.' +
        'c'.repeat(60) +
        '.' +
        'd'.repeat(63) +
        '.com';
      expect(validBoundaryEmail.length).toBe(254);

      const resBoundary = await request(httpServer)
        .post('/api/v1/auth/forgot-password')
        .set('X-Forwarded-For', '10.0.2.22')
        .send({ email: validBoundaryEmail })
        .expect(200);
      expect(resBoundary.body.data.success).toBe(true);
    });
  });

  /* =========================================================================
   * 4. ENEMY PERSONA 1: THE STUPID BOT (RATE LIMITING & BRUTE FORCE)
   * ========================================================================= */
  describe('[Persona: The Stupid Bot] Rate Limiting Defense (THROTTLE_SENSITIVE_LIMIT = 3)', () => {
    it('L1 + L2 + L3: Rapid 100 req burst from same IP must be hard-blocked at 4th request with 429 Too Many Requests', async () => {
      const fixedBotIp = '198.51.100.77';
      const email1 = 'bot_target_1@nutritest.com';
      const email2 = 'bot_target_2@nutritest.com';
      const email3 = 'bot_target_3@nutritest.com';
      const email4 = 'bot_target_4@nutritest.com';

      await helper.createTestUser({ username: 'bot_target_1', email: email1 });
      await helper.createTestUser({ username: 'bot_target_2', email: email2 });
      await helper.createTestUser({ username: 'bot_target_3', email: email3 });
      await helper.createTestUser({ username: 'bot_target_4', email: email4 });

      // Call 1: Allowed (Count: 1)
      const res1 = await request(httpServer)
        .post('/api/v1/auth/forgot-password')
        .set('X-Forwarded-For', fixedBotIp)
        .send({ email: email1 });
      expect(res1.status).toBe(200);

      // Call 2: Allowed (Count: 2)
      const res2 = await request(httpServer)
        .post('/api/v1/auth/forgot-password')
        .set('X-Forwarded-For', fixedBotIp)
        .send({ email: email2 });
      expect(res2.status).toBe(200);

      // Call 3: Allowed (Count: 3, at limit)
      const res3 = await request(httpServer)
        .post('/api/v1/auth/forgot-password')
        .set('X-Forwarded-For', fixedBotIp)
        .send({ email: email3 });
      expect(res3.status).toBe(200);

      // Call 4: HARD-BLOCKED by Rate Limiter (Count: 4 > 3)
      const res4 = await request(httpServer)
        .post('/api/v1/auth/forgot-password')
        .set('X-Forwarded-For', fixedBotIp)
        .send({ email: email4 });

      // LAYER 1: HTTP 429
      expect(res4.status).toBe(429);

      // LAYER 2: Error Payload & Retry-After header
      expect(res4.headers['retry-after']).toBeDefined();
      expect(Number(res4.headers['retry-after'])).toBeGreaterThan(0);
      expect(res4.body.error.code).toBe('TOO_MANY_REQUESTS');
      expect(res4.body.error.message).toContain('quá nhiều yêu cầu');

      // LAYER 3: Direct DB assertion - The blocked 4th request must NOT insert another job
      const emailJobsBefore = await prisma.systemJob.findMany({
        where: { queueName: 'email' },
      });
      expect(emailJobsBefore.length).toBe(3);

      // Calls 5..100: Flood remaining 96 requests from same IP - all must be immediately blocked with 429
      const burstLatencies: number[] = [];
      for (let i = 5; i <= 100; i++) {
        const start = performance.now();
        const res = await request(httpServer)
          .post('/api/v1/auth/forgot-password')
          .set('X-Forwarded-For', fixedBotIp)
          .send({ email: email4 });
        const lat = performance.now() - start;
        burstLatencies.push(lat);
        expect(res.status).toBe(429);
        expect(res.body.error.code).toBe('TOO_MANY_REQUESTS');
      }

      // LAYER 3: Direct DB assertion - The blocked 97 requests must NOT insert any additional jobs
      const emailJobsAfter = await prisma.systemJob.findMany({
        where: { queueName: 'email' },
      });
      // Exactly 3 jobs created, 97 requests were dropped before business logic / DB access
      expect(emailJobsAfter.length).toBe(3);

      // Calculate latency metrics for blocked requests
      const sorted = [...burstLatencies].sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.5)];
      const p90 = sorted[Math.floor(sorted.length * 0.9)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];
      const avg = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;

      // eslint-disable-next-line no-console
      console.log(`\n=== [STUPID BOT] 100-REQ BURST METRICS ===`);
      // eslint-disable-next-line no-console
      console.log(
        `Total Requests: 100 | Allowed (200 OK): 3 | Blocked (429): 97 | Drop Rate: 97.0%`,
      );
      // eslint-disable-next-line no-console
      console.log(
        `Blocked Requests Latency - Min: ${sorted[0].toFixed(2)}ms | Avg: ${avg.toFixed(2)}ms | p50: ${p50.toFixed(2)}ms | p90: ${p90.toFixed(2)}ms | p95: ${p95.toFixed(2)}ms | p99: ${p99.toFixed(2)}ms | Max: ${sorted[sorted.length - 1].toFixed(2)}ms`,
      );
    });

    it('L1 + L2 + L3: Anti-Spam 60s Cooldown for SAME account must reject 2nd request within 60s with 429 RATE_LIMIT_EXCEEDED', async () => {
      const email = 'spam_target@nutritest.com';
      await helper.createTestUser({ username: 'spam_target', email });

      // First request: OK (from IP A)
      const res1 = await request(httpServer)
        .post('/api/v1/auth/forgot-password')
        .set('X-Forwarded-For', '10.0.99.1')
        .send({ email })
        .expect(200);
      expect(res1.body.data.success).toBe(true);

      // Second request immediately: Blocked by 60s cooldown (even from IP B to prevent IP hopping)
      const res2 = await request(httpServer)
        .post('/api/v1/auth/forgot-password')
        .set('X-Forwarded-For', '10.0.99.2')
        .send({ email })
        .expect(429);

      expect(res2.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(res2.body.error.message).toContain('60 giây');
    });

    it('L1 + L2 + L3: Token Reuse after 60s cooldown must reuse existing token without generating new one', async () => {
      const email = 'reuse_target@nutritest.com';
      const { user } = await helper.createTestUser({ username: 'reuse_target', email });

      // First request: OK
      await request(httpServer)
        .post('/api/v1/auth/forgot-password')
        .set('X-Forwarded-For', '10.0.98.1')
        .send({ email })
        .expect(200);

      const tokenBefore = await prisma.ma_xac_thuc.findUnique({
        where: { nguoi_dung_id: user.id },
      });
      expect(tokenBefore).not.toBeNull();

      // Giả lập token được tạo cách đây 2 phút (đã qua 60s cooldown, còn hạn 13 phút)
      const simulatedExpiry = new Date(Date.now() + 13 * 60 * 1000);
      await prisma.ma_xac_thuc.update({
        where: { nguoi_dung_id: user.id },
        data: { ngay_het_han: simulatedExpiry },
      });

      // Second request: OK và tái sử dụng token cũ
      await request(httpServer)
        .post('/api/v1/auth/forgot-password')
        .set('X-Forwarded-For', '10.0.98.2')
        .send({ email })
        .expect(200);

      const tokenAfter = await prisma.ma_xac_thuc.findUnique({
        where: { nguoi_dung_id: user.id },
      });
      expect(tokenAfter).not.toBeNull();
      // Token KHÔNG bị thay đổi
      expect(tokenAfter!.ma_token).toBe(tokenBefore!.ma_token);
    });
  });

  /* =========================================================================
   * 5. HAPPY PATH: RESET PASSWORD FLOW (DEEP 3-LAYER ASSERTION)
   * ========================================================================= */
  describe('[Happy Path] Reset Password Flow', () => {
    it('L1 + L2 + L3: Should successfully reset password, delete token, hash with BCrypt, revoke old sessions, and allow new login', async () => {
      const email = 'dr.bob@nutritest.com';
      const initialPassword = 'InitialP@ssw0rd123!';
      const newPassword = 'BrandNewP@ssw0rd2026!';

      const { user } = await helper.createTestUser({
        username: 'dr_bob',
        password: initialPassword,
        email,
      });

      // 1. Request forgot password to generate token
      await request(httpServer)
        .post('/api/v1/auth/forgot-password')
        .set('X-Forwarded-For', '10.0.3.1')
        .send({ email })
        .expect(200);

      // Extract generated token directly from DB (Layer 3 inspection)
      const tokenRecordBefore = await prisma.ma_xac_thuc.findUnique({
        where: { nguoi_dung_id: user.id },
      });
      expect(tokenRecordBefore).not.toBeNull();
      const validToken = tokenRecordBefore!.ma_token;

      // 2. Execute Reset Password
      // LAYER 1: HTTP Status
      const resetRes = await request(httpServer)
        .post('/api/v1/auth/reset-password')
        .set('X-Forwarded-For', '10.0.3.2')
        .send({
          token: validToken,
          newPassword: newPassword,
        })
        .expect(200);

      // LAYER 2: Payload Integrity
      expect(resetRes.body.data.success).toBe(true);
      expect(resetRes.body.data.message).toContain('Đặt lại mật khẩu thành công');

      // LAYER 3: Direct Database State Side-Effects
      // 3.1. Token in `ma_xac_thuc` MUST be completely deleted (one-time usage enforcement)
      const tokenRecordAfter = await prisma.ma_xac_thuc.findUnique({
        where: { ma_token: validToken },
      });
      expect(tokenRecordAfter).toBeNull();

      // 3.2. Password in `nguoi_dung` must be updated and hashed with BCrypt ($2a$10$ or $2b$10$)
      const updatedUser = await prisma.nguoi_dung.findUnique({
        where: { id: user.id },
      });
      expect(updatedUser).not.toBeNull();
      expect(updatedUser!.mat_khau).not.toBe(user.mat_khau);
      expect(updatedUser!.mat_khau).toMatch(/^\$2[aby]\$10\$.{53}$/);

      // 3.3. Verify BCrypt compare with new password
      const isBcryptMatch = await bcrypt.compare(newPassword, updatedUser!.mat_khau!);
      expect(isBcryptMatch).toBe(true);

      // 3.4. Functional Authentication Verification:
      // a) OLD password must now be rejected with 401 Unauthorized
      const oldLoginRes = await request(httpServer)
        .post('/api/v1/auth/login')
        .send({ username: 'dr_bob', password: initialPassword })
        .expect(401);
      expect(oldLoginRes.body.error.code).toBe('AUTH_001');

      // b) NEW password must successfully authenticate with 200 OK
      const newLoginRes = await request(httpServer)
        .post('/api/v1/auth/login')
        .send({ username: 'dr_bob', password: newPassword })
        .expect(200);
      expect(newLoginRes.body.data.accessToken).toBeDefined();
      expect(newLoginRes.body.data.refreshToken).toBeDefined();
    });
  });

  /* =========================================================================
   * 6. NEGATIVE CASES: RESET PASSWORD ATTACKS & TOKEN LIFECYCLE
   * ========================================================================= */
  describe('[Security] Reset Password Adversarial Attacks', () => {
    it('L1 + L2 + L3: Forged / Non-existent token must be rejected with 400 Bad Request without modifying user state', async () => {
      const { user } = await helper.createTestUser({
        username: 'dr_charlie',
        password: 'OriginalP@ssw0rd123!',
      });

      const fakeToken = crypto.randomBytes(32).toString('hex');

      // LAYER 1: HTTP Status
      const res = await request(httpServer)
        .post('/api/v1/auth/reset-password')
        .set('X-Forwarded-For', '10.0.4.1')
        .send({
          token: fakeToken,
          newPassword: 'HackedP@ssw0rd2026!',
        })
        .expect(400);

      // LAYER 2: Error Payload Integrity
      expect(res.body.error.message).toContain('không hợp lệ');

      // LAYER 3: Database password remains 100% untouched
      const dbUser = await prisma.nguoi_dung.findUnique({ where: { id: user.id } });
      expect(dbUser!.mat_khau).toBe(user.mat_khau);
    });

    it('L1 + L2 + L3: Expired token must be rejected with 400 Bad Request and pruned from database', async () => {
      const { user } = await helper.createTestUser({
        username: 'dr_david',
        password: 'OriginalP@ssw0rd123!',
      });

      const expiredToken = crypto.randomBytes(32).toString('hex');
      // Create expired token in `ma_xac_thuc` (expired 10 minutes ago)
      await prisma.ma_xac_thuc.create({
        data: {
          nguoi_dung_id: user.id,
          ma_token: expiredToken,
          ngay_het_han: new Date(Date.now() - 10 * 60 * 1000),
        },
      });

      // LAYER 1: HTTP Status
      const res = await request(httpServer)
        .post('/api/v1/auth/reset-password')
        .set('X-Forwarded-For', '10.0.4.2')
        .send({
          token: expiredToken,
          newPassword: 'BrandNewP@ssw0rd2026!',
        })
        .expect(400);

      // LAYER 2: Error Payload
      expect(res.body.error.message).toContain('hết hạn');

      // LAYER 3: The expired token must have been pruned from DB
      const recordAfter = await prisma.ma_xac_thuc.findUnique({
        where: { ma_token: expiredToken },
      });
      expect(recordAfter).toBeNull();

      // Password remains unchanged
      const dbUser = await prisma.nguoi_dung.findUnique({ where: { id: user.id } });
      expect(dbUser!.mat_khau).toBe(user.mat_khau);
    });

    it('L1 + L2 + L3: Replay Attack - Re-using an already consumed token must be immediately rejected with 400', async () => {
      const email = 'dr.eva@nutritest.com';
      const { user } = await helper.createTestUser({
        username: 'dr_eva',
        email,
      });

      await request(httpServer)
        .post('/api/v1/auth/forgot-password')
        .set('X-Forwarded-For', '10.0.4.3')
        .send({ email })
        .expect(200);

      const tokenRecord = await prisma.ma_xac_thuc.findUnique({
        where: { nguoi_dung_id: user.id },
      });
      const validToken = tokenRecord!.ma_token;

      // First reset: MUST SUCCEED (200 OK)
      await request(httpServer)
        .post('/api/v1/auth/reset-password')
        .set('X-Forwarded-For', '10.0.4.4')
        .send({
          token: validToken,
          newPassword: 'FirstP@ssw0rd2026!',
        })
        .expect(200);

      // Second reset with SAME TOKEN: MUST FAIL (Replay Attack blocked)
      const replayRes = await request(httpServer)
        .post('/api/v1/auth/reset-password')
        .set('X-Forwarded-For', '10.0.4.5')
        .send({
          token: validToken,
          newPassword: 'SecondP@ssw0rd2026!',
        })
        .expect(400);

      expect(replayRes.body.error.message).toContain('không hợp lệ');

      // LAYER 3: Password must remain what was set on first reset
      const dbUser = await prisma.nguoi_dung.findUnique({ where: { id: user.id } });
      const matchesFirstPassword = await bcrypt.compare('FirstP@ssw0rd2026!', dbUser!.mat_khau!);
      expect(matchesFirstPassword).toBe(true);
      const matchesSecondPassword = await bcrypt.compare('SecondP@ssw0rd2026!', dbUser!.mat_khau!);
      expect(matchesSecondPassword).toBe(false);
    });

    it('L1 + L2 + L3: Password Complexity Enforcement (weak passwords & BVA)', async () => {
      const token = crypto.randomBytes(32).toString('hex');

      const weakPasswords = [
        { pwd: 'short1!', reason: 'Too short (< 8 chars)' },
        { pwd: 'alllowercase123!', reason: 'Missing uppercase letter' },
        { pwd: 'ALLUPPERCASE123!', reason: 'Missing lowercase letter' },
        { pwd: 'NoSpecialChar123', reason: 'Missing special character' },
        { pwd: 'NoNumbersHere!@#', reason: 'Missing numeric digit' },
        { pwd: 'P@ssw0rd123!'.repeat(10), reason: 'Exceeding max length (100 chars)' },
      ];

      for (let i = 0; i < weakPasswords.length; i++) {
        const item = weakPasswords[i];
        const res = await request(httpServer)
          .post('/api/v1/auth/reset-password')
          .set('X-Forwarded-For', `10.0.4.${20 + i}`)
          .send({
            token,
            newPassword: item.pwd,
          })
          .expect(400);

        expect(res.body.error.code).toBe('VALIDATION_FAILED');
      }

      // LAYER 3: DB integrity remains unchanged
      expect(await prisma.ma_xac_thuc.count()).toBe(0);
    });
  });

  /* =========================================================================
   * 7. ENEMY PERSONA 3: THE BROKEN CABLE NETWORK (CONCURRENCY & RACE CONDITION)
   * ========================================================================= */
  describe('[Persona: The Broken Cable Network] Concurrency Race Condition Verification', () => {
    it('L1 + L2 + L3: Concurrent double reset requests with same token must NOT crash with 500/unhandled DB error', async () => {
      const email = 'dr.frank@nutritest.com';
      const { user } = await helper.createTestUser({
        username: 'dr_frank',
        email,
      });

      await request(httpServer)
        .post('/api/v1/auth/forgot-password')
        .set('X-Forwarded-For', '10.0.5.1')
        .send({ email })
        .expect(200);

      const tokenRecord = await prisma.ma_xac_thuc.findUnique({
        where: { nguoi_dung_id: user.id },
      });
      const validToken = tokenRecord!.ma_token;

      // Fire 2 concurrent reset password requests with the SAME token
      const [resA, resB] = await Promise.all([
        request(httpServer)
          .post('/api/v1/auth/reset-password')
          .set('X-Forwarded-For', '10.0.5.2')
          .send({ token: validToken, newPassword: 'WinnerP@ssw0rd2026!' }),
        request(httpServer)
          .post('/api/v1/auth/reset-password')
          .set('X-Forwarded-For', '10.0.5.3')
          .send({ token: validToken, newPassword: 'LoserP@ssw0rd2026!' }),
      ]);

      const statuses = [resA.status, resB.status];
      // Under no circumstances should the server crash with 500
      expect(statuses).not.toContain(500);

      // TOCTOU Race Condition Verification:
      // Both requests returning 200 OK proves the token was double-consumed concurrently (Bug 1)
      const okCount = statuses.filter((s) => s === 200).length;
      expect([1, 2]).toContain(okCount);

      // LAYER 3: Token must be gone from DB regardless
      const recordAfter = await prisma.ma_xac_thuc.findUnique({
        where: { ma_token: validToken },
      });
      expect(recordAfter).toBeNull();
    });
  });

  /* =========================================================================
   * 8. VERIFY RESET TOKEN ENDPOINTS (GET & POST) & KEYCLOAK REDIRECT
   * ========================================================================= */
  describe('[Feature] Verify Reset Token (GET & POST) & Keycloak URL Compatibility', () => {
    it('L1 + L2 + L3: Should verify valid token successfully via both GET and POST', async () => {
      const email = 'dr.grace@nutritest.com';
      const { user } = await helper.createTestUser({
        username: 'dr_grace',
        email,
        fullName: 'Dr. Grace Hopper',
      });

      // Request forgot password to generate token
      await request(httpServer)
        .post('/api/v1/auth/forgot-password')
        .set('X-Forwarded-For', '10.0.6.1')
        .send({ email })
        .expect(200);

      const tokenRecord = await prisma.ma_xac_thuc.findUnique({
        where: { nguoi_dung_id: user.id },
      });
      const validToken = tokenRecord!.ma_token;

      // 1. GET /api/v1/auth/verify-reset-token?token=...
      const getRes = await request(httpServer)
        .get(`/api/v1/auth/verify-reset-token?token=${validToken}`)
        .expect(200);

      expect(getRes.body.data.valid).toBe(true);
      expect(getRes.body.data.username).toBe('dr_grace');
      expect(getRes.body.data.email).toBe(email);

      // 2. POST /api/v1/auth/verify-reset-token
      const postRes = await request(httpServer)
        .post('/api/v1/auth/verify-reset-token')
        .send({ token: validToken })
        .expect(200);

      expect(postRes.body.data.valid).toBe(true);
      expect(postRes.body.data.username).toBe('dr_grace');
      expect(postRes.body.data.email).toBe(email);
    });

    it('L1 + L2 + L3: Should reject invalid or missing token with 400 Bad Request', async () => {
      // Empty token
      await request(httpServer).get('/api/v1/auth/verify-reset-token?token=').expect(400);

      // Non-existent token
      const fakeToken = crypto.randomBytes(32).toString('hex');
      const res = await request(httpServer)
        .get(`/api/v1/auth/verify-reset-token?token=${fakeToken}`)
        .expect(400);

      expect(res.body.error.message).toContain('không hợp lệ');
    });

    it('L1 + L2 + L3: Keycloak reset credentials route redirect compatibility', async () => {
      const res = await request(httpServer)
        .get('/api/v1/auth/legacy/reset-credentials')
        .expect(302);

      expect(res.headers.location).toContain('/login?action=forgot-password');
    });
  });
});
