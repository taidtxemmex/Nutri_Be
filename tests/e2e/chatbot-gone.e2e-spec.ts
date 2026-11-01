import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test', override: true });

import * as request from 'supertest';
import { TestAppHelper } from '../helpers/test-app.helper';
import { HttpStatus } from '@nestjs/common';

describe('Chatbot Deprecation E2E (Task 7.5: HTTP 410 Gone)', () => {
  const helper = new TestAppHelper();

  beforeAll(async () => {
    await helper.init();
  });

  afterAll(async () => {
    if (helper.getApp()) {
      await helper.getApp().close();
    }
  });

  describe('Verify All Chatbot Endpoints Return HTTP 410 Gone', () => {
    it('POST /api/v1/chatbot/message should return 410 Gone with CHATBOT_DEPRECATED', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/v1/chatbot/message')
        .send({ message: 'Xin chào, tôi cần tư vấn dinh dưỡng' });

      expect(res.status).toBe(HttpStatus.GONE);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('CHATBOT_DEPRECATED');
      expect(res.body.error.message).toBe('Dịch vụ Chatbot đã ngừng hoạt động vĩnh viễn');
    });

    it('GET /api/v1/chatbot/message should return 410 Gone', async () => {
      const res = await request(helper.getHttpServer()).get('/api/v1/chatbot/message');

      expect(res.status).toBe(HttpStatus.GONE);
      expect(res.body.error.code).toBe('CHATBOT_DEPRECATED');
    });

    it('POST /api/chatbot/message should return 410 Gone', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/chatbot/message')
        .send({ prompt: 'Lập thực đơn giảm cân' });

      expect(res.status).toBe(HttpStatus.GONE);
      expect(res.body.error.code).toBe('CHATBOT_DEPRECATED');
    });

    it('GET /api/chatbot/message should return 410 Gone', async () => {
      const res = await request(helper.getHttpServer()).get('/api/chatbot/message');

      expect(res.status).toBe(HttpStatus.GONE);
      expect(res.body.error.code).toBe('CHATBOT_DEPRECATED');
    });

    it('POST /api/chatbot/ask should return 410 Gone', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/chatbot/ask')
        .send({ question: 'Tôi bị tiểu đường nên ăn gì?' });

      expect(res.status).toBe(HttpStatus.GONE);
      expect(res.body.error.code).toBe('CHATBOT_DEPRECATED');
    });

    it('POST /api/v1/chatbot/ask should return 410 Gone', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/v1/chatbot/ask')
        .send({ question: 'Thực đơn tiểu đường' });

      expect(res.status).toBe(HttpStatus.GONE);
      expect(res.body.error.code).toBe('CHATBOT_DEPRECATED');
    });

    it('GET /api/chatbot should return 410 Gone', async () => {
      const res = await request(helper.getHttpServer()).get('/api/chatbot');

      expect(res.status).toBe(HttpStatus.GONE);
      expect(res.body.error.code).toBe('CHATBOT_DEPRECATED');
    });
  });
});
