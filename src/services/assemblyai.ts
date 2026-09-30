// Real-Time Speech Streaming & File Transcription Engine: AssemblyAI + Web Speech Fallback

export interface SpeechEventCallbacks {
  onPartialTranscript: (text: string) => void;
  onFinalTranscript: (text: string) => void;
  onError: (error: string) => void;
  onStatusChange: (status: 'connecting' | 'connected' | 'idle' | 'fallback') => void;
}

export interface UtteranceItem {
  speaker: string;
  text: string;
  start: number;
  end: number;
  confidence?: number;
}

export interface TranscriptionResult {
  text: string;
  utterances?: UtteranceItem[];
  sentiment?: Array<{ text: string; sentiment: string; speaker?: string }>;
  chapters?: Array<{ summary: string; headline: string; start: number; end: number }>;
}

export function getAssemblyAiApiKey(): string {
  const local = localStorage.getItem('assemblyai_api_key_referee');
  if (local && local.trim()) return local.trim();
  const envKey = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_ASSEMBLYAI_API_KEY;
  if (envKey && envKey.trim()) return envKey.trim();
  return '';
}

export class StreamingSpeechService {
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private socket: WebSocket | null = null;
  private webSpeechRecognition: unknown = null;
  private isRunning = false;

  async startStreaming(
    apiKey: string | null,
    callbacks: SpeechEventCallbacks,
    deviceId?: string
  ): Promise<MediaStream> {
    this.stopStreaming();
    this.isRunning = true;

    try {
      callbacks.onStatusChange('connecting');
      const audioConstraints: MediaTrackConstraints = {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true
      };
      if (deviceId) {
        audioConstraints.deviceId = { exact: deviceId };
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints
      });
      this.mediaStream = stream;

      const effectiveKey = apiKey && apiKey.trim() ? apiKey.trim() : getAssemblyAiApiKey();

      if (effectiveKey) {
        try {
          await this.connectAssemblyAI(effectiveKey, stream, callbacks);
          return stream;
        } catch (assemblyError) {
          console.warn('AssemblyAI connection failed, falling back to Web Speech:', assemblyError);
          callbacks.onError('AssemblyAI streaming token error. Activated high-fidelity browser speech engine.');
          this.connectWebSpeech(callbacks);
          return stream;
        }
      } else {
        this.connectWebSpeech(callbacks);
        return stream;
      }
    } catch (err: unknown) {
      this.stopStreaming();
      const message = err instanceof Error ? err.message : 'Microphone access denied';
      callbacks.onError(message);
      callbacks.onStatusChange('idle');
      throw err;
    }
  }

  private async connectAssemblyAI(
    apiKey: string,
    stream: MediaStream,
    callbacks: SpeechEventCallbacks
  ): Promise<void> {
    // 1. Fetch temporary token from AssemblyAI v3 streaming endpoint
    const tokenRes = await fetch('https://streaming.assemblyai.com/v3/token?expires_in_seconds=60', {
      method: 'GET',
      headers: {
        'Authorization': apiKey
      }
    });

    if (!tokenRes.ok) {
      throw new Error(`AssemblyAI token fetch failed: HTTP ${tokenRes.status}`);
    }

    const { token } = await tokenRes.json();
    const wsUrl = `wss://streaming.assemblyai.com/v3/ws?token=${encodeURIComponent(token)}&sample_rate=16000`;
    const ws = new WebSocket(wsUrl);
    this.socket = ws;

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioContextClass({ sampleRate: 16000 });
    this.audioContext = ctx;

    const source = ctx.createMediaStreamSource(stream);
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    this.scriptProcessor = processor;

    source.connect(processor);
    processor.connect(ctx.destination);

    ws.onopen = () => {
      callbacks.onStatusChange('connected');
      // Stream raw 16-bit linear PCM audio binary chunks directly
      processor.onaudioprocess = (e) => {
        if (!this.isRunning || ws.readyState !== WebSocket.OPEN) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        ws.send(pcm16.buffer);
      };
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'Turn') {
          if (msg.end_of_turn === false && msg.transcript) {
            callbacks.onPartialTranscript(msg.transcript);
          } else if (msg.end_of_turn === true && msg.transcript && msg.transcript.trim()) {
            callbacks.onFinalTranscript(msg.transcript.trim());
          }
        }
      } catch (err) {
        console.warn('Transcript parse error:', err);
      }
    };

    ws.onerror = (e) => {
      console.warn('AssemblyAI WebSocket error:', e);
      callbacks.onError('AssemblyAI streaming interrupted. Switching to live fallback.');
      this.connectWebSpeech(callbacks);
    };

    ws.onclose = () => {
      if (this.isRunning) {
        callbacks.onStatusChange('idle');
      }
    };
  }

  private connectWebSpeech(callbacks: SpeechEventCallbacks): void {
    const SpeechRec = (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition ||
                      (window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition;

    if (!SpeechRec) {
      callbacks.onError('Web Speech API not supported in this browser. Use keyboard interjections.');
      callbacks.onStatusChange('idle');
      return;
    }

    callbacks.onStatusChange('fallback');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition = new (SpeechRec as any)();
    this.webSpeechRecognition = recognition;

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const trans = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          callbacks.onFinalTranscript(trans.trim());
        } else {
          interim += trans;
        }
      }
      if (interim) {
        callbacks.onPartialTranscript(interim);
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (e: any) => {
      console.warn('Web Speech error:', e.error);
    };

    recognition.onend = () => {
      if (this.isRunning) {
        try { recognition.start(); } catch (e) {}
      }
    };

    try {
      recognition.start();
    } catch (e) {}
  }

  stopStreaming(): void {
    this.isRunning = false;
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }
    if (this.socket) {
      try {
        if (this.socket.readyState === WebSocket.OPEN) {
          this.socket.send(JSON.stringify({ type: 'Terminate' }));
        }
        this.socket.close();
      } catch (e) {}
      this.socket = null;
    }
    if (this.webSpeechRecognition) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      try { (this.webSpeechRecognition as any).stop(); } catch (e) {}
      this.webSpeechRecognition = null;
    }
  }
}

