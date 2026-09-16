/**
 * E2E log-tracing proof (logging-tracing P3, AC3–AC5).
 *
 * Sends one request with a known X-Request-ID straight at the Intelligence
 * Service health-adjacent route and asserts the same id is echoed back and
 * present in the managed intelligence log as JSON with the id field.
 * No auth needed: /health is open and passes through the middleware.
 */
import { test, expect, grepIntelligenceLog } from './fixtures';

test.describe('request-id log tracing', () => {
  // Rule 10: suite-level baseURL override; webServer stays top-level in config.
  test.use({ baseURL: 'http://127.0.0.1:8000' });

  test('X-Request-ID echoes and lands in the service log', async ({ request }) => {
    const requestId = crypto.randomUUID();
    const response = await request.get('/health', {
      headers: { 'X-Request-ID': requestId },
    });
    expect(response.status()).toBe(200);
    expect(response.headers()['x-request-id']).toBe(requestId);

    const lines = await grepIntelligenceLog(requestId);
    expect(lines.length).toBeGreaterThan(0);
    const parsed = JSON.parse(lines[lines.length - 1]);
    expect(parsed.request_id).toBe(requestId);
    expect(parsed.path).toBe('/health');
  });
});
