// Tactical Audio Feedback & Sound Synthesizer via Web Audio API

let sharedAudioCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!sharedAudioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) sharedAudioCtx = new AudioContextClass();
  }
  if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

export function playTactileSound(kind: 'click' | 'pin' | 'alert' | 'stamp' | 'success' | 'toggle' | 'action' | 'seal'): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    const soundKind = kind === 'action' ? 'success' : kind === 'seal' ? 'stamp' : kind;

    if (soundKind === 'click') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.05);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (soundKind === 'pin') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(540, now);
      osc.frequency.setValueAtTime(820, now + 0.07);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (soundKind === 'alert') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.setValueAtTime(220, now + 0.1);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.start(now);
      osc.stop(now + 0.22);
    } else if (soundKind === 'stamp') {
      // Heavy tactile stamp impact sound
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(35, now + 0.3);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (soundKind === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(660, now + 0.08);
      osc.frequency.setValueAtTime(880, now + 0.16);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (soundKind === 'toggle') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(500, now);
      osc.frequency.exponentialRampToValueAtTime(700, now + 0.06);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.start(now);
      osc.stop(now + 0.06);
    }
  } catch (err) {
    // Audio context may fail if user hasn't interacted with page yet
  }
}

// Spoken voice narration synthesizer via browser SpeechSynthesis
export function speakNarration(text: string, role: 'a' | 'b' | 'ref'): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    if (role === 'a') {
      utterance.pitch = 1.25;
      utterance.rate = 1.05;
    } else if (role === 'b') {
      utterance.pitch = 0.85;
      utterance.rate = 0.98;
    } else {
      utterance.pitch = 1.0;
      utterance.rate = 0.95;
    }
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.warn('Speech synthesis error:', e);
  }
}

// SHA-256 Cryptographic Hash Engine using Web Crypto API
export async function calculateSha256(content: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Format seconds into MM:SS
export function formatSecondsToTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// Entity & Commitment Extraction Rule-Engine
export function extractCommitment(text: string): { commitment: string; category: 'Financial' | 'Timeline' | 'Obligation' | 'Admission' } | null {
  // Financial amounts: ₹80,000, 80k, $500, 15%, eighty thousand rupees, etc.
  const moneyMatch = text.match(/(?:₹|\$|rs\.?|inr|usd)\s*[\d,]+(?:\s*(?:thousand|lakh|k))?/i) ||
                     text.match(/[\d,]+\s*(?:rupees|dollars|inr|usd|percent|%)/i) ||
                     text.match(/\b\d+k\b/i) ||
                     text.match(/\b(?:eighty|seventy(?:-four)?|sixty|fifty|forty(?:-five)?|thirty|twenty|ten|six|five|four|three|two|one)\s+(?:thousand|hundred|lakh)\s*(?:rupees|dollars)?\b/i);

  // Dates & timelines: Friday, May 2nd, in 3 days, by tonight, seventh of October, etc.
  const dateMatch = text.match(/\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i) ||
                    text.match(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*\d{1,2}(?:st|nd|rd|th)?\b/i) ||
                    text.match(/\b\d{1,2}(?:st|nd|rd|th)?\s*(?:of\s*)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/i) ||
                    text.match(/\b(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+of\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\b/i) ||
                    text.match(/\b(?:in|within|by)\s*\d+\s*(?:days|weeks|hours|months)\b/i) ||
                    text.match(/\b(?:tonight|tomorrow|yesterday|october|november|december)\b/i);

  // Key obligations / concessions / admissions
  const admissionMatch = text.match(/\b(?:concede|admit|error|my mistake|on me|accept|fair)\b/i);
  const actionMatch = text.match(/\b(?:deposit|painting|deduction|invoice|scope|refund|charger|delivery|walkthrough|photos|revisions|transfer|pay|agreed)\b/i);

  if (moneyMatch || dateMatch || actionMatch || admissionMatch) {
    const parts: string[] = [];
    if (moneyMatch) parts.push(moneyMatch[0]);
    if (dateMatch) parts.push(dateMatch[0]);
    if (admissionMatch) parts.push(admissionMatch[0]);
    if (actionMatch && !parts.some(p => p.toLowerCase().includes(actionMatch[0].toLowerCase()))) {
      parts.push(actionMatch[0]);
    }

    const category = moneyMatch
      ? 'Financial'
      : dateMatch
      ? 'Timeline'
      : admissionMatch
      ? 'Admission'
      : 'Obligation';

    return {
      commitment: parts.join(' · ') || text.slice(0, 35),
      category
    };
  }

  return null;
}
