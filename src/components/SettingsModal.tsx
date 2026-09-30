import React, { useState, useEffect } from 'react';
import { X, Key, CheckCircle, ShieldAlert, Cpu, Sparkles, Loader2 } from 'lucide-react';
import { playTactileSound } from '../utils/audio';
import { getAssemblyAiApiKey } from '../services/assemblyai';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveKey: (key: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSaveKey
}) => {
  const [apiKey, setApiKey] = useState('');
  const [envKeyDetected, setEnvKeyDetected] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    const envKey = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_ASSEMBLYAI_API_KEY || '';
    if (envKey && envKey.trim()) {
      setEnvKeyDetected(true);
    }

    const effective = getAssemblyAiApiKey();
    setApiKey(effective);
    setTestResult(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    const keyToTest = apiKey.trim();
    if (!keyToTest) {
      setTestResult({ success: false, message: 'Please enter an AssemblyAI API key to test.' });
      return;
    }

    setTestingConnection(true);
    setTestResult(null);
    playTactileSound('click');

    try {
      const res = await fetch('https://streaming.assemblyai.com/v3/token?expires_in_seconds=60', {
        method: 'GET',
        headers: {
          'Authorization': keyToTest
        }
      });

      if (res.ok) {
        setTestResult({ success: true, message: 'Valid AssemblyAI API Key! Real-time streaming and LeMUR models unlocked.' });
        playTactileSound('success');
      } else {
        const err = await res.json().catch(() => ({}));
        setTestResult({
          success: false,
          message: err.error || `Authentication failed (HTTP ${res.status}). Verify key in AssemblyAI dashboard.`
        });
        playTactileSound('alert');
      }
    } catch {
      setTestResult({
        success: false,
        message: 'Network error contacting AssemblyAI API. Check internet connectivity.'
      });
      playTactileSound('alert');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSave = () => {
    playTactileSound('click');
    onSaveKey(apiKey.trim());
    onClose();
  };

  const handleClear = () => {
    playTactileSound('click');
    setApiKey('');
    onSaveKey('');
    setTestResult(null);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-dialog" style={{ maxWidth: 520, padding: 30 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-sm)',
              background: 'var(--primary-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)'
            }}>
              <Key size={18} />
            </div>
            <h3 style={{ fontSize: 19 }}>Speech Engine Settings</h3>
          </div>
          <button
            className="btn btn--sm btn--ghost"
            style={{ padding: '6px 10px' }}
            onClick={() => { playTactileSound('click'); onClose(); }}
          >
            <X size={16} />
          </button>
        </div>

        <p style={{ fontSize: 13.5, color: 'var(--ink-muted)', marginBottom: 18, lineHeight: 1.5 }}>
          Referee uses <b>AssemblyAI</b> for sub-second real-time streaming speech transcription, multi-speaker diarization, and LeMUR AI consensus proposals.
        </p>

        {envKeyDetected && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#EDE9FE', border: '1.5px solid var(--primary)', borderRadius: 'var(--radius-sm)', marginBottom: 16, color: 'var(--primary)', fontSize: 12.5, fontWeight: 700 }}>
            <Sparkles size={15} />
            <span>Key detected in local .env configuration</span>
          </div>
        )}

        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6, color: 'var(--ink-dim)' }}>
            AssemblyAI API Key (or set in .env)
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Paste your AssemblyAI API key..."
            style={{
              width: '100%',
              padding: '10px 14px',
              border: '2.5px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              boxShadow: '2px 2px 0px var(--shadow-color)',
              background: 'var(--bg)',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              color: 'var(--ink)',
              outline: 'none'
            }}
          />
        </div>

        {testResult && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 14px',
            background: testResult.success ? 'var(--accent-green-light)' : '#FEE2E2',
            border: `1.5px solid ${testResult.success ? 'var(--accent-green)' : '#DC2626'}`,
            borderRadius: 'var(--radius-sm)',
            marginBottom: 18,
            color: testResult.success ? '#065F46' : '#991B1B',
            fontSize: 12.5,
            fontWeight: 600
          }}>
            {testResult.success ? <CheckCircle size={16} /> : <ShieldAlert size={16} />}
            <span>{testResult.message}</span>
          </div>
        )}

        {!testResult && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--surface-alt)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', marginBottom: 20, color: 'var(--ink-dim)', fontSize: 12 }}>
            <Cpu size={14} />
            <span>Microphone streaming falls back seamlessly to native browser speech if unconfigured.</span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn--sm btn--yellow"
              onClick={handleTestConnection}
              disabled={testingConnection || !apiKey}
            >
              {testingConnection ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
              <span>{testingConnection ? 'Testing...' : 'Test API'}</span>
            </button>
            <button
              className="btn btn--sm btn--ghost"
              onClick={handleClear}
              disabled={!apiKey}
            >
              Clear
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn--sm btn--ghost"
              onClick={() => { playTactileSound('click'); onClose(); }}
            >
              Cancel
            </button>
            <button
              className="btn btn--sm btn--primary"
              onClick={handleSave}
            >
              Save Key
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
