import * as request from 'supertest';
import { TestAppHelper } from '../helpers/test-app.helper';
import { PrismaService } from '../../src/core/database/prisma.service';
import * as crypto from 'crypto';

describe('Auth Refresh Token Rotation & Replay Attack Defense (RFC 6819) - E2E', () => {
  let helper: TestAppHelper;
  let prisma: PrismaService;
  let httpServer: any;

  beforeAll(async () => {
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

  it('Token Rotation: Làm mới access token, thu hồi refresh token cũ và lưu token mới vào _system_cache', async () => {
    const { rawPassword } = await helper.createTestUser({
      username: 'user_token_rotation',
      password: 'Password123!@#',
    });

    // 1. Đăng nhập để nhận token thế hệ 1
    const loginRes = await request(httpServer)
      .post('/api/v1/auth/login')
      .send({ username: 'user_token_rotation', password: rawPassword })
      .expect(200);

    const token1 = loginRes.body.data.refreshToken;
    expect(token1).toBeDefined();

    // LAYER 3 DB ASSERTION: Kiểm tra token1 được lưu trong _system_cache
    const token1Hash = crypto.createHash('sha256').update(token1.trim()).digest('hex');
    const cachedToken1Before = await prisma.systemCache.findUnique({
      where: { key: `rt:${token1Hash}` },
    });
    expect(cachedToken1Before).not.toBeNull();
    const token1DataBefore = JSON.parse(cachedToken1Before!.value);
    expect(token1DataBefore.isRevoked).toBe(false);

    // 2. Gửi yêu cầu Refresh Token (Generation 1 -> Generation 2)
    const refreshRes = await request(httpServer)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: token1 })
      .expect(200);

    const token2 = refreshRes.body.data.refreshToken;
    expect(token2).toBeDefined();
    expect(token2).not.toBe(token1);

    // LAYER 3 DB ASSERTION:
    // a) Token1 cũ phải bị đánh dấu isRevoked: true trong _system_cache
    const cachedToken1After = await prisma.systemCache.findUnique({
      where: { key: `rt:${token1Hash}` },
    });
    const token1DataAfter = JSON.parse(cachedToken1After!.value);
    expect(token1DataAfter.isRevoked).toBe(true);

    // b) Token2 mới phải có hiệu lực (isRevoked: false)
    const token2Hash = crypto.createHash('sha256').update(token2.trim()).digest('hex');
    const cachedToken2 = await prisma.systemCache.findUnique({
      where: { key: `rt:${token2Hash}` },
    });
    expect(cachedToken2).not.toBeNull();
    const token2Data = JSON.parse(cachedToken2!.value);
    expect(token2Data.isRevoked).toBe(false);
  });

  it('Replay Attack Detection (RFC 6819): Tái sử dụng token đã thu hồi sẽ kích hoạt hủy toàn bộ phiên làm việc', async () => {
    const { rawPassword } = await helper.createTestUser({
      username: 'user_replay_attack',
      password: 'Password123!@#',
    });

    const loginRes = await request(httpServer)
      .post('/api/v1/auth/login')
      .send({ username: 'user_replay_attack', password: rawPassword });

    const token1 = loginRes.body.data.refreshToken;

    // Refresh hợp lệ lần đầu (token1 -> token2)
    await request(httpServer)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: token1 })
      .expect(200);

    // HACKER CỐ TÌNH TÁI SỬ DỤNG TOKEN1 ĐÃ BỊ THU HỒI (REPLAY ATTACK)
    const replayRes = await request(httpServer)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: token1 })
      .expect(401);

    expect(replayRes.body.error.code).toBe('AUTH_REPLAY_ATTACK');
  });

  it('Logout Flow: Thu hồi Refresh Token và cập nhật logout_time trong lich_su_dang_nhap', async () => {
    const { user, rawPassword } = await helper.createTestUser({
      username: 'user_logout_test',
      password: 'Password123!@#',
    });

    const loginRes = await request(httpServer)
      .post('/api/v1/auth/login')
      .send({ username: 'user_logout_test', password: rawPassword });

    const { accessToken, refreshToken, sessionId } = loginRes.body.data;

    // Thực hiện Logout
    await request(httpServer)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken, sessionId })
      .expect(200);

    // LAYER 3 DB ASSERTION:
    // a) Token bị thu hồi trong cache
    const tokenHash = crypto.createHash('sha256').update(refreshToken.trim()).digest('hex');
    const cached = await prisma.systemCache.findUnique({
      where: { key: `rt:${tokenHash}` },
    });
    const parsed = JSON.parse(cached!.value);
    expect(parsed.isRevoked).toBe(true);

    // b) Cập nhật logout_time trong bảng lich_su_dang_nhap
    const loginRecord = await prisma.lich_su_dang_nhap.findFirst({
      where: { nguoi_dung_id: user.id },
      orderBy: { login_time: 'desc' },
    });
    expect(loginRecord?.logout_time).not.toBeNull();
  });
});
