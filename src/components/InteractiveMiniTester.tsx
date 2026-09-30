import React, { useState } from 'react';
import { Mic, MicOff, Pin, Sparkles } from 'lucide-react';
import { extractCommitment, playTactileSound } from '../utils/audio';

interface MiniClaim {
  id: number;
  quote: string;
  speaker: 'Party A' | 'Party B';
  commitment: string;
  category: string;
}

export const InteractiveMiniTester: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [activeSpeaker, setActiveSpeaker] = useState<'Party A' | 'Party B'>('Party A');
  const [isListening, setIsListening] = useState(false);
  const [pinnedList, setPinnedList] = useState<MiniClaim[]>([
    {
      id: 1,
      quote: 'I paid the full security deposit — eighty thousand rupees — on May 2nd.',
      speaker: 'Party A',
      commitment: '₹80,000 · May 2nd · deposit',
      category: 'Financial'
    },
    {
      id: 2,
      quote: 'My ledger shows seventy thousand, and painting deduction is six thousand rupees.',
      speaker: 'Party B',
      commitment: '₹70,000 · ₹6,000 · painting deduction',
      category: 'Financial'
    }
  ]);

  const handlePin = () => {
    if (!inputText.trim()) return;
    const extracted = extractCommitment(inputText);
    const newClaim: MiniClaim = {
      id: pinnedList.length + 1,
      quote: inputText.trim(),
      speaker: activeSpeaker,
      commitment: extracted ? extracted.commitment : inputText.slice(0, 30),
      category: extracted ? extracted.category : 'Obligation'
    };

    setPinnedList([newClaim, ...pinnedList]);
    setInputText('');
    playTactileSound('pin');
  };

  const handlePreset = (text: string, speaker: 'Party A' | 'Party B') => {
    setInputText(text);
    setActiveSpeaker(speaker);
    playTactileSound('click');
  };

  const toggleMic = () => {
    const SpeechRec = (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition ||
                      (window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition;

    if (!SpeechRec) {
      alert('Web Speech API is not supported in this browser. Please type your claim.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      playTactileSound('click');
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rec = new (SpeechRec as any)();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setIsListening(true);
        playTactileSound('toggle');
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rec.onresult = (e: any) => {
        const text = e.results[0][0].transcript;
        setInputText(text);
        setIsListening(false);
        playTactileSound('pin');
      };

      rec.onerror = () => {
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      rec.start();
    } catch (err) {
      setIsListening(false);
    }
  };

  return (
    <div style={{
      background: 'var(--surface)',
      border: 'var(--border-width) solid var(--border)',
      borderRadius: 'var(--radius-xl)',
      boxShadow: 'var(--shadow-xl)',
      padding: 36
    }}>
      {/* Speaker Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className={`btn btn--sm ${activeSpeaker === 'Party A' ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => { setActiveSpeaker('Party A'); playTactileSound('click'); }}
          >
            Speak as Party A (Tenant/Client)
          </button>
          <button
            className={`btn btn--sm ${activeSpeaker === 'Party B' ? 'btn--yellow' : 'btn--ghost'}`}
            onClick={() => { setActiveSpeaker('Party B'); playTactileSound('click'); }}
          >
            Speak as Party B (Landlord/Vendor)
          </button>
        </div>

        <span className={`pill ${activeSpeaker === 'Party A' ? 'pill--purple' : 'pill--yellow'}`}>
          Active: {activeSpeaker}
        </span>
      </div>

      {/* Input Row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handlePin(); }}
          placeholder="e.g. I transferred ₹80,000 on May 2nd and left the flat cleaned..."
          style={{
            flex: 1,
            minWidth: 260,
            padding: '10px 14px',
            border: '2.5px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-sm)',
            background: 'var(--bg)',
            fontFamily: 'var(--font-main)',
            fontSize: 14,
            color: 'var(--ink)',
            outline: 'none'
          }}
        />

        <button
          className="btn btn--primary"
          onClick={handlePin}
        >
          <Pin size={16} />
          <span>Pin Spoken Claim</span>
        </button>

        <button
          className={`btn ${isListening ? 'btn--coral' : 'btn--ghost'}`}
          onClick={toggleMic}
          title="Speak via Microphone"
        >
          {isListening ? <MicOff size={16} /> : <Mic size={16} />}
          <span>{isListening ? 'Listening...' : 'Speak'}</span>
        </button>
      </div>

      {/* Quick Presets */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24, alignItems: 'center' }}>
        <span className="mono" style={{ fontSize: 12, color: 'var(--ink-dim)' }}>Try presets:</span>
        <button
          className="btn btn--sm btn--ghost"
          onClick={() => handlePreset('I transferred the full deposit of ₹80,000 before move-in.', 'Party A')}
        >
          "Paid ₹80k deposit"
        </button>
        <button
          className="btn btn--sm btn--ghost"
          onClick={() => handlePreset('There is a documented painting deduction of ₹6,000.', 'Party B')}
        >
          "Painting deduction ₹6,000"
        </button>
        <button
          className="btn btn--sm btn--ghost"
          onClick={() => handlePreset('Deliver the source files by Friday and I pay ₹45,000.', 'Party B')}
        >
          "Deliver files by Friday"
        </button>
      </div>

      {/* Mini Table */}
      <div className="matrix-table-wrap">
        <table className="matrix-table">
          <thead>
            <tr>
              <th style={{ width: 50 }}>#</th>
              <th>Verbatim Spoken Words</th>
              <th style={{ width: 120 }}>Speaker</th>
              <th>Extracted Commitment</th>
              <th style={{ width: 140 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {pinnedList.map((item) => (
              <tr key={item.id}>
                <td className="mono" style={{ fontWeight: 700 }}>{String(item.id).padStart(2, '0')}</td>
                <td><i>"{item.quote}"</i></td>
                <td>
                  <span className={`pill ${item.speaker === 'Party A' ? 'pill--purple' : 'pill--yellow'}`}>
                    {item.speaker}
                  </span>
                </td>
                <td><span className="quote-chip">{item.commitment}</span></td>
                <td><span className="pill pill--green">Pinned Verbatim</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
