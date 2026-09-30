import React, { useState, useEffect } from 'react';
import { X, Key, CheckCircle, ShieldAlert, Cpu, Sparkles, Loader2, ShieldCheck, Lock } from 'lucide-react';
import { playTactileSound } from '../utils/audio';
import { getAssemblyAiApiKey, checkAssemblyAiEngineStatus } from '../services/assemblyai';

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
  const [customApiKey, setCustomApiKey] = useState('');
  const [serverEngineStatus, setServerEngineStatus] = useState<{ configured: boolean; provider: string; hasServerKey: boolean } | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const savedOverride = getAssemblyAiApiKey();
    setCustomApiKey(savedOverride);
    setTestResult(null);

    // Check backend server proxy status
    checkAssemblyAiEngineStatus().then(status => {
      setServerEngineStatus(status);
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    playTactileSound('click');

    try {
      const headers: Record<string, string> = {};
      if (customApiKey.trim()) {
        headers['x-assemblyai-key'] = customApiKey.trim();
      }

      const res = await fetch('/api/assemblyai?action=token', {
        method: 'GET',
        headers
      });

      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          setTestResult({
            success: true,
            message: customApiKey.trim()
              ? 'Custom API Key verified! High-throughput streaming & LeMUR activated.'
              : 'Secure Backend Engine online! Ephemeral streaming token generated securely.'
          });
          playTactileSound('success');
        } else {
          setTestResult({
            success: false,
            message: 'Server responded without an active token. Check server configuration.'
          });
          playTactileSound('alert');
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setTestResult({
          success: false,
          message: err.error || `Authentication failed (HTTP ${res.status}). Verify credentials.`
        });
        playTactileSound('alert');
      }
    } catch {
      setTestResult({
        success: false,
        message: 'Network error contacting backend proxy. Ensure dev server or deployment is running.'
      });
      playTactileSound('alert');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSave = () => {
    playTactileSound('click');
    onSaveKey(customApiKey.trim());
    onClose();
  };

  const handleClear = () => {
    playTactileSound('click');
    setCustomApiKey('');
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
            <h3 style={{ fontSize: 19 }}>Speech &amp; AI Security Settings</h3>
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
          Referee operates an enterprise-grade <b>AssemblyAI Streaming &amp; LeMUR Proxy</b>. Secret API keys are kept strictly on the backend and never exposed to the browser bundle.
        </p>

        {/* Server Proxy Security Status Badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 14px',
          background: serverEngineStatus?.hasServerKey ? '#ECFDF5' : 'var(--surface-alt)',
          border: `1.5px solid ${serverEngineStatus?.hasServerKey ? '#059669' : 'var(--border)'}`,
          borderRadius: 'var(--radius-md)',
          marginBottom: 18
        }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: serverEngineStatus?.hasServerKey ? '#D1FAE5' : 'var(--bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: serverEngineStatus?.hasServerKey ? '#059669' : 'var(--ink-muted)'
          }}>
            {serverEngineStatus?.hasServerKey ? <ShieldCheck size={18} /> : <Lock size={16} />}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: serverEngineStatus?.hasServerKey ? '#065F46' : 'var(--ink)' }}>
              {serverEngineStatus?.hasServerKey ? 'Backend Server Proxy Active' : 'Backend Proxy Standby'}
            </div>
            <div style={{ fontSize: 11.5, color: serverEngineStatus?.hasServerKey ? '#047857' : 'var(--ink-muted)' }}>
              {serverEngineStatus?.hasServerKey
                ? 'Server environment key configured securely. Tokens minted ephemerally.'
                : 'Connecting to local/cloud backend server proxy...'}
            </div>
          </div>
          <span className="pill mono" style={{ fontSize: 10, background: serverEngineStatus?.hasServerKey ? '#10B981' : '#6B7280', color: '#FFFFFF' }}>
            {serverEngineStatus?.hasServerKey ? 'PROTECTED' : 'READY'}
          </span>
        </div>

        {/* Optional BYOK Override */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-dim)' }}>
              Custom API Key Override (Optional BYOK)
            </label>
            <span style={{ fontSize: 10.5, color: 'var(--ink-muted)', fontStyle: 'italic' }}>
              Overrides backend key locally
            </span>
          </div>
          <input
            type="password"
            value={customApiKey}
            onChange={(e) => setCustomApiKey(e.target.value)}
            placeholder="Leave empty to use secure server-managed key..."
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
            <span>Browser speech recognition fallback is always available automatically if offline.</span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn--sm btn--yellow"
              onClick={handleTestConnection}
              disabled={testingConnection}
            >
              {testingConnection ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
              <span>{testingConnection ? 'Verifying...' : 'Test Connection'}</span>
            </button>
            {customApiKey && (
              <button
                className="btn btn--sm btn--ghost"
                onClick={handleClear}
              >
                Clear Override
              </button>
            )}
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
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
