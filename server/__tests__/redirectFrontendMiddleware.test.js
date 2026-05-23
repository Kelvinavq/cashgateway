jest.mock('../config/env', () => ({
  nodeEnv: 'production',
  frontendUrl: 'https://admin.flowhg.online',
}));

const express = require('express');
const request = require('supertest');
const redirectFrontendMiddleware = require('../middlewares/redirectFrontendMiddleware');

describe('redirectFrontendMiddleware', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(redirectFrontendMiddleware);
    app.get('/api/health', (_req, res) => res.json({ ok: true }));
    app.get('/socket.io/', (_req, res) => res.json({ socket: true }));
    app.get('/api/webhooks/provider/hgcash/:token', (_req, res) => res.status(200).json({ webhook: true }));
    app.use((_req, res) => res.status(404).json({ success: false, message: 'not found' }));
  });

  test('blocks browser navigation outside api routes with a generic 404', async () => {
    const res = await request(app).get('/some-route?tab=1');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, message: 'Not found' });
  });

  test('does not redirect api routes', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  test('does not redirect socket routes', async () => {
    const res = await request(app).get('/socket.io/');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ socket: true });
  });
});
