// Vercel Serverless Function: Secure AssemblyAI Proxy
// Keeps the secret API key exclusively on the server, never exposing it to the browser.

export const config = {
  api: {
    bodyParser: false // Allow raw binary streaming for audio file uploads
  }
};

async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', err => reject(err));
  });
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-assemblyai-key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Allow optional client-provided key (BYOK override in settings), otherwise use server environment key
  const customKey = req.headers['x-assemblyai-key'];
  const serverKey = process.env.ASSEMBLYAI_API_KEY;
  const apiKey = (customKey && typeof customKey === 'string' && customKey.trim()) ? customKey.trim() : serverKey;

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const action = url.searchParams.get('action') || (req.query && req.query.action);

  if (action === 'status') {
    return res.status(200).json({
      configured: Boolean(apiKey),
      provider: 'AssemblyAI Secure Enterprise Proxy',
      hasServerKey: Boolean(serverKey)
    });
  }

  if (!apiKey) {
    return res.status(500).json({
      error: 'AssemblyAI API key is not configured on the server. Please configure ASSEMBLYAI_API_KEY in server environment.'
    });
  }

  try {
    // 1. Temporary Streaming Token Generation (for WebSockets)
    if (action === 'token') {
      const response = await fetch('https://streaming.assemblyai.com/v3/token?expires_in_seconds=600', {
        method: 'GET',
        headers: {
          'Authorization': apiKey
        }
      });

      const data = await response.json();
      if (!response.ok) {
        return res.status(response.status).json(data);
      }

      return res.status(200).json({
        token: data.token,
        expires_in_seconds: data.expires_in_seconds || 600
      });
    }

    // 2. Audio File Upload
    if (action === 'upload' && req.method === 'POST') {
      const bodyBuffer = await readRawBody(req);
      const response = await fetch('https://api.assemblyai.com/v2/upload', {
        method: 'POST',
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/octet-stream'
        },
        body: bodyBuffer
      });

      const data = await response.json();
      if (!response.ok) {
        return res.status(response.status).json(data);
      }

      return res.status(200).json(data);
    }

    // 3. Dispatch or Poll Transcription
    if (action === 'transcript') {
      if (req.method === 'POST') {
        const bodyBuffer = await readRawBody(req);
        let parsedBody = {};
        try {
          parsedBody = JSON.parse(bodyBuffer.toString('utf-8'));
        } catch {
          parsedBody = {};
        }

        const response = await fetch('https://api.assemblyai.com/v2/transcript', {
          method: 'POST',
          headers: {
            'Authorization': apiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(parsedBody)
        });

        const data = await response.json();
        return res.status(response.status).json(data);
      }

      if (req.method === 'GET') {
        const transcriptId = url.searchParams.get('id') || (req.query && req.query.id);
        if (!transcriptId) {
          return res.status(400).json({ error: 'Missing transcript ID parameter' });
        }

        const response = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
          method: 'GET',
          headers: {
            'Authorization': apiKey
          }
        });

        const data = await response.json();
        return res.status(response.status).json(data);
      }
    }

    // 4. LeMUR Reasoning & Mediation Consensus
    if (action === 'lemur' && req.method === 'POST') {
      const bodyBuffer = await readRawBody(req);
      let parsedBody = {};
      try {
        parsedBody = JSON.parse(bodyBuffer.toString('utf-8'));
      } catch {
        parsedBody = {};
      }

      const response = await fetch('https://api.assemblyai.com/v2/lemur/v3/generate/task', {
        method: 'POST',
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(parsedBody)
      });

      const data = await response.json();
      return res.status(response.status).json(data);
    }

    return res.status(400).json({ error: `Unsupported action: ${action}` });
  } catch (error) {
    console.error('AssemblyAI proxy server error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal Server Error'
    });
  }
}
