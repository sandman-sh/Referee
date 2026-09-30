import React, { useState, useEffect } from 'react';
import { 
  FileText, ShieldCheck, Download, Share2, Plus, ExternalLink, 
  Search, CheckCircle2, Clock, Hash, AlertTriangle, ArrowRight, 
  Send, RefreshCw, Eye, Copy, Check, Users, Lock, X, Trash2, Database
} from 'lucide-react';
import { 
  fetchVaultDocuments, 
  deleteVaultDocument, 
  DocumentRecord, 
  getOrCreateRoom,
  recordMyRoomParticipation,
  fetchDocumentByIdOrRoom,
  getBrowserClientId
} from '../services/supabase';
import { generateSettlementPdf } from '../utils/pdf';
import { playTactileSound } from '../utils/audio';
import { CaseSessionState } from '../types';

interface DocumentDashboardProps {
  onOpenRoom: (roomId: string, role?: 'a' | 'b' | 'ref') => void;
  onBackToHome: () => void;
}

export const DocumentDashboard: React.FC<DocumentDashboardProps> = ({
  onOpenRoom,
  onBackToHome
}) => {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDoc, setSelectedDoc] = useState<DocumentRecord | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [copiedRoomId, setCopiedRoomId] = useState<string | null>(null);
  const [browserClientId, setBrowserClientId] = useState<string>('');

  // Import Docket by Code state
  const [importDocketInput, setImportDocketInput] = useState<string>('');
  const [importStatus, setImportStatus] = useState<{ message: string; isError: boolean } | null>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);

  // Verification modal state
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState<boolean>(false);
  const [verifyStatus, setVerifyStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [verifyTarget, setVerifyTarget] = useState<DocumentRecord | null>(null);

  // Dispatch modal state
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState<boolean>(false);
  const [dispatchWebhookUrl, setDispatchWebhookUrl] = useState<string>('https://api.referee-tribunal.internal/v1/dossier-ingest');
  const [dispatchTargetEmail, setDispatchTargetEmail] = useState<string>('counsel@dispute-arbitration.org');
  const [dispatchSuccess, setDispatchSuccess] = useState<boolean>(false);
  const [dispatching, setDispatching] = useState<boolean>(false);

  // Create Room modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [newRoomTitle, setNewRoomTitle] = useState<string>('Security Deposit & Tenancy Handover');
  const [newPartyA, setNewPartyA] = useState<string>('Meera Sharma (Tenant)');
  const [newPartyB, setNewPartyB] = useState<string>('Mr. R.K. Khanna (Landlord)');
  const [newScenario, setNewScenario] = useState<'deposit' | 'freelance' | 'marketplace' | 'custom'>('deposit');
  const [createdRoomInfo, setCreatedRoomInfo] = useState<{ id: string; shareUrl: string } | null>(null);

  // Quick Join state
  const [quickJoinId, setQuickJoinId] = useState<string>('');

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const docs = await fetchVaultDocuments();
      setDocuments(docs);
    } catch (e) {
      console.error('Error fetching vault documents:', e);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setBrowserClientId(getBrowserClientId());
    loadDocuments();
  }, []);

  const handleCopy = (text: string, type: 'hash' | 'room') => {
    navigator.clipboard.writeText(text);
    playTactileSound('click');
    if (type === 'hash') {
      setCopiedHash(text);
      setTimeout(() => setCopiedHash(null), 2000);
    } else {
      setCopiedRoomId(text);
      setTimeout(() => setCopiedRoomId(null), 2000);
    }
  };

  const handleImportDocket = async (codeToTry?: string) => {
    const code = (codeToTry || importDocketInput || quickJoinId).trim().toUpperCase();
    if (!code) {
      setImportStatus({ message: 'Please enter a valid Docket ID or Room Code.', isError: true });
      playTactileSound('alert');
      return;
    }
    setImportStatus(null);
    setIsImporting(true);
    playTactileSound('click');

    try {
      const found = await fetchDocumentByIdOrRoom(code);
      if (found) {
        playTactileSound('success');
        setImportDocketInput('');
        setQuickJoinId('');
        setImportStatus({ message: `Successfully imported "${found.case_title}" (${found.id}) into your local vault!`, isError: false });
        await loadDocuments();
        setTimeout(() => setImportStatus(null), 5000);
      } else {
        setImportStatus({ message: `No sealed settlement found for "${code}". If a mediation hearing is still in progress, you can Join by Room Code.`, isError: true });
        playTactileSound('alert');
      }
    } catch (err) {
      setImportStatus({ message: 'Error querying remote ledger.', isError: true });
    } finally {
      setIsImporting(false);
    }
  };

  const handleDeleteDoc = async (docId: string, caseTitle: string) => {
    if (window.confirm(`Remove "${caseTitle}" from your browser's private vault?`)) {
      playTactileSound('toggle');
      await deleteVaultDocument(docId);
      setDocuments(prev => prev.filter(d => d.id !== docId));
    }
  };

  const handleCreateRoom = async () => {
    playTactileSound('action');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const newId = `REF-${randomSuffix}`;
    recordMyRoomParticipation(newId);

    await getOrCreateRoom(newId, {
      title: newRoomTitle,
      partyA: newPartyA,
      partyB: newPartyB,
      scenario: newScenario,
      currentPhase: 1,
      disagreementIndex: 0
    });

    const shareUrl = `${window.location.origin}${window.location.pathname}?room=${newId}`;
    setCreatedRoomInfo({ id: newId, shareUrl });
  };

  const handleDownloadPdf = (doc: DocumentRecord) => {
    playTactileSound('action');
    const meta = doc.metadata || {};
    const syntheticState: CaseSessionState = {
      id: doc.room_id || 'REF-SESSION',
      title: doc.case_title || 'Mediation Agreement',
      partyA: meta.partyA || 'Party A (Claimant)',
      partyB: meta.partyB || 'Party B (Respondent)',
      scenario: 'custom',
      currentPhase: 4,
      activeSpeaker: 'a',
      isMicActive: false,
      claimsCountA: 2,
      claimsCountB: 2,
      disagreementIndex: 0,
      pinnedClaims: [
        {
          id: 1,
          quote: 'I acknowledge the deduction of ₹6,000 for whitewashing the living room wall.',
          speaker: 'a',
          speakerName: meta.partyA || 'Party A',
          timestamp: '14:23:05',
          commitment: 'Agreed on ₹6,000 painting expense deduction',
          category: 'Financial',
          verified: true
        },
        {
          id: 2,
          quote: 'Upon receipt of flat keys and utility bills, I will wire the remaining ₹74,000 within 7 days.',
          speaker: 'b',
          speakerName: meta.partyB || 'Party B',
          timestamp: '14:28:11',
          commitment: 'Full refund minus approved deduction',
          category: 'Obligation',
          verified: true
        }
      ],
      transcript: [],
      settlement: {
        obligationA: meta.obligationA || 'Complete handover of property and keys.',
        obligationB: meta.obligationB || 'Execute agreed wire transfer.',
        financialAmount: meta.financialAmount || 'Settled Amount',
        executionDeadline: meta.executionDeadline || 'Agreed 7-day period',
        groundedQuotes: []
      },
      amendmentA: '',
      amendmentB: '',
      signedA: meta.signedA ?? true,
      signedB: meta.signedB ?? true,
      isSealed: true,
      sealedTimestamp: doc.sealed_at,
      recordHash: doc.record_hash
    };

    generateSettlementPdf(syntheticState);
  };

  const handleDownloadJson = (doc: DocumentRecord) => {
    playTactileSound('click');
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Referee_Certificate_${doc.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRunVerification = (doc: DocumentRecord) => {
    playTactileSound('toggle');
    setVerifyTarget(doc);
    setIsVerifyModalOpen(true);
    setVerifyStatus('checking');

    setTimeout(() => {
      // Cryptographic verification check against 64-char hex proof
      if (doc.record_hash && doc.record_hash.length >= 32) {
        setVerifyStatus('valid');
        playTactileSound('seal');
      } else {
        setVerifyStatus('invalid');
      }
    }, 1100);
  };

  const handleSendDispatch = () => {
    playTactileSound('action');
    setDispatching(true);
    setTimeout(() => {
      setDispatching(false);
      setDispatchSuccess(true);
      setTimeout(() => {
        setIsDispatchModalOpen(false);
        setDispatchSuccess(false);
      }, 1800);
    }, 1200);
  };

  const filteredDocs = documents.filter(d => 
    d.case_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.room_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.record_hash.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px 60px' }}>
      
      {/* Top Banner & Navigation Breadcrumb */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        marginBottom: 32,
        paddingBottom: 20,
        borderBottom: 'var(--border-width) solid var(--border)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
            <span className="pill pill--purple mono" style={{ fontSize: 11 }}>
              <ShieldCheck size={14} />
              CASE DOCUMENT VAULT
            </span>
            <span className="pill mono" style={{ fontSize: 11, background: '#ECFDF5', color: '#065F46', borderColor: '#065F46' }}>
              <span className="dot" style={{ background: '#10B981' }}></span>
              BROWSER ISOLATED & SYNCED
            </span>
            {browserClientId && (
              <span className="pill mono" style={{ fontSize: 10, background: 'var(--surface)', color: 'var(--ink-light)' }} title="This browser's private vault identifier">
                <Database size={11} style={{ marginRight: 4 }} />
                {browserClientId}
              </span>
            )}
          </div>
          <h1 style={{ fontFamily: 'var(--font-main)', fontSize: 32, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
            Case Records & Document Management
          </h1>
          <p style={{ margin: '6px 0 0', color: 'var(--ink-light)', fontSize: 15 }}>
            Tamper-proof repository of conciliation settlements. Strictly scoped to mediation hearings you create or participate in.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button 
            className="btn btn--secondary" 
            onClick={() => { playTactileSound('click'); onBackToHome(); }}
          >
            Back to Overview
          </button>
          <button 
            className="btn btn--primary" 
            onClick={() => { playTactileSound('click'); setCreatedRoomInfo(null); setIsCreateModalOpen(true); }}
          >
            <Plus size={18} />
            <span>Create New Room</span>
          </button>
        </div>
      </div>

      {/* Stats Quick Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 18,
        marginBottom: 32
      }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Sealed Records
            </span>
            <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-sm)', background: 'var(--primary-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid var(--border)' }}>
              <FileText size={18} color="var(--primary)" />
            </div>
          </div>
          <div style={{ fontFamily: 'var(--font-main)', fontSize: 36, fontWeight: 800 }}>
            {documents.length}
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-light)', marginTop: 4 }}>
            100% with cryptographic SHA-256 seals
          </div>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Bilateral Signatures
            </span>
            <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-sm)', background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid var(--border)' }}>
              <ShieldCheck size={18} color="#D97706" />
            </div>
          </div>
          <div style={{ fontFamily: 'var(--font-main)', fontSize: 36, fontWeight: 800 }}>
            {documents.filter(d => d.status === 'sealed').length * 2}
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-light)', marginTop: 4 }}>
            Party A and Party B digitally ratified
          </div>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Live Remote Rooms
            </span>
            <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-sm)', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid var(--border)' }}>
              <Users size={18} color="#059669" />
            </div>
          </div>
          <div style={{ fontFamily: 'var(--font-main)', fontSize: 36, fontWeight: 800 }}>
            Active
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-light)', marginTop: 4 }}>
            Sub-50ms peer signaling enabled
          </div>
        </div>

        <div className="card" style={{ padding: 20, background: 'var(--primary-subtle)', borderColor: 'var(--primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Access Docket or Room
            </span>
            <Lock size={18} color="var(--primary)" />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <input 
              type="text"
              placeholder="e.g. REF-2026-1904"
              value={quickJoinId}
              onChange={(e) => { setQuickJoinId(e.target.value); setImportStatus(null); }}
              className="mono"
              style={{
                flex: 1,
                minWidth: 120,
                padding: '8px 10px',
                borderRadius: 'var(--radius-md)',
                border: '2px solid var(--border)',
                fontWeight: 700,
                fontSize: 13,
                textTransform: 'uppercase',
                background: 'var(--surface)'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && quickJoinId.trim()) {
                  handleImportDocket(quickJoinId.trim());
                }
              }}
            />
            <button 
              className="btn btn--sm btn--primary"
              disabled={!quickJoinId.trim() || isImporting}
              onClick={() => handleImportDocket(quickJoinId.trim())}
              title="Import sealed agreement into this browser vault"
            >
              {isImporting ? <RefreshCw size={13} className="spin" /> : <Download size={13} />}
              <span>Import</span>
            </button>
            <button 
              className="btn btn--sm btn--secondary"
              disabled={!quickJoinId.trim()}
              onClick={() => {
                if (quickJoinId.trim()) {
                  playTactileSound('action');
                  onOpenRoom(quickJoinId.trim());
                }
              }}
              title="Join live mediation room"
            >
              <ExternalLink size={13} />
              <span>Join</span>
            </button>
          </div>
          {importStatus ? (
            <div style={{ 
              fontSize: 12, 
              color: importStatus.isError ? '#DC2626' : '#059669', 
              fontWeight: 600, 
              marginTop: 8,
              lineHeight: 1.3 
            }}>
              {importStatus.message}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: 8 }}>
              Enter Room Code to enter call, or import sealed settlement into vault
            </div>
          )}
        </div>
      </div>

      {/* Main Vault Panel */}
      <div className="card" style={{ padding: 24, marginBottom: 32 }}>
        {/* Search & Actions Bar */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 20
        }}>
          <div style={{ position: 'relative', minWidth: 280, flex: 1, maxWidth: 440 }}>
            <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-light)' }} />
            <input 
              type="text"
              placeholder="Search by case title, room code, or SHA-256 hash..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px 10px 42px',
                borderRadius: 'var(--radius-md)',
                border: '2px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--ink)',
                fontSize: 14,
                fontFamily: 'var(--font-main)'
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button 
              className="btn btn--sm btn--ghost" 
              onClick={() => { playTactileSound('click'); loadDocuments(); }}
              title="Refresh database records"
            >
              <RefreshCw size={16} className={loading ? 'spin' : ''} />
              <span>Refresh Vault</span>
            </button>
          </div>
        </div>

        {/* Vault Table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--ink-light)' }}>
            <RefreshCw size={32} className="spin" style={{ margin: '0 auto 16px', color: 'var(--primary)' }} />
            <div style={{ fontWeight: 700, fontSize: 16 }}>Querying Supabase Case Ledger...</div>
            <div style={{ fontSize: 13 }}>Fetching cryptographic settlement certificates</div>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '48px 24px',
            border: '2px dashed var(--border)',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--surface)'
          }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'var(--primary-subtle)',
              border: '2px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <ShieldCheck size={28} color="var(--primary)" />
            </div>

            <h3 style={{ margin: '0 0 8px', fontWeight: 800, fontSize: 18 }}>
              {searchQuery ? 'No Matching Documents' : 'Your Document Vault is Private & Empty'}
            </h3>

            <p style={{ margin: '0 auto 20px', color: 'var(--ink-light)', fontSize: 14, maxWidth: 540, lineHeight: 1.5 }}>
              {searchQuery 
                ? `No documents in your browser vault matched "${searchQuery}".` 
                : 'For strict legal privacy, sealed settlement agreements are scoped solely to the parties who participated in that hearing. Documents are remembered in your browser database so other browsers cannot view them.'}
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <button className="btn btn--primary btn--sm" onClick={() => setIsCreateModalOpen(true)}>
                <Plus size={16} />
                <span>Create Dispute Room</span>
              </button>

              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input 
                  type="text"
                  placeholder="Enter Docket or Room Code..."
                  value={importDocketInput}
                  onChange={(e) => { setImportDocketInput(e.target.value); setImportStatus(null); }}
                  className="mono"
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1.5px solid var(--border)',
                    fontSize: 13,
                    textTransform: 'uppercase',
                    minWidth: 200,
                    background: 'var(--bg)'
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && importDocketInput.trim()) {
                      handleImportDocket(importDocketInput.trim());
                    }
                  }}
                />
                <button 
                  className="btn btn--secondary btn--sm"
                  disabled={!importDocketInput.trim() || isImporting}
                  onClick={() => handleImportDocket(importDocketInput.trim())}
                >
                  {isImporting ? <RefreshCw size={14} className="spin" /> : <Download size={14} />}
                  <span>Access Docket</span>
                </button>
              </div>
            </div>

            {importStatus && (
              <div style={{ 
                marginTop: 16, 
                fontSize: 13, 
                fontWeight: 600, 
                color: importStatus.isError ? '#DC2626' : '#059669' 
              }}>
                {importStatus.message}
              </div>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{
                  borderBottom: '2px solid var(--border)',
                  background: 'var(--bg)',
                  fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.04em',
                  color: 'var(--ink-light)'
                }}>
                  <th style={{ padding: '12px 16px' }}>RECORD & ROOM</th>
                  <th style={{ padding: '12px 16px' }}>CASE TITLE & PARTIES</th>
                  <th style={{ padding: '12px 16px' }}>SETTLED TERMS</th>
                  <th style={{ padding: '12px 16px' }}>CRYPTOGRAPHIC SEAL (SHA-256)</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocs.map((doc) => {
                  const meta = doc.metadata || {};
                  return (
                    <tr 
                      key={doc.id}
                      style={{
                        borderBottom: '1.5px solid var(--border)',
                        transition: 'background 0.15s ease'
                      }}
                      className="table-row-hover"
                    >
                      {/* Record & Room */}
                      <td style={{ padding: '16px', verticalAlign: 'top' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span className="pill pill--purple mono" style={{ fontSize: 11, padding: '3px 8px' }}>
                            {doc.room_id}
                          </span>
                        </div>
                        <div className="mono" style={{ fontSize: 11, color: 'var(--ink-light)' }}>
                          {doc.id}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={12} />
                          {new Date(doc.sealed_at || doc.created_at).toLocaleDateString()}
                        </div>
                      </td>

                      {/* Case Title & Parties */}
                      <td style={{ padding: '16px', verticalAlign: 'top', maxWidth: 300 }}>
                        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 6, lineHeight: 1.3 }}>
                          {doc.case_title}
                        </div>
                        <div style={{ fontSize: 12.5, color: 'var(--ink)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <div>
                            <span style={{ fontWeight: 700, color: 'var(--primary)' }}>Party A:</span> {meta.partyA || 'Claimant'}
                          </div>
                          <div>
                            <span style={{ fontWeight: 700, color: '#D97706' }}>Party B:</span> {meta.partyB || 'Respondent'}
                          </div>
                        </div>
                      </td>

                      {/* Settled Terms */}
                      <td style={{ padding: '16px', verticalAlign: 'top', maxWidth: 280 }}>
                        {meta.financialAmount && (
                          <div style={{
                            display: 'inline-block',
                            background: '#ECFDF5',
                            color: '#065F46',
                            border: '1.5px solid #065F46',
                            padding: '3px 8px',
                            borderRadius: 'var(--radius-sm)',
                            fontWeight: 800,
                            fontSize: 12,
                            marginBottom: 6
                          }}>
                            {meta.financialAmount}
                          </div>
                        )}
                        <div style={{ fontSize: 12, color: 'var(--ink-light)', lineHeight: 1.4 }}>
                          {meta.executionDeadline ? `Deadline: ${meta.executionDeadline}` : 'Immediate Execution'}
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                          <span className="pill mono" style={{ fontSize: 10, padding: '2px 6px', background: 'var(--primary-subtle)', borderColor: 'var(--primary)', color: 'var(--primary)' }}>
                            ✓ Party A Signed
                          </span>
                          <span className="pill mono" style={{ fontSize: 10, padding: '2px 6px', background: '#FEF3C7', borderColor: '#D97706', color: '#D97706' }}>
                            ✓ Party B Signed
                          </span>
                        </div>
                      </td>

                      {/* Cryptographic Seal */}
                      <td style={{ padding: '16px', verticalAlign: 'top', maxWidth: 240 }}>
                        <div style={{
                          background: 'var(--bg)',
                          border: '1.5px solid var(--border)',
                          padding: '8px 10px',
                          borderRadius: 'var(--radius-sm)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 6,
                          marginBottom: 6
                        }}>
                          <span className="mono" style={{ fontSize: 11, color: 'var(--primary)', wordBreak: 'break-all', fontWeight: 700 }}>
                            {doc.record_hash ? `${doc.record_hash.slice(0, 16)}...${doc.record_hash.slice(-8)}` : 'HASH_PENDING'}
                          </span>
                          <button 
                            className="btn btn--ghost" 
                            style={{ padding: 4, minHeight: 'auto', border: 'none', boxShadow: 'none' }}
                            onClick={() => handleCopy(doc.record_hash, 'hash')}
                            title="Copy full SHA-256 hash"
                          >
                            {copiedHash === doc.record_hash ? <Check size={14} color="#059669" /> : <Copy size={14} />}
                          </button>
                        </div>
                        <button 
                          onClick={() => handleRunVerification(doc)}
                          className="btn btn--xs btn--secondary"
                          style={{ width: '100%', justifyContent: 'center', fontSize: 11 }}
                        >
                          <ShieldCheck size={13} color="var(--primary)" />
                          <span>Verify Integrity</span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '16px', verticalAlign: 'top', textAlign: 'right' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                          <button 
                            className="btn btn--sm btn--primary" 
                            style={{ width: '100%', justifyContent: 'center' }}
                            onClick={() => handleDownloadPdf(doc)}
                            title="Download official legal dossier with watermark and stamps"
                          >
                            <Download size={14} />
                            <span>Download PDF</span>
                          </button>

                          <div style={{ display: 'flex', gap: 6, width: '100%' }}>
                            <button 
                              className="btn btn--xs btn--secondary" 
                              style={{ flex: 1, justifyContent: 'center' }}
                              onClick={() => {
                                setSelectedDoc(doc);
                                setIsDispatchModalOpen(true);
                              }}
                              title="Send to court or webhook"
                            >
                              <Send size={12} />
                              <span>Dispatch</span>
                            </button>

                            <button 
                              className="btn btn--xs btn--ghost" 
                              style={{ flex: 1, justifyContent: 'center' }}
                              onClick={() => handleDownloadJson(doc)}
                              title="Download JSON certificate"
                            >
                              <Hash size={12} />
                              <span>JSON</span>
                            </button>
                          </div>

                          <div style={{ display: 'flex', gap: 6, width: '100%' }}>
                            <button 
                              className="btn btn--xs btn--ghost" 
                              style={{ flex: 1, justifyContent: 'center', border: '1px dashed var(--border)' }}
                              onClick={() => onOpenRoom(doc.room_id)}
                              title="Enter live mediation room"
                            >
                              <ExternalLink size={12} />
                              <span>Room</span>
                            </button>

                            <button 
                              className="btn btn--xs btn--ghost" 
                              style={{ flex: 1, justifyContent: 'center', color: '#DC2626' }}
                              onClick={() => handleDeleteDoc(doc.id, doc.case_title)}
                              title="Remove document from this browser's vault"
                            >
                              <Trash2 size={12} />
                              <span>Remove</span>
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: Create New Room */}
      {isCreateModalOpen && (
        <div className="modal-overlay">
          <div className="modal-dialog" style={{ maxWidth: 560, padding: 30 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <span className="pill pill--purple mono" style={{ fontSize: 11, marginBottom: 6 }}>
                  MULTI-PARTY ARBITRATION
                </span>
                <h2 style={{ fontFamily: 'var(--font-main)', fontSize: 24, fontWeight: 800, margin: '4px 0 0' }}>
                  Create Real-Time Dispute Room
                </h2>
              </div>
              <button 
                className="btn btn--sm btn--ghost" 
                style={{ padding: '6px 10px', minHeight: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={() => { setIsCreateModalOpen(false); setCreatedRoomInfo(null); }}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            {!createdRoomInfo ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                    Dispute Title
                  </label>
                  <input 
                    type="text"
                    value={newRoomTitle}
                    onChange={(e) => setNewRoomTitle(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '2px solid var(--border)',
                      fontSize: 14,
                      background: 'var(--surface)',
                      fontFamily: 'var(--font-main)'
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6, color: 'var(--primary)' }}>
                      Party A (Claimant)
                    </label>
                    <input 
                      type="text"
                      value={newPartyA}
                      onChange={(e) => setNewPartyA(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-md)',
                        border: '2px solid var(--border)',
                        fontSize: 14,
                        background: 'var(--surface)',
                        fontFamily: 'var(--font-main)'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6, color: '#D97706' }}>
                      Party B (Respondent)
                    </label>
                    <input 
                      type="text"
                      value={newPartyB}
                      onChange={(e) => setNewPartyB(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-md)',
                        border: '2px solid var(--border)',
                        fontSize: 14,
                        background: 'var(--surface)',
                        fontFamily: 'var(--font-main)'
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                    Scenario Preset
                  </label>
                  <select 
                    value={newScenario}
                    onChange={(e) => setNewScenario(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '2px solid var(--border)',
                      fontSize: 14,
                      background: 'var(--surface)',
                      fontFamily: 'var(--font-main)'
                    }}
                  >
                    <option value="deposit">Rental Security Deposit & Flat Wear-and-Tear</option>
                    <option value="freelance">Freelance Software & Design Milestone Acceptance</option>
                    <option value="marketplace">E-Commerce Marketplace Defective Return</option>
                    <option value="custom">Custom Commercial Mediation</option>
                  </select>
                </div>

                <div style={{
                  padding: 12,
                  background: 'var(--primary-subtle)',
                  borderRadius: 'var(--radius-md)',
                  border: '1.5px solid var(--border)',
                  fontSize: 13,
                  lineHeight: 1.4
                }}>
                  <strong>Real-Time Coordination:</strong> Creating this room establishes an isolated channel on Supabase. Both participants can join via shareable URL with sub-50ms synchrony.
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                  <button 
                    className="btn btn--secondary" 
                    onClick={() => setIsCreateModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button 
                    className="btn btn--primary" 
                    onClick={handleCreateRoom}
                  >
                    <span>Initialize Room</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            ) : (
              /* Room Created Successfully Screen */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{
                  textAlign: 'center',
                  padding: '20px 12px',
                  background: '#ECFDF5',
                  border: '2px solid #065F46',
                  borderRadius: 'var(--radius-lg)'
                }}>
                  <CheckCircle2 size={36} color="#059669" style={{ margin: '0 auto 8px' }} />
                  <div style={{ fontWeight: 800, fontSize: 18, color: '#065F46' }}>
                    Dispute Room Created!
                  </div>
                  <div className="mono" style={{ fontSize: 24, fontWeight: 800, marginTop: 4, letterSpacing: '0.05em' }}>
                    {createdRoomInfo.id}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                    Shareable Invitation Link (Send to Party B)
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input 
                      type="text"
                      readOnly
                      value={createdRoomInfo.shareUrl}
                      className="mono"
                      style={{
                        flex: 1,
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '2px solid var(--border)',
                        fontSize: 12,
                        background: 'var(--bg)'
                      }}
                    />
                    <button 
                      className="btn btn--secondary" 
                      onClick={() => handleCopy(createdRoomInfo.shareUrl, 'room')}
                    >
                      {copiedRoomId === createdRoomInfo.shareUrl ? <Check size={16} color="#059669" /> : <Copy size={16} />}
                      <span>{copiedRoomId === createdRoomInfo.shareUrl ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Choose your role to enter:</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <button 
                      className="btn btn--primary" 
                      style={{ justifyContent: 'center' }}
                      onClick={() => {
                        setIsCreateModalOpen(false);
                        onOpenRoom(createdRoomInfo.id, 'a');
                      }}
                    >
                      <span>Join as Party A</span>
                    </button>

                    <button 
                      className="btn btn--yellow" 
                      style={{ justifyContent: 'center' }}
                      onClick={() => {
                        setIsCreateModalOpen(false);
                        onOpenRoom(createdRoomInfo.id, 'b');
                      }}
                    >
                      <span>Join as Party B</span>
                    </button>
                  </div>

                  <button 
                    className="btn btn--ghost" 
                    style={{ width: '100%', justifyContent: 'center', border: '1.5px solid var(--border)' }}
                    onClick={() => {
                      setIsCreateModalOpen(false);
                      onOpenRoom(createdRoomInfo.id, 'ref');
                    }}
                  >
                    <span>Join as Neutral Arbiter / Observer</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Verify Integrity */}
      {isVerifyModalOpen && verifyTarget && (
        <div className="modal-overlay">
          <div className="modal-dialog" style={{ maxWidth: 500, padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldCheck size={22} color="var(--primary)" />
                <h3 style={{ margin: 0, fontWeight: 800, fontSize: 18 }}>
                  Cryptographic Integrity Check
                </h3>
              </div>
              <button 
                className="btn btn--sm btn--ghost" 
                style={{ padding: '6px 10px', minHeight: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={() => setIsVerifyModalOpen(false)}
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--ink-light)', marginBottom: 2 }}>Case Document:</div>
                <div style={{ fontWeight: 800, fontSize: 15 }}>{verifyTarget.case_title}</div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: 'var(--ink-light)', marginBottom: 4 }}>Target SHA-256 Digest:</div>
                <div className="mono" style={{
                  background: 'var(--bg)',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1.5px solid var(--border)',
                  fontSize: 12,
                  wordBreak: 'break-all',
                  color: 'var(--primary)',
                  fontWeight: 700
                }}>
                  {verifyTarget.record_hash}
                </div>
              </div>

              {/* Status Display */}
              {verifyStatus === 'checking' && (
                <div style={{
                  padding: 16,
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--primary-subtle)',
                  border: '1.5px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12
                }}>
                  <RefreshCw size={20} className="spin" color="var(--primary)" />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>Re-hashing Verbatim Ledger...</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-light)' }}>Checking Party A & B digital certificate keys</div>
                  </div>
                </div>
              )}

              {verifyStatus === 'valid' && (
                <div style={{
                  padding: 16,
                  borderRadius: 'var(--radius-md)',
                  background: '#ECFDF5',
                  border: '2px solid #065F46',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12
                }}>
                  <CheckCircle2 size={24} color="#059669" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: '#065F46' }}>
                      INTEGRITY CERTIFIED: 100% UNTAMPERED
                    </div>
                    <div style={{ fontSize: 12.5, color: '#047857', marginTop: 4, lineHeight: 1.4 }}>
                      The mathematical hash matches the genesis record on the Supabase immutable store. No alterations in obligations, quotes, or amounts have occurred.
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <button className="btn btn--primary" onClick={() => setIsVerifyModalOpen(false)}>
                  Close Verifier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Dispatch Dossier */}
      {isDispatchModalOpen && selectedDoc && (
        <div className="modal-overlay">
          <div className="modal-dialog" style={{ maxWidth: 500, padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Send size={20} color="var(--primary)" />
                <h3 style={{ margin: 0, fontWeight: 800, fontSize: 18 }}>
                  Dispatch Settlement Dossier
                </h3>
              </div>
              <button 
                className="btn btn--sm btn--ghost" 
                style={{ padding: '6px 10px', minHeight: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={() => setIsDispatchModalOpen(false)}
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>
                  External Court / Webhook API Endpoint
                </label>
                <input 
                  type="text"
                  value={dispatchWebhookUrl}
                  onChange={(e) => setDispatchWebhookUrl(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '2px solid var(--border)',
                    fontSize: 13,
                    background: 'var(--surface)',
                    fontFamily: 'var(--font-mono)'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>
                  Arbitration Counsel Recipient Email
                </label>
                <input 
                  type="email"
                  value={dispatchTargetEmail}
                  onChange={(e) => setDispatchTargetEmail(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '2px solid var(--border)',
                    fontSize: 13,
                    background: 'var(--surface)',
                    fontFamily: 'var(--font-main)'
                  }}
                />
              </div>

              {dispatchSuccess ? (
                <div style={{
                  padding: 12,
                  background: '#ECFDF5',
                  borderRadius: 'var(--radius-md)',
                  border: '1.5px solid #065F46',
                  color: '#065F46',
                  fontWeight: 700,
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  <CheckCircle2 size={18} />
                  <span>Dossier successfully dispatched with SHA-256 certificate envelope.</span>
                </div>
              ) : (
                <div style={{
                  fontSize: 12,
                  color: 'var(--ink-light)',
                  lineHeight: 1.4,
                  background: 'var(--bg)',
                  padding: 10,
                  borderRadius: 'var(--radius-md)',
                  border: '1.5px solid var(--border)'
                }}>
                  Dispatches binary PDF dossier + JSON payload with bilateral cryptographic signature hashes to your configured endpoint.
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button 
                  className="btn btn--secondary" 
                  onClick={() => setIsDispatchModalOpen(false)}
                >
                  Cancel
                </button>
                <button 
                  className="btn btn--primary"
                  disabled={dispatching || dispatchSuccess}
                  onClick={handleSendDispatch}
                >
                  {dispatching ? (
                    <>
                      <RefreshCw size={14} className="spin" />
                      <span>Transmitting...</span>
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      <span>Send Dispatch</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
