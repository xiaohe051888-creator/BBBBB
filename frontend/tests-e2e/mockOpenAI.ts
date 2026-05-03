import http from 'node:http';

export type MockServer = {
  baseURL: string;
  close: () => Promise<void>;
};

export const startMockOpenAI = async (): Promise<MockServer> => {
  const server = http.createServer((req, res) => {
    if (!req.url) {
      res.statusCode = 404;
      res.end();
      return;
    }

    if (req.method === 'POST' && req.url.startsWith('/v1/chat/completions')) {
      req.on('data', () => {});
      req.on('end', () => {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({
          id: 'mock',
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: 'mock',
          choices: [{ index: 0, message: { role: 'assistant', content: '{"final_prediction":"庄","confidence":0.9,"bet_tier":"标准","summary":"ok"}' }, finish_reason: 'stop' }],
        }));
      });
      return;
    }

    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('not found');
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('mock server failed to bind');

  const baseURL = `http://127.0.0.1:${addr.port}`;

  return {
    baseURL,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
};