export const speechService = new StreamingSpeechService();

// Pre-recorded Audio File Transcription via AssemblyAI REST API
export async function uploadAndTranscribeAudio(
  file: File,
  apiKey: string,
  onProgress?: (message: string) => void
): Promise<TranscriptionResult> {
  const effectiveKey = apiKey.trim() || getAssemblyAiApiKey();
  if (!effectiveKey) {
    throw new Error('AssemblyAI API Key required for deep audio file processing. Please configure in settings or .env.');
  }

  onProgress?.('Uploading audio file to AssemblyAI secure storage...');

  // Step 1: Upload audio file
  const uploadRes = await fetch('https://api.assemblyai.com/v2/upload', {
    method: 'POST',
    headers: {
      'Authorization': effectiveKey
    },
    body: file
  });

  if (!uploadRes.ok) {
    throw new Error(`AssemblyAI upload failed: HTTP ${uploadRes.status}`);
  }

  const { upload_url } = await uploadRes.json();
  onProgress?.('Audio uploaded. Requesting multi-speaker diarization...');

  // Step 2: Request transcription with speaker diarization & sentiment
  const transcriptRes = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: {
      'Authorization': effectiveKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      audio_url: upload_url,
      speaker_labels: true,
      sentiment_analysis: true,
      auto_highlights: true
    })
  });

  if (!transcriptRes.ok) {
    throw new Error(`AssemblyAI transcription dispatch failed: HTTP ${transcriptRes.status}`);
  }

  const { id: transcriptId } = await transcriptRes.json();
  onProgress?.('Transcribing and identifying speakers...');

  // Step 3: Poll for completion
  let attempts = 0;
  const maxAttempts = 60; // 2 minutes max
  while (attempts < maxAttempts) {
    await new Promise(res => setTimeout(res, 2000));
    attempts++;

    const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
      headers: { 'Authorization': effectiveKey }
    });

    if (!pollRes.ok) continue;

    const data = await pollRes.json();
    if (data.status === 'completed') {
      onProgress?.('Transcription complete!');
      const utterances: UtteranceItem[] = (data.utterances || []).map((u: { speaker: string; text: string; start: number; end: number }) => ({
        speaker: u.speaker,
        text: u.text,
        start: u.start / 1000,
        end: u.end / 1000
      }));

      const sentiment = (data.sentiment_analysis_results || []).map((s: { text: string; sentiment: string; speaker?: string }) => ({
        text: s.text,
        sentiment: s.sentiment,
        speaker: s.speaker
      }));

      return {
        text: data.text || '',
        utterances,
        sentiment
      };
    } else if (data.status === 'error') {
      throw new Error(`AssemblyAI transcription error: ${data.error || 'Unknown error'}`);
    } else {
      onProgress?.(`Processing audio (${attempts * 2}s)... status: ${data.status}`);
    }
  }

  throw new Error('Transcription timed out. Please try again with a shorter audio segment.');
}

// Generate impartial AI consensus proposal using AssemblyAI LeMUR
export async function generateLeMurMediation(
  apiKey: string,
  transcript: string,
  partyA: string,
  partyB: string
): Promise<string> {
  const effectiveKey = apiKey.trim() || getAssemblyAiApiKey();
  if (!effectiveKey) {
    throw new Error('AssemblyAI API Key required to run LeMUR reasoning model.');
  }

  const prompt = `You are Referee, an impartial neutral dispute mediator. 
Given the following hearing transcript between ${partyA} (Party A / Claimant) and ${partyB} (Party B / Respondent):
---
${transcript}
---
Analyze both positions and provide a balanced 3-point resolution agreement. 
Include:
1. Exact financial settlement amount based strictly on spoken admissions.
2. Direct bilateral obligations for both parties.
3. Execution deadline agreed upon in testimony.
Keep the tone firm, impartial, and concise.`;

  try {
    const res = await fetch('https://api.assemblyai.com/v2/lemur/v3/generate/task', {
      method: 'POST',
      headers: {
        'Authorization': effectiveKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt,
        final_model: 'anthropic/claude-3-5-sonnet',
        max_output_size: 1000
      })
    });

    if (!res.ok) {
      throw new Error(`LeMUR request failed: HTTP ${res.status}`);
    }

    const data = await res.json();
    return data.response || 'No consensus recommendation generated.';
  } catch (err) {
    console.warn('LeMUR call failed:', err);
    throw err;
  }
}
