import { request } from 'http';
import { request as httpsRequest } from 'https';

export async function sendWebhook(url, payload, options = {}) {
  const {
    method = 'POST',
    headers = {},
    timeout = 10000,
  } = options;

  const parsed = new URL(url);
  const isHttps = parsed.protocol === 'https:';
  const requester = isHttps ? httpsRequest : request;

  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);

    const req = requester(
      {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          ...headers,
        },
        timeout,
      },
      (res) => {
        let data = '';
        const MAX_RESPONSE_SIZE = 1024 * 10; // 10KB
        res.on('data', (chunk) => {
          if (data.length < MAX_RESPONSE_SIZE) {
            data += chunk;
            if (data.length > MAX_RESPONSE_SIZE) {
              data = data.slice(0, MAX_RESPONSE_SIZE);
            }
          }
        });
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`Webhook responded with status ${res.statusCode}: ${data.slice(0, 200)}`));
            return;
          }
          resolve(data);
        });
        res.on('error', reject);
      },
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Webhook request timed out after ${timeout}ms`));
    });

    req.write(body);
    req.end();
  });
}
