import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'http';

function assemblyAiDevProxy(serverApiKey: string): Plugin {
  return {
    name: 'assemblyai-dev-proxy',
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        if (!req.url?.startsWith('/api/assemblyai')) {
          return next();
        }

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-assemblyai-key');

        if (req.method === 'OPTIONS') {
          res.statusCode = 200;
          return res.end();
        }

        const customKey = req.headers['x-assemblyai-key'];
        const apiKey = (typeof customKey === 'string' && customKey.trim()) ? customKey.trim() : serverApiKey;

        const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost:5173'}`);
        const action = parsedUrl.searchParams.get('action');

        if (action === 'status') {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          return res.end(JSON.stringify({
            configured: Boolean(apiKey),
            provider: 'AssemblyAI Local Dev Secure Proxy',
            hasServerKey: Boolean(serverApiKey)
          }));
        }

        if (!apiKey) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 500;
          return res.end(JSON.stringify({
            error: 'AssemblyAI API key not found in server environment (.env ASSEMBLYAI_API_KEY).'
          }));
        }

        try {
          if (action === 'token') {
            const tokenRes = await fetch('https://streaming.assemblyai.com/v3/token?expires_in_seconds=600', {
              method: 'GET',
              headers: { 'Authorization': apiKey }
            });
            const data = await tokenRes.json();
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = tokenRes.status;
            return res.end(JSON.stringify(data));
          }

          if (action === 'upload' && req.method === 'POST') {
            const chunks: Buffer[] = [];
            for await (const chunk of req) {
              chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
            }
            const buffer = Buffer.concat(chunks);

            const uploadRes = await fetch('https://api.assemblyai.com/v2/upload', {
              method: 'POST',
              headers: {
                'Authorization': apiKey,
                'Content-Type': 'application/octet-stream'
              },
              body: buffer
            });
            const data = await uploadRes.json();
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = uploadRes.status;
            return res.end(JSON.stringify(data));
          }

          if (action === 'transcript') {
            if (req.method === 'POST') {
              const chunks: Buffer[] = [];
              for await (const chunk of req) {
                chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
              }
              const buffer = Buffer.concat(chunks);
              let parsedBody = {};
              try { parsedBody = JSON.parse(buffer.toString('utf-8')); } catch {}

              const trRes = await fetch('https://api.assemblyai.com/v2/transcript', {
                method: 'POST',
                headers: {
                  'Authorization': apiKey,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(parsedBody)
              });
              const data = await trRes.json();
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = trRes.status;
              return res.end(JSON.stringify(data));
            }

            if (req.method === 'GET') {
              const transcriptId = parsedUrl.searchParams.get('id');
              const trRes = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
                headers: { 'Authorization': apiKey }
              });
              const data = await trRes.json();
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = trRes.status;
              return res.end(JSON.stringify(data));
            }
          }

          if (action === 'lemur' && req.method === 'POST') {
            const chunks: Buffer[] = [];
            for await (const chunk of req) {
              chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
            }
            const buffer = Buffer.concat(chunks);
            let parsedBody = {};
            try { parsedBody = JSON.parse(buffer.toString('utf-8')); } catch {}

            const lemurRes = await fetch('https://api.assemblyai.com/v2/lemur/v3/generate/task', {
              method: 'POST',
              headers: {
                'Authorization': apiKey,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(parsedBody)
            });
            const data = await lemurRes.json();
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = lemurRes.status;
            return res.end(JSON.stringify(data));
          }

          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 400;
          return res.end(JSON.stringify({ error: `Unknown action: ${action}` }));
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Server proxy error';
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 500;
          return res.end(JSON.stringify({ error: message }));
        }
      });
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const assemblyApiKey = env.ASSEMBLYAI_API_KEY || env.VITE_ASSEMBLYAI_API_KEY || '';

  return {
    plugins: [
      react(),
      assemblyAiDevProxy(assemblyApiKey)
    ],
    server: {
      port: 5173,
      open: false
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-icons': ['lucide-react'],
            'vendor-supabase': ['@supabase/supabase-js'],
            'vendor-pdf': ['jspdf']
          }
        }
      }
    }
  };
});
