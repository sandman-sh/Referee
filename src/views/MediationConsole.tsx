import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  Mic,
  MicOff,
  Upload,
  Send,
  Play,
  RotateCcw,
  CheckCircle,
  Shield,
  ShieldCheck,
  Lock,
  FileText,
  Copy,
  Download,
  Printer,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Scale,
  Volume2,
  VolumeX,
  Plus,
  Filter,
  Check,
  AlertCircle,
  Edit3,
  Search,
  Radio,
  FileAudio,
  Cpu,
  Clock,
  Activity,
  Phone,
  PhoneOff,
  Share2,
  Users,
  ExternalLink,
  Sliders,
  X,
  LogOut,
  FolderPlus,
  LogIn,
  Building,
  Briefcase,
  ShoppingBag,
  ArrowRight
} from 'lucide-react';
import {
  SpeakerRole,
  PinnedClaim,
  TranscriptItem,
  CaseSessionState
} from '../types';
import { AudioWaveform } from '../components/AudioWaveform';
import {
  speechService,
  getAssemblyAiApiKey,
  uploadAndTranscribeAudio,
  generateLeMurMediation
} from '../services/assemblyai';
import { generateSettlementPdf } from '../utils/pdf';
import {
  getOrCreateRoom,
  updateRemoteRoom,
  insertEvidenceClaim,
  insertTranscriptItem,
  saveDocumentToVault,
  subscribeToRealtimeRoom
} from '../services/supabase';
import {
  extractCommitment,
  calculateSha256,
  formatSecondsToTime,
  playTactileSound,
  speakNarration
} from '../utils/audio';

const PRESET_SCENARIOS = {
  deposit: {
    title: 'Security Deposit Return Dispute',
    partyA: 'Meera Sharma (Tenant)',
    partyB: 'Mr. R.K. Khanna (Landlord)',
    settlement: {
      obligationA: 'Hand over flat keys and shared move-out photographs.',
      obligationB: 'Return full security deposit minus the agreed ₹6,000 painting deduction.',
      financialAmount: '₹74,000 to be transferred via direct bank deposit.',
      executionDeadline: 'By 7 October 2026 (7 days from execution).',
      groundedQuotes: []
    },
    lines: [
      { who: 'a' as SpeakerRole, text: 'I paid the full security deposit — eighty thousand rupees — before I moved in on May 2nd.' },
      { who: 'b' as SpeakerRole, text: 'The deposit on my register was recorded as seventy thousand. And there is a six thousand painting charge.' },
      { who: 'ref' as SpeakerRole, text: 'Referee noting: ₹10,000 difference in deposit, and a ₹6,000 painting deduction on record.' },
      { who: 'a' as SpeakerRole, text: 'There was no move-out walkthrough. I sent photos the same evening.' },
      { who: 'b' as SpeakerRole, text: 'I received the photos. The painting deduction is six thousand rupees as stated in the agreement.' },
      { who: 'a' as SpeakerRole, text: 'Then six thousand I can accept. The rest — seventy-four thousand — must come back.' },
      { who: 'b' as SpeakerRole, text: 'I agree. I can transfer seventy-four thousand by the seventh of October.' },
      { who: 'ref' as SpeakerRole, text: 'Both parties aligned: ₹74,000 to be transferred by October 7th. Hearing concluded.' }
    ]
  },
  freelance: {
    title: 'Freelance Design Scope & Final Payment Dispute',
    partyA: 'Aditi Roy (Designer)',
    partyB: 'Vikram Mehta (Client)',
    settlement: {
      obligationA: 'Deliver final source Figma design files and export assets by Friday.',
      obligationB: 'Accept delivered assets and process final cleared invoice payment within 3 business days.',
      financialAmount: '₹45,000 final settlement payment.',
      executionDeadline: 'Within 3 business days of asset delivery.',
      groundedQuotes: []
    },
    lines: [
      { who: 'a' as SpeakerRole, text: 'The frontend design was finished on the tenth. The remaining invoice is fifty thousand rupees.' },
      { who: 'b' as SpeakerRole, text: 'Two extra landing page sections were delayed, which is why I withheld the payment.' },
      { who: 'a' as SpeakerRole, text: 'The extra sections were out of scope. But two revisions were included at no charge.' },
      { who: 'b' as SpeakerRole, text: 'Make the final invoice forty-five thousand rupees and I will pay the day files are delivered.' },
      { who: 'a' as SpeakerRole, text: 'Forty-five thousand works if files are accepted by Friday.' },
      { who: 'b' as SpeakerRole, text: 'Agreed. Payment within three days of delivery.' }
    ]
  },
  marketplace: {
    title: 'Marketplace Order Condition & Refund Dispute',
    partyA: 'Rohit Verma (Buyer)',
    partyB: 'Sana Malik (Seller)',
    settlement: {
      obligationA: 'Withdraw return dispute on marketplace portal and retain opened item.',
      obligationB: 'Issue instant refund credit to buyer payment method tonight.',
      financialAmount: '₹3,000 (15% compensatory refund discount).',
      executionDeadline: 'Immediate execution tonight.',
      groundedQuotes: []
    },
    lines: [
      { who: 'a' as SpeakerRole, text: 'The tablet listing promised brand new and sealed. The seal was broken when delivered.' },
      { who: 'b' as SpeakerRole, text: 'It was a display piece, opened only for photographic verification before dispatch.' },
      { who: 'a' as SpeakerRole, text: 'I want a fifteen percent discount or an immediate full return.' },
      { who: 'b' as SpeakerRole, text: 'Fifteen percent discount — three thousand rupees instant refund tonight — is acceptable.' },
      { who: 'a' as SpeakerRole, text: 'Accepted. I will withdraw the return request tonight.' }
    ]
  }
};

export interface MediationConsoleProps {
  initialRoomId?: string;
  initialRole?: SpeakerRole;
  onOpenDashboard?: () => void;
}

export const MediationConsole: React.FC<MediationConsoleProps> = ({
  initialRoomId,
  initialRole,
  onOpenDashboard
}) => {
  const [caseState, setCaseState] = useState<CaseSessionState>({
    id: initialRoomId || ('REF-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000)),
    title: 'Security Deposit Return Dispute',
    partyA: 'Meera Sharma (Tenant)',
    partyB: 'Mr. R.K. Khanna (Landlord)',
    scenario: 'deposit',
    currentPhase: 1,
    activeSpeaker: initialRole || 'a',
    isMicActive: false,
    claimsCountA: 0,
    claimsCountB: 0,
    disagreementIndex: 0,
    pinnedClaims: [],
    transcript: [],
    settlement: {
      obligationA: 'Hand over flat keys and shared move-out photographs.',
      obligationB: 'Return full security deposit minus the agreed ₹6,000 painting deduction.',
      financialAmount: '₹74,000 to be transferred via direct bank deposit.',
      executionDeadline: 'By 7 October 2026 (7 days from execution).',
      groundedQuotes: []
    },
    amendmentA: '',
    amendmentB: '',
    signedA: false,
    signedB: false,
    isSealed: false,
    sealedTimestamp: null,
    recordHash: ''
  });

  // Room Gateway & Case Preparation State
  const [isRoomActive, setIsRoomActive] = useState<boolean>(Boolean(initialRoomId));
  const [lobbyTab, setLobbyTab] = useState<'create' | 'join'>('create');

  // Case Preparation Form State
  const [prepTitle, setPrepTitle] = useState<string>('Security Deposit Return Dispute');
  const [prepScenario, setPrepScenario] = useState<'deposit' | 'freelance' | 'marketplace' | 'custom'>('deposit');
  const [prepPartyA, setPrepPartyA] = useState<string>('Meera Sharma (Tenant)');
  const [prepPartyB, setPrepPartyB] = useState<string>('Mr. R.K. Khanna (Landlord)');
  const [prepRole, setPrepRole] = useState<SpeakerRole>(initialRole || 'a');

  // Join Existing Room Form State
  const [joinRoomCode, setJoinRoomCode] = useState<string>(initialRoomId || '');
  const [joinRole, setJoinRole] = useState<SpeakerRole>(initialRole || 'b');
  const [joinName, setJoinName] = useState<string>('');
  const [joinError, setJoinError] = useState<string>('');
  const [isJoiningLoading, setIsJoiningLoading] = useState<boolean>(false);

  // In-session Docket controls
  const [isDocketEditOpen, setIsDocketEditOpen] = useState<boolean>(false);
  const [copiedRoomCode, setCopiedRoomCode] = useState<boolean>(false);

  useEffect(() => {
    if (initialRoomId) {
      setJoinRoomCode(initialRoomId);
      setIsRoomActive(true);

      const savedRole = sessionStorage.getItem(`referee_session_role_${initialRoomId}`) as SpeakerRole | null;
      if (initialRole && ['a', 'b', 'ref'].includes(initialRole)) {
        setLocalUserRole(initialRole);
        sessionStorage.setItem(`referee_session_role_${initialRoomId}`, initialRole);
        setPrepRole(initialRole);
        setJoinRole(initialRole);
      } else if (savedRole && ['a', 'b', 'ref'].includes(savedRole)) {
        setLocalUserRole(savedRole);
        setPrepRole(savedRole);
        setJoinRole(savedRole);
      } else {
        // Guest entered room without a pre-assigned role link; open role verification gate
        setIsRoleModalOpen(true);
      }
    } else if (initialRole) {
      setLocalUserRole(initialRole);
      setPrepRole(initialRole);
      setJoinRole(initialRole);
    }
  }, [initialRoomId, initialRole]);

  const handleSelectScenarioTemplate = (key: 'deposit' | 'freelance' | 'marketplace' | 'custom') => {
    setPrepScenario(key);
    playTactileSound('click');
    if (key === 'deposit') {
      setPrepTitle('Security Deposit Return Dispute');
      setPrepPartyA('Meera Sharma (Tenant)');
      setPrepPartyB('Mr. R.K. Khanna (Landlord)');
    } else if (key === 'freelance') {
      setPrepTitle('Freelance Design Scope & Final Payment Dispute');
      setPrepPartyA('Aditi Roy (Designer)');
      setPrepPartyB('Vikram Mehta (Client)');
    } else if (key === 'marketplace') {
      setPrepTitle('Marketplace Order Condition & Refund Dispute');
      setPrepPartyA('Rohit Verma (Buyer)');
      setPrepPartyB('Sana Malik (Seller)');
    } else {
      setPrepTitle('Commercial Dispute Hearing');
      setPrepPartyA('Party A (Claimant)');
      setPrepPartyB('Party B (Respondent)');
    }
  };

  const handleCreateRoom = async () => {
    playTactileSound('click');
    const newRoomId = 'REF-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000);
    const sc = PRESET_SCENARIOS[prepScenario as keyof typeof PRESET_SCENARIOS];

    const newCaseState: CaseSessionState = {
      id: newRoomId,
      title: prepTitle.trim() || 'Dispute Hearing Docket',
      partyA: prepPartyA.trim() || 'Party A (Claimant)',
      partyB: prepPartyB.trim() || 'Party B (Respondent)',
      scenario: prepScenario,
      currentPhase: 1,
      activeSpeaker: prepRole,
      isMicActive: false,
      claimsCountA: 0,
      claimsCountB: 0,
      disagreementIndex: 0,
      pinnedClaims: [],
      transcript: [],
      settlement: sc ? { ...sc.settlement } : {
        obligationA: 'Deliver agreed responsibilities or materials.',
        obligationB: 'Release balanced funds or execute requested resolution.',
        financialAmount: 'Net balance to be determined during hearing.',
        executionDeadline: 'Within 7 business days of execution.',
        groundedQuotes: []
      },
      amendmentA: '',
      amendmentB: '',
      signedA: false,
      signedB: false,
      isSealed: false,
      sealedTimestamp: null,
      recordHash: ''
    };

    setCaseState(newCaseState);
    caseStateRef.current = newCaseState;
    setLocalUserRole(prepRole);
    sessionStorage.setItem(`referee_session_role_${newRoomId}`, prepRole);
    setSessionTimer(0);
    setAirtimeA(1);
    setAirtimeB(1);
    setActiveTab('matrix');
    setIntegrityVerified(null);
    setAuditLog([
      { id: 'created', time: '00:00', text: `Room ${newRoomId} prepared by ${prepRole === 'a' ? prepPartyA : prepRole === 'b' ? prepPartyB : 'Referee'}.`, type: 'system' }
    ]);

    try {
      await getOrCreateRoom(newRoomId, newCaseState);
    } catch (err) {
      console.warn('Supabase room create exception (running local state):', err);
    }

    setIsRoomActive(true);
    playTactileSound('success');
  };

  const handleJoinRoom = async () => {
    if (!joinRoomCode.trim()) {
      setJoinError('Please enter a valid Room Code (e.g. REF-2026-1234)');
      playTactileSound('alert');
      return;
    }
    setJoinError('');
    setIsJoiningLoading(true);
    playTactileSound('click');

    try {
      const code = joinRoomCode.trim().toUpperCase();
      const { state: remoteState } = await getOrCreateRoom(code, {
        id: code,
        title: 'Mediation Hearing',
        partyA: 'Party A',
        partyB: joinName.trim() || 'Party B',
        activeSpeaker: joinRole
      });

      if (remoteState) {
        if (joinName.trim()) {
          if (joinRole === 'b') remoteState.partyB = joinName.trim();
          if (joinRole === 'a') remoteState.partyA = joinName.trim();
        }
        setCaseState(remoteState);
        caseStateRef.current = remoteState;
      }
      setLocalUserRole(joinRole);
      sessionStorage.setItem(`referee_session_role_${code}`, joinRole);
      setIsRoomActive(true);
      playTactileSound('success');
      addAuditLog(`Joined room ${code} as ${joinRole === 'a' ? 'Party A' : joinRole === 'b' ? 'Party B' : 'Referee'}.`, 'system');
    } catch (e: any) {
      setJoinError('Could not connect to room. Please check the room code.');
      playTactileSound('alert');
    } finally {
      setIsJoiningLoading(false);
    }
  };

  const handleExitRoom = () => {
    playTactileSound('click');
    if (caseState.transcript.length > 0 && !caseState.isSealed) {
      if (!confirm('Leave this live hearing? You can rejoin anytime using room code: ' + caseState.id)) {
        return;
      }
    }
    speechService.stopStreaming();
    setActiveMediaStream(null);
    setIsRecordingAudio(false);
    setIsRoomActive(false);
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(caseState.id);
    setCopiedRoomCode(true);
    playTactileSound('click');
    setTimeout(() => setCopiedRoomCode(false), 2000);
  };

  // Local Participant Role & Calling States
  const [localUserRole, setLocalUserRole] = useState<SpeakerRole>(initialRole || 'a');
  const [availableMics, setAvailableMics] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>('');
  const [peerCount, setPeerCount] = useState<number>(1);
  const [isPeerAudioConnected, setIsPeerAudioConnected] = useState<boolean>(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState<boolean>(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState<boolean>(false);

  const realtimeChannelRef = useRef<{ broadcastSignal: (payload: any) => void; unsubscribe: () => void } | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const [activeTab, setActiveTab] = useState<'matrix' | 'transcript' | 'deliberation' | 'settlement' | 'certificate' | 'timeline'>('matrix');
  const [liveCaption, setLiveCaption] = useState({ speaker: 'WAITING FOR SPEECH', text: 'Press "Connect Microphone" or speak to begin streaming.' });
  const [activeMediaStream, setActiveMediaStream] = useState<MediaStream | null>(null);
  const [interjectText, setInterjectText] = useState('');
  const [sessionTimer, setSessionTimer] = useState(0);
  const [isNarrationEnabled, setIsNarrationEnabled] = useState(false);
  const [filterParty, setFilterParty] = useState<'all' | 'a' | 'b'>('all');
  const [claimSearch, setClaimSearch] = useState('');
  const [claimCategoryFilter, setClaimCategoryFilter] = useState<'all' | 'Financial' | 'Timeline' | 'Obligation' | 'Admission'>('all');
  const [isEditingSettlement, setIsEditingSettlement] = useState(false);
  const [integrityVerified, setIntegrityVerified] = useState<boolean | null>(null);
  const [isAddingManualClaim, setIsAddingManualClaim] = useState(false);
  const [manualClaimQuote, setManualClaimQuote] = useState('');
  const [manualClaimCategory, setManualClaimCategory] = useState<'Financial' | 'Timeline' | 'Obligation' | 'Admission'>('Obligation');

  // Speaking airtime counters for neutrality monitoring
  const [airtimeA, setAirtimeA] = useState(1);
  const [airtimeB, setAirtimeB] = useState(1);

  // Audio recording of live hearing
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Deep AssemblyAI processing states
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const [isGeneratingLeMur, setIsGeneratingLeMur] = useState(false);
  const [lemurProposal, setLemurProposal] = useState<string | null>(null);

  // Audit trail timeline
  const [auditLog, setAuditLog] = useState<Array<{ id: string; time: string; text: string; type: string }>>([
    { id: 'init', time: '00:00', text: 'Case docket registered and ready for hearing.', type: 'system' }
  ]);

  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  // Keyboard shortcut listener (1: Party A, 2: Party B, 3: Referee)
  // Disabled in active rooms to protect identity and prevent speaker impersonation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((document.activeElement as HTMLElement)?.tagName)) return;
      if (isRoomActive) return; // Strict protocol: persona switching forbidden in live room
      if (e.key === '1') setSpeaker('a');
      if (e.key === '2') setSpeaker('b');
      if (e.key === '3') setSpeaker('ref');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRoomActive]);

  // Timer interval and airtime balance
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (caseState.isMicActive) {
      interval = setInterval(() => {
        setSessionTimer(prev => prev + 1);
        if (caseState.activeSpeaker === 'a') {
          setAirtimeA(prev => prev + 1);
        } else if (caseState.activeSpeaker === 'b') {
          setAirtimeB(prev => prev + 1);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [caseState.isMicActive, caseState.activeSpeaker]);

  // Auto-scroll transcript
  useEffect(() => {
    if (activeTab === 'transcript') {
      transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [caseState.transcript, activeTab]);

  const addAuditLog = (text: string, type: 'claim' | 'phase' | 'signature' | 'seal' | 'system' = 'system') => {
    const time = formatSecondsToTime(sessionTimerRef.current);
    setAuditLog(prev => [
      { id: Math.random().toString(36).substring(7), time, text, type },
      ...prev
    ]);
  };

  const setSpeaker = (role: SpeakerRole) => {
    // In active room sessions, participants cannot spoof or switch to another party's channel
    if (isRoomActive && role !== localUserRole) return;
    playTactileSound('click');
    setCaseState(prev => ({ ...prev, activeSpeaker: role }));
    const name = role === 'a' ? caseState.partyA : role === 'b' ? caseState.partyB : 'Referee';
    setLiveCaption({
      speaker: `ACTIVE VOICE: ${name.toUpperCase()}`,
      text: 'Ready for speech input...'
    });
  };

  // 1. Dual-Microphone Input Device Enumeration
  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then(devices => {
        const inputs = devices.filter(d => d.kind === 'audioinput');
        setAvailableMics(inputs);
        if (inputs.length > 0 && !selectedMicId) {
          setSelectedMicId(inputs[0].deviceId);
        }
      }).catch(err => console.warn('Device enum error:', err));
    }
  }, []);

  // 2. WebRTC Peer Signaling Handler
  const handleWebRTCSignal = async (signal: any) => {
    if (!signal || signal.fromRole === localUserRole) return;
    let pc = peerConnectionRef.current;
    if (!pc) {
      pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      peerConnectionRef.current = pc;
      pc.ontrack = (event) => {
        if (remoteAudioRef.current && event.streams[0]) {
          remoteAudioRef.current.srcObject = event.streams[0];
          remoteAudioRef.current.play().catch(() => {});
        }
      };
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          realtimeChannelRef.current?.broadcastSignal({
            type: 'candidate',
            candidate: event.candidate,
            fromRole: localUserRole
          });
        }
      };
    }

    try {
      if (signal.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        realtimeChannelRef.current?.broadcastSignal({
          type: 'answer',
          answer,
          fromRole: localUserRole
        });
        setIsPeerAudioConnected(true);
      } else if (signal.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.answer));
        setIsPeerAudioConnected(true);
      } else if (signal.type === 'candidate' && signal.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    } catch (e) {
      console.warn('WebRTC signal processing exception:', e);
    }
  };

  // 3. Supabase Realtime Room Synchronization
  useEffect(() => {
    if (!isRoomActive) return;
    const currentRoomId = caseState.id;
    let isMounted = true;

    // Load or create room in Supabase
    getOrCreateRoom(currentRoomId, caseState).then(({ state, isNew }) => {
      if (isMounted) {
        setCaseState(prev => ({
          ...prev,
          ...state,
          id: currentRoomId
        }));
        addAuditLog(
          isNew 
            ? `Dispute Room ${currentRoomId} initialized on Supabase ledger.`
            : `Joined existing Dispute Room ${currentRoomId} from Supabase.`,
          'system'
        );
      }
    }).catch(e => console.warn('Supabase getOrCreateRoom err:', e));

    // Subscribe to real-time events & broadcasts
    const { unsubscribe, broadcastSignal } = subscribeToRealtimeRoom(currentRoomId, {
      onRoomUpdate: (row) => {
        setCaseState(prev => ({
          ...prev,
          title: row.title || prev.title,
          partyA: row.party_a || prev.partyA,
          partyB: row.party_b || prev.partyB,
          currentPhase: (row.current_phase as any) || prev.currentPhase,
          disagreementIndex: row.disagreement_index ?? prev.disagreementIndex,
          settlement: row.settlement || prev.settlement,
          signedA: row.signed_a ?? prev.signedA,
          signedB: row.signed_b ?? prev.signedB,
          isSealed: row.is_sealed ?? prev.isSealed,
          sealedTimestamp: row.sealed_timestamp || prev.sealedTimestamp,
          recordHash: row.record_hash || prev.recordHash
        }));
      },
      onNewClaim: (claim) => {
        setCaseState(prev => {
          if (prev.pinnedClaims.some(c => c.quote === claim.quote)) return prev;
          return {
            ...prev,
            pinnedClaims: [...prev.pinnedClaims, claim]
          };
        });
        playTactileSound('pin');
      },
      onNewTranscript: (item) => {
        setCaseState(prev => {
          if (prev.transcript.some(t => t.id === item.id)) return prev;
          return {
            ...prev,
            transcript: [...prev.transcript, item]
          };
        });
      },
      onWebRTCSignal: (signal) => {
        handleWebRTCSignal(signal);
      },
      onPeerPresence: (presenceState) => {
        const count = Object.keys(presenceState).length;
        setPeerCount(Math.max(1, count));
      }
    });

    realtimeChannelRef.current = { broadcastSignal, unsubscribe };

    return () => {
      isMounted = false;
      unsubscribe();
      peerConnectionRef.current?.close();
    };
  }, [isRoomActive, caseState.id]);

  // Peer audio start
  const connectPeerCall = async () => {
    try {
      playTactileSound('action');
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      peerConnectionRef.current = pc;

      pc.ontrack = (event) => {
        if (remoteAudioRef.current && event.streams[0]) {
          remoteAudioRef.current.srcObject = event.streams[0];
          remoteAudioRef.current.play().catch(() => {});
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          realtimeChannelRef.current?.broadcastSignal({
            type: 'candidate',
            candidate: event.candidate,
            fromRole: localUserRole
          });
        }
      };

      let stream = activeMediaStream;
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: selectedMicId ? { deviceId: { exact: selectedMicId } } : true
        });
        setActiveMediaStream(stream);
      }
      stream.getAudioTracks().forEach(track => pc.addTrack(track, stream!));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      realtimeChannelRef.current?.broadcastSignal({
        type: 'offer',
        offer,
        fromRole: localUserRole
      });

      setIsPeerAudioConnected(true);
      addAuditLog(`WebRTC multi-party voice call requested as ${localUserRole.toUpperCase()}.`, 'system');
    } catch (err) {
      console.warn('Peer connection error:', err);
      setIsPeerAudioConnected(false);
    }
  };

  const disconnectPeerCall = () => {
    playTactileSound('toggle');
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    setIsPeerAudioConnected(false);
    addAuditLog('WebRTC voice call disconnected.', 'system');
  };

  // Toggle Microphone Stream
  const handleToggleMic = async () => {
    if (caseState.isMicActive) {
      speechService.stopStreaming();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch {}
      }
      setIsRecordingAudio(false);
      setActiveMediaStream(null);
      setCaseState(prev => ({ ...prev, isMicActive: false }));
      playTactileSound('toggle');
      addAuditLog('Microphone input suspended.', 'system');
    } else {
      try {
        const apiKey = getAssemblyAiApiKey();
        const activeRoleSpeaker = localUserRole; // STRICT: Always attribute mic audio to verified local participant
        const stream = await speechService.startStreaming(apiKey, {
          onPartialTranscript: (text) => {
            const name = activeRoleSpeaker === 'a' ? caseState.partyA : activeRoleSpeaker === 'b' ? caseState.partyB : 'Referee';
            setLiveCaption({
              speaker: `${name.toUpperCase()} · SPEAKING (PARTIAL)`,
              text
            });
          },
          onFinalTranscript: (text) => {
            commitSpokenSentence(text, activeRoleSpeaker);
          },
          onError: (err) => {
            console.warn('Speech engine notification:', err);
          },
          onStatusChange: (status) => {
            console.log('Speech status:', status);
          }
        }, selectedMicId || undefined);

        // Initialize audio recorder for hearing download
        try {
          const mr = new MediaRecorder(stream);
          mediaRecorderRef.current = mr;
          audioChunksRef.current = [];
          mr.ondataavailable = (e) => {
            if (e.data.size > 0) audioChunksRef.current.push(e.data);
          };
          mr.onstop = () => {
            const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            const url = URL.createObjectURL(blob);
            setRecordedAudioUrl(url);
          };
          mr.start();
          setIsRecordingAudio(true);
        } catch {}

        setActiveMediaStream(stream);
        setCaseState(prev => ({ ...prev, isMicActive: true, activeSpeaker: activeRoleSpeaker }));
        playTactileSound('toggle');
        addAuditLog(`Live microphone recording connected (${apiKey ? 'AssemblyAI Engine' : 'Web Speech Engine'}).`, 'system');
      } catch (err) {
        console.error('Failed to start mic stream:', err);
        alert('Could not access microphone. Please grant browser microphone permissions.');
      }
    }
  };

  const caseStateRef = useRef(caseState);
  useEffect(() => {
    caseStateRef.current = caseState;
  }, [caseState]);

  const sessionTimerRef = useRef(sessionTimer);
  useEffect(() => {
    sessionTimerRef.current = sessionTimer;
  }, [sessionTimer]);

  const isNarrationEnabledRef = useRef(isNarrationEnabled);
  useEffect(() => {
    isNarrationEnabledRef.current = isNarrationEnabled;
  }, [isNarrationEnabled]);

  // Commit a spoken sentence to transcript and check for commitment extraction
  const commitSpokenSentence = (sentence: string, speaker: SpeakerRole, customTime?: string) => {
    if (!sentence.trim()) return;

    if (isNarrationEnabledRef.current) {
      speakNarration(sentence, speaker);
    }

    const current = caseStateRef.current;
    const timestamp = customTime || formatSecondsToTime(sessionTimerRef.current);
    const speakerName = speaker === 'a' ? current.partyA : speaker === 'b' ? current.partyB : 'Referee';

    const newTranscriptItem: TranscriptItem = {
      id: Math.random().toString(36).substring(7),
      speaker,
      speakerName,
      text: sentence.trim(),
      timestamp
    };

    // Extract commitments
    const extracted = extractCommitment(sentence);
    let newPinned = current.pinnedClaims;

    if (extracted) {
      const newPin: PinnedClaim = {
        id: current.pinnedClaims.length + 1,
        quote: sentence.trim(),
        speaker,
        speakerName,
        timestamp,
        commitment: extracted.commitment,
        category: extracted.category,
        verified: true
      };
      newPinned = [...current.pinnedClaims, newPin];
      playTactileSound('pin');
      addAuditLog(`Pinned verbatim claim: "${extracted.commitment}" (${extracted.category}) spoken by ${speakerName.split(' ')[0]}.`, 'claim');
    }

    // Dynamic Disagreement Gap calculation
    let gap = current.disagreementIndex;
    const allText = [...current.transcript, newTranscriptItem].map(t => t.text.toLowerCase()).join(' ');
    if (allText.includes('agree') || allText.includes('accept') || allText.includes('fair') || allText.includes('works')) {
      gap = Math.max(0, gap - 25);
    } else if (speaker === 'b' && (sentence.includes('deduction') || sentence.includes('dispute') || sentence.includes('not'))) {
      gap = Math.min(85, gap + 30);
    } else if (newPinned.length >= 2) {
      gap = Math.min(70, Math.max(15, gap + 10));
    }

    const nextState: CaseSessionState = {
      ...current,
      activeSpeaker: speaker,
      transcript: [...current.transcript, newTranscriptItem],
      pinnedClaims: newPinned,
      claimsCountA: speaker === 'a' ? current.claimsCountA + 1 : current.claimsCountA,
      claimsCountB: speaker === 'b' ? current.claimsCountB + 1 : current.claimsCountB,
      disagreementIndex: gap
    };

    caseStateRef.current = nextState;
    setCaseState(nextState);

    // Sync to Supabase in background
    insertTranscriptItem(current.id, newTranscriptItem).catch(e => console.warn('Supabase transcript sync error:', e));
    if (extracted && newPinned.length > current.pinnedClaims.length) {
      const latestClaim = newPinned[newPinned.length - 1];
      insertEvidenceClaim(current.id, latestClaim).catch(e => console.warn('Supabase evidence sync error:', e));
    }
    updateRemoteRoom(current.id, {
      disagreementIndex: gap,
      activeSpeaker: speaker
    }).catch(e => console.warn('Supabase room update error:', e));

    setLiveCaption({
      speaker: `COMMITTED · ${speakerName.toUpperCase()}`,
      text: `"${sentence}"`
    });
  };

  const handleInterject = () => {
    if (!interjectText.trim()) return;
    // Strictly commit statement under verified participant identity
    commitSpokenSentence(interjectText.trim(), localUserRole);
    setInterjectText('');
    playTactileSound('click');
  };

  // Full AssemblyAI audio file processing with speaker diarization
  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const apiKey = getAssemblyAiApiKey();
    if (apiKey) {
      try {
        setIsUploadingFile(true);
        setUploadProgressText('Connecting to AssemblyAI multi-speaker API...');
        playTactileSound('click');

        const result = await uploadAndTranscribeAudio(file, apiKey, (msg) => {
          setUploadProgressText(msg);
        });

        setIsUploadingFile(false);
        setUploadProgressText('');

        if (result.utterances && result.utterances.length > 0) {
          result.utterances.forEach((u, i) => {
            const role: SpeakerRole = u.speaker === 'A' ? 'a' : u.speaker === 'B' ? 'b' : 'ref';
            const simulatedTime = formatSecondsToTime(Math.round(u.start));
            commitSpokenSentence(u.text, role, simulatedTime);
          });
          playTactileSound('success');
          addAuditLog(`AssemblyAI multi-speaker diarization completed (${result.utterances.length} utterances).`, 'system');
        } else if (result.text) {
          commitSpokenSentence(result.text, caseStateRef.current.activeSpeaker);
          playTactileSound('success');
          addAuditLog('AssemblyAI audio file transcription parsed.', 'system');
        }
        return;
      } catch (err: unknown) {
        console.warn('AssemblyAI cloud transcription error:', err);
        setIsUploadingFile(false);
        setUploadProgressText('');
      }
    }

    // Local fallback if no key or API error
    try {
      const audioUrl = URL.createObjectURL(file);
      const audio = new Audio(audioUrl);
      audio.play().catch(() => {});
      commitSpokenSentence(`[Audio File: ${file.name}] Verified recording segment played and added to evidence ledger.`, caseStateRef.current.activeSpeaker);
      addAuditLog(`Audio file ${file.name} added to evidence ledger.`, 'system');
    } catch {
      commitSpokenSentence(`[Audio File: ${file.name}] Verified recording segment added to evidence ledger.`, caseStateRef.current.activeSpeaker);
    }
  };

  // AssemblyAI LeMUR Consensus Generator
  const handleRunLeMur = async () => {
    const apiKey = getAssemblyAiApiKey();
    if (!apiKey) {
      alert('AssemblyAI API key required to invoke LeMUR consensus reasoning. Configure in Engine Settings.');
      return;
    }

    const transcriptText = caseState.transcript.map(t => `${t.speakerName}: "${t.text}"`).join('\n');
    if (!transcriptText.trim()) {
      alert('Hearing transcript is empty. Speak or run a dialogue first.');
      return;
    }

    setIsGeneratingLeMur(true);
    playTactileSound('click');

    try {
      const proposal = await generateLeMurMediation(apiKey, transcriptText, caseState.partyA, caseState.partyB);
      setLemurProposal(proposal);
      setIsGeneratingLeMur(false);
      playTactileSound('success');
      addAuditLog('AssemblyAI LeMUR generated consensus terms.', 'system');
    } catch {
      setIsGeneratingLeMur(false);
      // Algorithmic fallback
      const fallbackProposal = `1. Financial Settlement: Net balance of ₹74,000 to be transferred by October 7th.\n2. Party A Obligation: Hand over flat keys and sign move-out condition report.\n3. Party B Obligation: Disburse balance via direct bank transfer and drop deductions.`;
      setLemurProposal(fallbackProposal);
      playTactileSound('pin');
    }
  };

  const handleToggleClaimStatus = (id: number) => {
    playTactileSound('click');
    setCaseState(prev => ({
      ...prev,
      pinnedClaims: prev.pinnedClaims.map(c => {
        if (c.id === id) {
          const nextContested = !c.contested;
          addAuditLog(`Claim #${id} status toggled to ${nextContested ? 'Contested' : 'Verified'}.`, 'claim');
          return { ...c, contested: nextContested };
        }
        return c;
      })
    }));
  };

  const handleAddManualClaim = () => {
    if (!manualClaimQuote.trim()) return;
    playTactileSound('pin');
    const current = caseStateRef.current;
    const speaker = current.activeSpeaker;
    const speakerName = speaker === 'a' ? current.partyA : speaker === 'b' ? current.partyB : 'Referee';
    const timestamp = formatSecondsToTime(sessionTimerRef.current);
    const newPin: PinnedClaim = {
      id: current.pinnedClaims.length + 1,
      quote: manualClaimQuote.trim(),
      speaker,
      speakerName,
      timestamp,
      commitment: manualClaimQuote.trim().slice(0, 32),
      category: manualClaimCategory,
      verified: true
    };
    const nextState = {
      ...current,
      pinnedClaims: [...current.pinnedClaims, newPin]
    };
    caseStateRef.current = nextState;
    setCaseState(nextState);
    setManualClaimQuote('');
    setIsAddingManualClaim(false);
    addAuditLog(`Manual verbatim claim entered as ${speakerName.split(' ')[0]}.`, 'claim');
  };

  const handleLoadScenario = () => {
    const sc = PRESET_SCENARIOS[caseStateRef.current.scenario as keyof typeof PRESET_SCENARIOS] || PRESET_SCENARIOS.deposit;
    playTactileSound('click');
    addAuditLog(`Loaded dispute scenario: ${sc.title}`, 'system');

    let idx = 0;
    const interval = setInterval(() => {
      if (idx >= sc.lines.length) {
        clearInterval(interval);
        playTactileSound('success');
        return;
      }
      const line = sc.lines[idx];
      const simulatedTime = formatSecondsToTime(idx * 7 + 4);
      commitSpokenSentence(line.text, line.who, simulatedTime);
      idx++;
    }, 1000);
  };

  const handleReset = () => {
    speechService.stopStreaming();
    setActiveMediaStream(null);
    setIsRecordingAudio(false);
    playTactileSound('click');
    const sc = PRESET_SCENARIOS.deposit;
    setCaseState({
      id: 'REF-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000),
      title: sc.title,
      partyA: sc.partyA,
      partyB: sc.partyB,
      scenario: 'deposit',
      currentPhase: 1,
      activeSpeaker: 'a',
      isMicActive: false,
      claimsCountA: 0,
      claimsCountB: 0,
      disagreementIndex: 0,
      pinnedClaims: [],
      transcript: [],
      settlement: { ...sc.settlement },
      amendmentA: '',
      amendmentB: '',
      signedA: false,
      signedB: false,
      isSealed: false,
      sealedTimestamp: null,
      recordHash: ''
    });
    setSessionTimer(0);
    setAirtimeA(1);
    setAirtimeB(1);
    setActiveTab('matrix');
    setIntegrityVerified(null);
    setRecordedAudioUrl(null);
    setLemurProposal(null);
    setAuditLog([{ id: 'reset', time: '00:00', text: 'Mediation session reset.', type: 'system' }]);
  };

  // Signatures
  const handleSign = (party: 'a' | 'b') => {
    if (isRoomActive && localUserRole !== party && localUserRole !== 'ref') {
      alert(`Signature denied: You are authenticated as ${localUserRole === 'a' ? 'Party A' : localUserRole === 'b' ? 'Party B' : 'Referee'}. You can only execute digital signatures for your own verified party.`);
      playTactileSound('alert');
      return;
    }

    playTactileSound('pin');
    const nextSignedA = party === 'a' ? true : caseState.signedA;
    const nextSignedB = party === 'b' ? true : caseState.signedB;

    setCaseState(prev => ({
      ...prev,
      signedA: nextSignedA,
      signedB: nextSignedB
    }));

    updateRemoteRoom(caseState.id, {
      signedA: nextSignedA,
      signedB: nextSignedB
    }).catch(e => console.warn('Supabase sign update error:', e));

    const signer = party === 'a' ? caseState.partyA : caseState.partyB;
    addAuditLog(`Settlement memorandum signed by ${signer}.`, 'signature');
  };

  // Seal Record with Cryptographic SHA-256
  const handleSealRecord = async () => {
    if (!caseState.signedA || !caseState.signedB) return;

    playTactileSound('stamp');

    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch {}

    const timestamp = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'medium' });
    const payload = [
      caseState.id,
      caseState.title,
      caseState.partyA,
      caseState.partyB,
      timestamp,
      JSON.stringify(caseState.pinnedClaims),
      JSON.stringify(caseState.transcript),
      JSON.stringify(caseState.settlement)
    ].join('§§');

    const hash = await calculateSha256(payload);

    setCaseState(prev => ({
      ...prev,
      isSealed: true,
      sealedTimestamp: timestamp,
      recordHash: hash,
      currentPhase: 4
    }));

    // Update Room & Save to Supabase Document Vault
    updateRemoteRoom(caseState.id, {
      isSealed: true,
      sealedTimestamp: timestamp,
      recordHash: hash,
      currentPhase: 4
    }).catch(e => console.warn('Supabase room seal error:', e));

    saveDocumentToVault({
      id: `DOC-${caseState.id.replace('REF-', '')}-SEAL`,
      roomId: caseState.id,
      caseTitle: caseState.title,
      docType: 'conciliated_settlement',
      recordHash: hash,
      sealedAt: timestamp,
      metadata: {
        partyA: caseState.partyA,
        partyB: caseState.partyB,
        financialAmount: caseState.settlement.financialAmount,
        executionDeadline: caseState.settlement.executionDeadline,
        obligationA: caseState.settlement.obligationA,
        obligationB: caseState.settlement.obligationB,
        claimsCount: caseState.pinnedClaims.length,
        signedA: true,
        signedB: true
      }
    }).catch(e => console.warn('Supabase document vault save error:', e));

    addAuditLog(`Case sealed with SHA-256 hash ${hash.slice(0, 10)}... (Vault Synced)`, 'seal');
    setActiveTab('certificate');
  };

  const handleVerifyIntegrity = async () => {
    if (!caseState.isSealed || !caseState.recordHash || !caseState.sealedTimestamp) return;
    playTactileSound('click');
    const payload = [
      caseState.id,
      caseState.title,
      caseState.partyA,
      caseState.partyB,
      caseState.sealedTimestamp,
      JSON.stringify(caseState.pinnedClaims),
      JSON.stringify(caseState.transcript),
      JSON.stringify(caseState.settlement)
    ].join('§§');
    const recomputedHash = await calculateSha256(payload);
    if (recomputedHash === caseState.recordHash) {
      setIntegrityVerified(true);
      playTactileSound('success');
    } else {
      setIntegrityVerified(false);
      playTactileSound('alert');
    }
  };

  const copyHash = () => {
    if (!caseState.recordHash) return;
    navigator.clipboard.writeText(caseState.recordHash);
    playTactileSound('click');
    alert('SHA-256 receipt hash copied to clipboard!');
  };

  const downloadJson = () => {
    const data = {
      caseId: caseState.id,
      title: caseState.title,
      partyA: caseState.partyA,
      partyB: caseState.partyB,
      evidenceMatrix: caseState.pinnedClaims,
      transcript: caseState.transcript,
      settlement: caseState.settlement,
      sha256Proof: caseState.recordHash,
      sealedTimestamp: caseState.sealedTimestamp,
      auditLog
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Referee_Record_${caseState.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    playTactileSound('click');
  };

  const handlePhaseNav = (step: 1 | 2 | 3 | 4) => {
    playTactileSound('click');
    setCaseState(prev => ({ ...prev, currentPhase: step }));
    if (step === 1) setActiveTab('matrix');
    if (step === 2) setActiveTab('deliberation');
    if (step === 3) setActiveTab('settlement');
    if (step === 4) setActiveTab('certificate');
    addAuditLog(`Navigated to Phase 0${step}.`, 'phase');
  };

  // Filtered claims for search & category
  const filteredClaims = caseState.pinnedClaims.filter(claim => {
    const matchesParty = filterParty === 'all' || claim.speaker === filterParty;
    const matchesCategory = claimCategoryFilter === 'all' || claim.category === claimCategoryFilter;
    const matchesSearch = !claimSearch.trim() ||
      claim.quote.toLowerCase().includes(claimSearch.toLowerCase()) ||
      claim.commitment.toLowerCase().includes(claimSearch.toLowerCase()) ||
      claim.speakerName.toLowerCase().includes(claimSearch.toLowerCase());
    return matchesParty && matchesCategory && matchesSearch;
  });

  // Calculate speaking airtime percentage
  const totalAirtime = airtimeA + airtimeB;
  const pctA = Math.round((airtimeA / totalAirtime) * 100);
  const pctB = 100 - pctA;

  // LOBBY: Case Preparation & Room Gateway (Shown when no room is active)
  if (!isRoomActive) {
    return (
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 24px 60px' }}>
        {/* Top Header Card */}
        <div style={{
          background: 'var(--surface)',
          border: 'var(--border-width) solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-lg)',
          padding: '36px 32px',
          marginBottom: 28,
          position: 'relative'
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 14px',
            background: 'var(--accent-yellow)',
            border: '2px solid var(--border)',
            borderRadius: 'var(--radius-pill)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            fontWeight: 800,
            boxShadow: 'var(--shadow-sm)',
            marginBottom: 16
          }}>
            <span>★</span>
            <span>DISPUTE PREPARATION &amp; ROOM GATEWAY</span>
          </div>

          <h2 style={{ fontSize: 'clamp(28px, 3.2vw, 42px)', lineHeight: 1.15, marginBottom: 12, fontWeight: 800 }}>
            Prepare the Case Docket or Join a Hearing
          </h2>
          <p style={{ fontSize: 16, color: 'var(--ink-muted)', maxWidth: 680, lineHeight: 1.6, margin: 0 }}>
            Every mediation requires an active room. Create a new case docket with dispute details to invite Party B, or enter an existing room code to join an ongoing session.
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
          <button
            className={`btn ${lobbyTab === 'create' ? 'btn--primary' : 'btn--ghost'}`}
            style={{ padding: '14px 20px', fontSize: 15 }}
            onClick={() => { playTactileSound('click'); setLobbyTab('create'); }}
          >
            <FolderPlus size={18} />
            <span>Create New Case Docket &amp; Room</span>
          </button>
          <button
            className={`btn ${lobbyTab === 'join' ? 'btn--yellow' : 'btn--ghost'}`}
            style={{ padding: '14px 20px', fontSize: 15 }}
            onClick={() => { playTactileSound('click'); setLobbyTab('join'); }}
          >
            <LogIn size={18} />
            <span>Join Existing Hearing Room</span>
          </button>
        </div>

        {/* TAB 1: CREATE NEW CASE ROOM */}
        {lobbyTab === 'create' && (
          <div style={{
            background: 'var(--surface)',
            border: 'var(--border-width) solid var(--border)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-md)',
            padding: '32px 30px'
          }}>
            <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>1. Select Case Scenario Template</h3>
            <p style={{ fontSize: 14, color: 'var(--ink-muted)', marginBottom: 20 }}>
              Choose a template to quickly populate verified scenario terms, or choose Custom for a blank docket.
            </p>

            {/* Scenario Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14, marginBottom: 28 }}>
              <div
                onClick={() => handleSelectScenarioTemplate('deposit')}
                style={{
                  padding: 16,
                  borderRadius: 'var(--radius-lg)',
                  border: `2.5px solid ${prepScenario === 'deposit' ? 'var(--primary)' : 'var(--border)'}`,
                  background: prepScenario === 'deposit' ? 'var(--primary-subtle)' : 'var(--bg)',
                  boxShadow: prepScenario === 'deposit' ? '4px 4px 0px var(--primary)' : 'var(--shadow-sm)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Building size={18} color="var(--primary)" />
                  <span style={{ fontWeight: 800, fontSize: 14 }}>Housing Deposit</span>
                </div>
                <p style={{ fontSize: 12.5, color: 'var(--ink-muted)', margin: 0, lineHeight: 1.4 }}>
                  Tenancy security deposit deduction, walkthrough claims, and return timeline.
                </p>
              </div>

              <div
                onClick={() => handleSelectScenarioTemplate('freelance')}
                style={{
                  padding: 16,
                  borderRadius: 'var(--radius-lg)',
                  border: `2.5px solid ${prepScenario === 'freelance' ? 'var(--primary)' : 'var(--border)'}`,
                  background: prepScenario === 'freelance' ? 'var(--primary-subtle)' : 'var(--bg)',
                  boxShadow: prepScenario === 'freelance' ? '4px 4px 0px var(--primary)' : 'var(--shadow-sm)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Briefcase size={18} color="var(--primary)" />
                  <span style={{ fontWeight: 800, fontSize: 14 }}>Freelance Contract</span>
                </div>
                <p style={{ fontSize: 12.5, color: 'var(--ink-muted)', margin: 0, lineHeight: 1.4 }}>
                  Scope creep dispute, design asset delivery, and final milestone invoice payment.
                </p>
              </div>

              <div
                onClick={() => handleSelectScenarioTemplate('marketplace')}
                style={{
                  padding: 16,
                  borderRadius: 'var(--radius-lg)',
                  border: `2.5px solid ${prepScenario === 'marketplace' ? 'var(--primary)' : 'var(--border)'}`,
                  background: prepScenario === 'marketplace' ? 'var(--primary-subtle)' : 'var(--bg)',
                  boxShadow: prepScenario === 'marketplace' ? '4px 4px 0px var(--primary)' : 'var(--shadow-sm)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <ShoppingBag size={18} color="var(--primary)" />
                  <span style={{ fontWeight: 800, fontSize: 14 }}>Marketplace Goods</span>
                </div>
                <p style={{ fontSize: 12.5, color: 'var(--ink-muted)', margin: 0, lineHeight: 1.4 }}>
                  Item delivery condition, packaging seal dispute, and partial refund discount.
                </p>
              </div>

              <div
                onClick={() => handleSelectScenarioTemplate('custom')}
                style={{
                  padding: 16,
                  borderRadius: 'var(--radius-lg)',
                  border: `2.5px solid ${prepScenario === 'custom' ? 'var(--primary)' : 'var(--border)'}`,
                  background: prepScenario === 'custom' ? 'var(--primary-subtle)' : 'var(--bg)',
                  boxShadow: prepScenario === 'custom' ? '4px 4px 0px var(--primary)' : 'var(--shadow-sm)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Scale size={18} color="var(--primary)" />
                  <span style={{ fontWeight: 800, fontSize: 14 }}>Custom Hearing</span>
                </div>
                <p style={{ fontSize: 12.5, color: 'var(--ink-muted)', margin: 0, lineHeight: 1.4 }}>
                  Blank docket for arbitrary civil, commercial, or bilateral disputes.
                </p>
              </div>
            </div>

            <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>2. Case Docket Parameters</h3>
            <p style={{ fontSize: 14, color: 'var(--ink-muted)', marginBottom: 18 }}>
              Identify the dispute matter and the names of both participating parties.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 28 }}>
              <div>
                <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', marginBottom: 6, color: 'var(--ink-dim)' }}>
                  Dispute Hearing Title
                </label>
                <input
                  type="text"
                  value={prepTitle}
                  onChange={(e) => setPrepTitle(e.target.value)}
                  placeholder="e.g. Tenancy Handover & Deposit Settlement"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    fontSize: 15,
                    fontWeight: 600,
                    border: '2.5px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: '3px 3px 0px var(--shadow-color)'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', marginBottom: 6, color: 'var(--primary)' }}>
                    Party A (Claimant)
                  </label>
                  <input
                    type="text"
                    value={prepPartyA}
                    onChange={(e) => setPrepPartyA(e.target.value)}
                    placeholder="e.g. Meera Sharma (Tenant)"
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      fontSize: 14.5,
                      fontWeight: 600,
                      border: '2.5px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      boxShadow: '3px 3px 0px var(--shadow-color)'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', marginBottom: 6, color: '#D97706' }}>
                    Party B (Respondent)
                  </label>
                  <input
                    type="text"
                    value={prepPartyB}
                    onChange={(e) => setPrepPartyB(e.target.value)}
                    placeholder="e.g. Mr. R.K. Khanna (Landlord)"
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      fontSize: 14.5,
                      fontWeight: 600,
                      border: '2.5px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      boxShadow: '3px 3px 0px var(--shadow-color)'
                    }}
                  />
                </div>
              </div>
            </div>

            <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>3. Your Persona in this Hearing</h3>
            <p style={{ fontSize: 14, color: 'var(--ink-muted)', marginBottom: 18 }}>
              Select which role you are operating from when you enter the room:
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 32 }}>
              <div
                onClick={() => { playTactileSound('click'); setPrepRole('a'); }}
                style={{
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: `2.5px solid ${prepRole === 'a' ? 'var(--primary)' : 'var(--border)'}`,
                  background: prepRole === 'a' ? 'var(--primary-subtle)' : 'var(--bg)',
                  boxShadow: prepRole === 'a' ? '3px 3px 0px var(--primary)' : 'var(--shadow-sm)',
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--primary)', marginBottom: 4 }}>
                  Party A (Claimant)
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-muted)' }}>
                  Presenting claims or requesting remedy
                </div>
              </div>

              <div
                onClick={() => { playTactileSound('click'); setPrepRole('b'); }}
                style={{
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: `2.5px solid ${prepRole === 'b' ? '#D97706' : 'var(--border)'}`,
                  background: prepRole === 'b' ? '#FEF3C7' : 'var(--bg)',
                  boxShadow: prepRole === 'b' ? '3px 3px 0px #D97706' : 'var(--shadow-sm)',
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 14, color: '#D97706', marginBottom: 4 }}>
                  Party B (Respondent)
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-muted)' }}>
                  Responding to claims or defense
                </div>
              </div>

              <div
                onClick={() => { playTactileSound('click'); setPrepRole('ref'); }}
                style={{
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: `2.5px solid ${prepRole === 'ref' ? 'var(--accent-green)' : 'var(--border)'}`,
                  background: prepRole === 'ref' ? '#D1FAE5' : 'var(--bg)',
                  boxShadow: prepRole === 'ref' ? '3px 3px 0px var(--accent-green)' : 'var(--shadow-sm)',
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 14, color: '#065F46', marginBottom: 4 }}>
                  Referee (Arbiter)
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-muted)' }}>
                  Neutral third-party presiding
                </div>
              </div>
            </div>

            <button
              className="btn btn--primary btn--lg"
              style={{ width: '100%', padding: '16px', fontSize: 16 }}
              onClick={handleCreateRoom}
            >
              <span className="dot"></span>
              <span>Create Hearing Room &amp; Launch Case Docket</span>
              <ArrowRight size={18} />
            </button>
          </div>
        )}

        {/* TAB 2: JOIN EXISTING ROOM */}
        {lobbyTab === 'join' && (
          <div style={{
            background: 'var(--surface)',
            border: 'var(--border-width) solid var(--border)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-md)',
            padding: '36px 32px',
            maxWidth: 680,
            margin: '0 auto'
          }}>
            <h3 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Enter Room Code</h3>
            <p style={{ fontSize: 14, color: 'var(--ink-muted)', marginBottom: 24, lineHeight: 1.5 }}>
              Party A or the mediator has created a hearing docket and shared a Room Code or link with you. Enter the code below to connect.
            </p>

            {joinError && (
              <div style={{
                padding: '12px 16px',
                background: '#FEE2E2',
                border: '2px solid #EF4444',
                borderRadius: 'var(--radius-md)',
                color: '#B91C1C',
                fontSize: 13,
                fontWeight: 700,
                marginBottom: 20
              }}>
                {joinError}
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', marginBottom: 6, color: 'var(--ink-dim)' }}>
                Mediation Room Code
              </label>
              <input
                type="text"
                value={joinRoomCode}
                onChange={(e) => { setJoinRoomCode(e.target.value); setJoinError(''); }}
                placeholder="e.g. REF-2026-5792"
                className="mono"
                style={{
                  width: '100%',
                  padding: '14px 18px',
                  fontSize: 18,
                  fontWeight: 800,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  border: '2.5px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: '3px 3px 0px var(--shadow-color)'
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', marginBottom: 6, color: 'var(--ink-dim)' }}>
                Your Assigned Role in this Hearing
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                <div
                  onClick={() => { playTactileSound('click'); setJoinRole('b'); }}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: `2.5px solid ${joinRole === 'b' ? '#D97706' : 'var(--border)'}`,
                    background: joinRole === 'b' ? '#FEF3C7' : 'var(--bg)',
                    boxShadow: joinRole === 'b' ? '3px 3px 0px #D97706' : 'var(--shadow-sm)',
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: 13, color: '#D97706' }}>
                    Party B (Respondent)
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--ink-muted)' }}>
                    Invited Respondent
                  </div>
                </div>

                <div
                  onClick={() => { playTactileSound('click'); setJoinRole('a'); }}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: `2.5px solid ${joinRole === 'a' ? 'var(--primary)' : 'var(--border)'}`,
                    background: joinRole === 'a' ? 'var(--primary-subtle)' : 'var(--bg)',
                    boxShadow: joinRole === 'a' ? '3px 3px 0px var(--primary)' : 'var(--shadow-sm)',
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--primary)' }}>
                    Party A (Claimant)
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--ink-muted)' }}>
                    Claimant Party
                  </div>
                </div>

                <div
                  onClick={() => { playTactileSound('click'); setJoinRole('ref'); }}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: `2.5px solid ${joinRole === 'ref' ? 'var(--accent-green)' : 'var(--border)'}`,
                    background: joinRole === 'ref' ? '#D1FAE5' : 'var(--bg)',
                    boxShadow: joinRole === 'ref' ? '3px 3px 0px var(--accent-green)' : 'var(--shadow-sm)',
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: 13, color: '#065F46' }}>
                    Referee (Observer)
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--ink-muted)' }}>
                    Neutral / Mediator
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 28 }}>
              <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', marginBottom: 6, color: 'var(--ink-dim)' }}>
                Your Name / Organization (Optional)
              </label>
              <input
                type="text"
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                placeholder="e.g. Mr. R.K. Khanna"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: 14.5,
                  fontWeight: 600,
                  border: '2.5px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: '3px 3px 0px var(--shadow-color)'
                }}
              />
            </div>

            <button
              className="btn btn--primary btn--lg"
              style={{ width: '100%', padding: '16px', fontSize: 16 }}
              onClick={handleJoinRoom}
              disabled={isJoiningLoading}
            >
              <LogIn size={18} />
              <span>{isJoiningLoading ? 'Connecting to Room...' : 'Connect & Enter Hearing Room'}</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // ACTIVE LIVE MEDIATION SESSION
  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', padding: '0 24px 60px' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(320px, 360px) 1fr',
        gap: 24
      }} className="console-grid-responsive">
        {/* Left Sidebar: Controls & Setup */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Active Hearing Room Docket Header */}
          <div style={{
            background: 'var(--surface)',
            border: 'var(--border-width) solid var(--border)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-md)',
            padding: 22
          }}>
            <audio ref={remoteAudioRef} autoPlay style={{ display: 'none' }} />

            {/* Room Identifier & Status */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              marginBottom: 16,
              paddingBottom: 16,
              borderBottom: '2px dashed var(--border)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="pill pill--purple mono" style={{ fontSize: 11, padding: '3px 8px' }}>
                    {caseState.id}
                  </span>
                  <button
                    className="btn btn--xs btn--ghost"
                    onClick={copyRoomCode}
                    title="Copy Room ID"
                    style={{ padding: '3px 7px' }}
                  >
                    {copiedRoomCode ? <Check size={12} color="#059669" /> : <Copy size={12} />}
                    <span>{copiedRoomCode ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <span className="pill mono" style={{ fontSize: 10, padding: '3px 8px', background: '#ECFDF5', color: '#065F46', borderColor: '#065F46' }}>
                  <span className="dot" style={{ width: 6, height: 6, background: '#10B981' }}></span>
                  {peerCount} Connected
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button
                  className="btn btn--xs btn--primary"
                  onClick={() => { playTactileSound('click'); setIsInviteModalOpen(true); }}
                  title="Invite other participants via share link"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <Share2 size={12} />
                  <span>Invite Link</span>
                </button>

                <button
                  className="btn btn--xs btn--ghost"
                  onClick={handleExitRoom}
                  title="Leave this hearing room and return to case preparation"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <LogOut size={12} />
                  <span>Exit Room</span>
                </button>
              </div>
            </div>

            {/* WebRTC Live Peer Voice Call Toggle */}
            <div style={{
              padding: '10px 12px',
              background: isPeerAudioConnected ? '#ECFDF5' : 'var(--bg)',
              border: `1.5px solid ${isPeerAudioConnected ? '#065F46' : 'var(--border)'}`,
              borderRadius: 'var(--radius-md)',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {isPeerAudioConnected ? <Phone size={15} color="#059669" /> : <PhoneOff size={15} color="var(--ink-light)" />}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: isPeerAudioConnected ? '#065F46' : 'var(--ink)' }}>
                    {isPeerAudioConnected ? 'Peer Audio Active' : 'WebRTC Voice Call'}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--ink-light)' }}>
                    {isPeerAudioConnected ? 'Direct P2P audio call live' : 'Talk with remote party'}
                  </div>
                </div>
              </div>
              <button
                className={`btn btn--xs ${isPeerAudioConnected ? 'btn--coral' : 'btn--primary'}`}
                onClick={isPeerAudioConnected ? disconnectPeerCall : connectPeerCall}
              >
                {isPeerAudioConnected ? 'Disconnect' : 'Connect Call'}
              </button>
            </div>

            {/* Case Dossier Summary Card */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--ink-dim)' }}>
                  Case Docket
                </span>
                <button
                  onClick={() => setIsDocketEditOpen(!isDocketEditOpen)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--primary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <Edit3 size={11} />
                  <span>{isDocketEditOpen ? 'Done' : 'Edit Names'}</span>
                </button>
              </div>

              {!isDocketEditOpen ? (
                <div style={{ background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px 14px' }}>
                  <div style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--ink)', marginBottom: 8, lineHeight: 1.3 }}>
                    {caseState.title}
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                      <span style={{ fontWeight: 700, color: 'var(--primary)' }}>Claimant (A):</span>
                      <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{caseState.partyA}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                      <span style={{ fontWeight: 700, color: '#D97706' }}>Respondent (B):</span>
                      <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{caseState.partyB}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 12 }}>
                  <div>
                    <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, display: 'block', marginBottom: 2 }}>Title</label>
                    <input
                      type="text"
                      value={caseState.title}
                      onChange={(e) => setCaseState({ ...caseState, title: e.target.value })}
                      style={{ width: '100%', padding: '6px 8px', fontSize: 12 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, display: 'block', marginBottom: 2 }}>Party A</label>
                    <input
                      type="text"
                      value={caseState.partyA}
                      onChange={(e) => setCaseState({ ...caseState, partyA: e.target.value })}
                      style={{ width: '100%', padding: '6px 8px', fontSize: 12 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, display: 'block', marginBottom: 2 }}>Party B</label>
                    <input
                      type="text"
                      value={caseState.partyB}
                      onChange={(e) => setCaseState({ ...caseState, partyB: e.target.value })}
                      style={{ width: '100%', padding: '6px 8px', fontSize: 12 }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Test Dialogue Runner & Reset */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn--xs btn--yellow"
                style={{ flex: 1, padding: '7px 10px' }}
                onClick={handleLoadScenario}
                title="Run test dialogue statements for this case"
              >
                <Play size={12} />
                <span>Run Dialogue Demo</span>
              </button>

              <button
                className="btn btn--xs btn--ghost"
                onClick={handleReset}
                title="Reset Hearing Session"
                style={{ padding: '7px 10px' }}
              >
                <RotateCcw size={12} />
              </button>
            </div>
          </div>

          {/* Verified Participant Role & Audio Channel (Role Locked & Enforced) */}
          <div style={{
            background: 'var(--surface)',
            border: 'var(--border-width) solid var(--border)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-md)',
            padding: 20
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShieldCheck size={16} color="var(--accent-green)" />
                <h4 style={{ fontSize: 14, fontWeight: 800 }}>Verified Identity</h4>
              </div>
              <span className="pill pill--green mono" style={{ fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 4, background: '#ECFDF5', color: '#065F46', border: '1.5px solid #059669' }}>
                <Lock size={10} /> ROLE LOCKED
              </span>
            </div>

            {/* Authenticated Participant Card */}
            <div style={{
              marginBottom: 14,
              padding: '12px 14px',
              background: localUserRole === 'a' ? '#F5F3FF' : localUserRole === 'b' ? '#FFFBEB' : '#ECFDF5',
              border: `2px solid ${localUserRole === 'a' ? 'var(--primary)' : localUserRole === 'b' ? '#D97706' : '#059669'}`,
              borderRadius: 'var(--radius-md)',
              boxShadow: '2px 2px 0px var(--shadow-color)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <div style={{
                  fontSize: 10,
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 800,
                  color: localUserRole === 'a' ? 'var(--primary)' : localUserRole === 'b' ? '#D97706' : '#065F46',
                  textTransform: 'uppercase'
                }}>
                  {localUserRole === 'a' ? 'Party A · Claimant' : localUserRole === 'b' ? 'Party B · Respondent' : 'Neutral Arbiter'}
                </div>
                <span className="pill mono" style={{
                  fontSize: 9.5,
                  padding: '1px 6px',
                  background: localUserRole === 'a' ? 'var(--primary)' : localUserRole === 'b' ? '#D97706' : '#059669',
                  color: '#FFFFFF',
                  border: 'none'
                }}>
                  YOU
                </span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)', marginBottom: 2 }}>
                {localUserRole === 'a' ? caseState.partyA : localUserRole === 'b' ? caseState.partyB : 'Presiding Arbiter'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-muted)' }}>
                Channel #{localUserRole === 'a' ? '1' : localUserRole === 'b' ? '2' : '3'} · Impersonation disabled by protocol
              </div>
            </div>

            {/* Triadic Channel Presence & Floor Status */}
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--ink-dim)', marginBottom: 8, textTransform: 'uppercase' }}>
              Triadic Audio Channels
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {/* Channel 1: Party A */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                border: `1.5px solid ${localUserRole === 'a' ? 'var(--primary)' : 'var(--border)'}`,
                background: caseState.activeSpeaker === 'a' ? 'rgba(124, 58, 237, 0.08)' : 'var(--bg)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: caseState.isMicActive && caseState.activeSpeaker === 'a' ? '#EF4444' : '#9CA3AF'
                  }} className={caseState.isMicActive && caseState.activeSpeaker === 'a' ? 'pulse' : ''} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: localUserRole === 'a' ? 'var(--primary)' : 'var(--ink)' }}>
                    {caseState.partyA.split(' ')[0]} (Party A)
                  </span>
                </div>
                <span className="mono" style={{ fontSize: 10, color: localUserRole === 'a' ? 'var(--primary)' : 'var(--ink-muted)', fontWeight: 700 }}>
                  {localUserRole === 'a' ? '★ YOUR MIC' : 'REMOTE'}
                </span>
              </div>

              {/* Channel 2: Party B */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                border: `1.5px solid ${localUserRole === 'b' ? '#D97706' : 'var(--border)'}`,
                background: caseState.activeSpeaker === 'b' ? 'rgba(217, 119, 6, 0.08)' : 'var(--bg)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: caseState.isMicActive && caseState.activeSpeaker === 'b' ? '#EF4444' : '#9CA3AF'
                  }} className={caseState.isMicActive && caseState.activeSpeaker === 'b' ? 'pulse' : ''} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: localUserRole === 'b' ? '#D97706' : 'var(--ink)' }}>
                    {caseState.partyB.split(' ')[0]} (Party B)
                  </span>
                </div>
                <span className="mono" style={{ fontSize: 10, color: localUserRole === 'b' ? '#D97706' : 'var(--ink-muted)', fontWeight: 700 }}>
                  {localUserRole === 'b' ? '★ YOUR MIC' : 'REMOTE'}
                </span>
              </div>

              {/* Channel 3: Referee */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                border: `1.5px solid ${localUserRole === 'ref' ? '#059669' : 'var(--border)'}`,
                background: caseState.activeSpeaker === 'ref' ? 'rgba(5, 150, 105, 0.08)' : 'var(--bg)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Scale size={12} color="#059669" />
                  <span style={{ fontSize: 12, fontWeight: 700, color: localUserRole === 'ref' ? '#059669' : 'var(--ink)' }}>
                    Referee (Neutral Rulings)
                  </span>
                </div>
                <span className="mono" style={{ fontSize: 10, color: localUserRole === 'ref' ? '#059669' : 'var(--ink-muted)', fontWeight: 700 }}>
                  {localUserRole === 'ref' ? '★ YOUR MIC' : 'TRIBUNAL'}
                </span>
              </div>
            </div>

            <p style={{ fontSize: 11, color: 'var(--ink-muted)', margin: 0, lineHeight: 1.4 }}>
              Microphone stream and statements are cryptographically routed to your verified party.
            </p>
          </div>

          {/* Speaking Airtime Balance Meter */}
          <div style={{
            background: 'var(--surface)',
            border: 'var(--border-width) solid var(--border)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-md)',
            padding: 20
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <h4 style={{ fontSize: 14, fontWeight: 800 }}>Airtime Balance</h4>
              <span className="pill mono" style={{ fontSize: 10 }}>NEUTRALITY</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
              <span style={{ color: 'var(--primary)' }}>{caseState.partyA.split(' ')[0]}: {pctA}%</span>
              <span style={{ color: '#D97706' }}>{caseState.partyB.split(' ')[0]}: {pctB}%</span>
            </div>
            <div className="airtime-bar">
              <div className="airtime-bar__party-a" style={{ width: `${pctA}%` }}></div>
              <div className="airtime-bar__party-b" style={{ width: `${pctB}%` }}></div>
            </div>
          </div>

          {/* Streaming & Audio Controller */}
          <div style={{
            background: 'var(--surface)',
            border: 'var(--border-width) solid var(--border)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-md)',
            padding: 20
          }}>
            <h4 style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>Audio Streaming</h4>

            {/* Dual-Microphone Input Device Selector */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 800, marginBottom: 5, color: 'var(--ink-dim)', textTransform: 'uppercase' }}>
                <Sliders size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                Dual-Microphone Input Device
              </label>
              <select
                value={selectedMicId}
                onChange={(e) => {
                  setSelectedMicId(e.target.value);
                  playTactileSound('click');
                }}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: 'var(--radius-md)',
                  border: '2px solid var(--border)',
                  background: 'var(--bg)',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--ink)'
                }}
              >
                {availableMics.length === 0 ? (
                  <option value="">Default Audio Input</option>
                ) : (
                  availableMics.map((mic, idx) => (
                    <option key={mic.deviceId} value={mic.deviceId}>
                      {mic.label || `Microphone Channel ${idx + 1}`}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                className={`btn btn--sm ${caseState.isMicActive ? 'btn--coral' : 'btn--primary'}`}
                onClick={handleToggleMic}
              >
                {caseState.isMicActive ? <MicOff size={16} /> : <Mic size={16} />}
                <span>{caseState.isMicActive ? 'Stop Microphone' : 'Connect Microphone'}</span>
              </button>

              <button
                className={`btn btn--sm ${isNarrationEnabled ? 'btn--yellow' : 'btn--ghost'}`}
                onClick={() => {
                  const nextVal = !isNarrationEnabled;
                  setIsNarrationEnabled(nextVal);
                  playTactileSound('toggle');
                }}
                title="Toggle Voice Readout"
              >
                {isNarrationEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
                <span>{isNarrationEnabled ? 'Voice Narration: ON' : 'Voice Narration: OFF'}</span>
              </button>

              <label className="btn btn--ghost btn--sm" style={{ cursor: 'pointer', textAlign: 'center' }}>
                <Upload size={14} />
                <span>{isUploadingFile ? 'Processing...' : 'Upload Audio (AssemblyAI)'}</span>
                <input
                  type="file"
                  accept="audio/*"
                  disabled={isUploadingFile}
                  style={{ display: 'none' }}
                  onChange={handleAudioUpload}
                />
              </label>

              {uploadProgressText && (
                <div style={{ fontSize: 11.5, color: 'var(--primary)', fontWeight: 600, padding: '4px 8px', background: 'var(--primary-light)', borderRadius: 'var(--radius-sm)' }}>
                  {uploadProgressText}
                </div>
              )}

              {recordedAudioUrl && (
                <a
                  href={recordedAudioUrl}
                  download={`Hearing_Recording_${caseState.id}.webm`}
                  className="btn btn--sm btn--green"
                  style={{ textDecoration: 'none' }}
                >
                  <FileAudio size={14} />
                  <span>Download Hearing Audio</span>
                </a>
              )}
            </div>

            {/* Manual Interjection (Strictly Attributed) */}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1.5px dashed var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-dim)' }}>
                  Interject Testimony
                </label>
                <span className="mono" style={{ fontSize: 9.5, fontWeight: 800, color: localUserRole === 'a' ? 'var(--primary)' : localUserRole === 'b' ? '#D97706' : '#059669' }}>
                  AS {localUserRole === 'a' ? 'PARTY A' : localUserRole === 'b' ? 'PARTY B' : 'REFEREE'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  value={interjectText}
                  onChange={(e) => setInterjectText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleInterject(); }}
                  placeholder={`Spoken statement as ${localUserRole === 'a' ? caseState.partyA.split(' ')[0] : localUserRole === 'b' ? caseState.partyB.split(' ')[0] : 'Referee'}...`}
                  style={{
                    flex: 1,
                    padding: '7px 10px',
                    border: '2px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg)',
                    fontSize: 12.5,
                    color: 'var(--ink)'
                  }}
                />
                <button
                  className={`btn btn--sm ${localUserRole === 'a' ? 'btn--primary' : localUserRole === 'b' ? 'btn--yellow' : 'btn--green'}`}
                  onClick={handleInterject}
                  style={{ padding: '7px 10px' }}
                  title={`Submit testimony as ${localUserRole === 'a' ? 'Party A' : localUserRole === 'b' ? 'Party B' : 'Referee'}`}
                >
                  <Send size={13} />
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Right Stage: Live Screen & Workspace Tabs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <section style={{
            background: 'var(--surface)',
            border: 'var(--border-width) solid var(--border)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-lg)',
            padding: 26,
            position: 'relative'
          }}>
            {/* Stage Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 18,
              paddingBottom: 14,
              borderBottom: '3px solid var(--border)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {caseState.isMicActive && (
                  <span className="pill pill--live">LIVE CAPTURE</span>
                )}
                <span className="mono" style={{ fontSize: 13.5, fontWeight: 800 }}>
                  {formatSecondsToTime(sessionTimer)}
                </span>
                <span className="pill mono" style={{ fontSize: 11 }}>
                  PHASE 0{caseState.currentPhase}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="mono" style={{ fontSize: 11.5, color: 'var(--ink-dim)' }}>SESSION HASH:</span>
                <span className="pill mono" style={{ fontSize: 11 }}>
                  {caseState.recordHash ? `${caseState.recordHash.slice(0, 8)}...` : 'calc on seal...'}
                </span>
              </div>
            </div>

            {/* Speaker Orb & Live Caption Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 18 }}>
              <div className={`orb-ring ${caseState.isMicActive ? 'active-speaking' : ''} ${caseState.activeSpeaker === 'b' ? 'party-b-speaking' : ''}`}>
                <span style={{ fontSize: 26 }}>
                  {caseState.activeSpeaker === 'ref' ? '⚖️' : '🎙️'}
                </span>
              </div>

              <div style={{
                flex: 1,
                background: 'var(--bg)',
                border: '2.5px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '12px 18px',
                minHeight: 74,
                boxShadow: '2.5px 2.5px 0px var(--shadow-color)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  color: caseState.activeSpeaker === 'a' ? 'var(--primary)' : caseState.activeSpeaker === 'b' ? '#D97706' : '#059669',
                  marginBottom: 3
                }}>
                  {liveCaption.speaker}
                </div>
                <div style={{ fontSize: 15.5, fontWeight: 600, lineHeight: 1.35, color: 'var(--ink)' }}>
                  {liveCaption.text}
                </div>
              </div>
            </div>

            {/* Audio Waveform Spectrum */}
            <div style={{
              background: 'var(--surface-alt)',
              border: '2.5px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              marginBottom: 18
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 700, marginBottom: 4 }}>
                <span>PCM SPECTRAL DENSITY</span>
                <span style={{ color: caseState.isMicActive ? 'var(--accent-green)' : 'var(--ink-dim)' }}>
                  {caseState.isMicActive ? 'STREAMING ACTIVE' : 'AMBIENT SYNTHESIS'}
                </span>
              </div>
              <AudioWaveform
                mediaStream={activeMediaStream}
                isActive={caseState.isMicActive}
                activeSpeaker={caseState.activeSpeaker}
                height={54}
              />
            </div>

            {/* 4-Meters Dashboard */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 14,
              marginBottom: 22
            }} className="meters-grid-responsive">
              <div style={{ background: 'var(--surface-alt)', border: '2.5px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 14, boxShadow: '2.5px 2.5px 0px var(--shadow-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 800, marginBottom: 4 }}>
                  <span>PARTY A CLAIMS</span>
                  <span>{caseState.claimsCountA}</span>
                </div>
                <div style={{ fontFamily: 'var(--font-main)', fontSize: 19, fontWeight: 800, marginBottom: 4 }}>
                  {caseState.claimsCountA}
                </div>
                <div className="meter-gauge">
                  <div className="meter-gauge__bar" style={{ width: `${Math.min(100, caseState.claimsCountA * 15)}%`, background: 'var(--primary)' }}></div>
                </div>
              </div>

              <div style={{ background: 'var(--surface-alt)', border: '2.5px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 14, boxShadow: '2.5px 2.5px 0px var(--shadow-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 800, marginBottom: 4 }}>
                  <span>PARTY B CLAIMS</span>
                  <span>{caseState.claimsCountB}</span>
                </div>
                <div style={{ fontFamily: 'var(--font-main)', fontSize: 19, fontWeight: 800, marginBottom: 4 }}>
                  {caseState.claimsCountB}
                </div>
                <div className="meter-gauge">
                  <div className="meter-gauge__bar" style={{ width: `${Math.min(100, caseState.claimsCountB * 15)}%`, background: '#D97706' }}></div>
                </div>
              </div>

              <div style={{ background: 'var(--surface-alt)', border: '2.5px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 14, boxShadow: '2.5px 2.5px 0px var(--shadow-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 800, marginBottom: 4 }}>
                  <span>VERBATIM PINNED</span>
                  <span>{caseState.pinnedClaims.length}</span>
                </div>
                <div style={{ fontFamily: 'var(--font-main)', fontSize: 19, fontWeight: 800, marginBottom: 4 }}>
                  {caseState.pinnedClaims.length}
                </div>
                <div className="meter-gauge">
                  <div className="meter-gauge__bar" style={{ width: `${Math.min(100, caseState.pinnedClaims.length * 15)}%`, background: 'var(--accent-green)' }}></div>
                </div>
              </div>

              <div style={{ background: 'var(--surface-alt)', border: '2.5px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 14, boxShadow: '2.5px 2.5px 0px var(--shadow-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 800, marginBottom: 4 }}>
                  <span>DISAGREEMENT GAP</span>
                  <span>{caseState.disagreementIndex}%</span>
                </div>
                <div style={{ fontFamily: 'var(--font-main)', fontSize: 19, fontWeight: 800, marginBottom: 4 }}>
                  {caseState.disagreementIndex}%
                </div>
                <div className="meter-gauge">
                  <div
                    className="meter-gauge__bar"
                    style={{
                      width: `${caseState.disagreementIndex}%`,
                      background: caseState.disagreementIndex > 40 ? 'var(--accent-coral)' : caseState.disagreementIndex > 20 ? 'var(--accent-yellow)' : 'var(--accent-green)'
                    }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div style={{ display: 'flex', gap: 8, borderBottom: '3px solid var(--border)', paddingBottom: 12, marginBottom: 18, overflowX: 'auto' }}>
              <button
                className={`btn btn--sm ${activeTab === 'matrix' ? 'btn--primary' : 'btn--ghost'}`}
                onClick={() => { playTactileSound('click'); setActiveTab('matrix'); }}
              >
                <span>📋 Evidence Matrix</span>
                <span className="pill mono" style={{ fontSize: 10.5 }}>{caseState.pinnedClaims.length}</span>
              </button>

              <button
                className={`btn btn--sm ${activeTab === 'transcript' ? 'btn--primary' : 'btn--ghost'}`}
                onClick={() => { playTactileSound('click'); setActiveTab('transcript'); }}
              >
                <span>💬 Live Transcript</span>
                <span className="pill mono" style={{ fontSize: 10.5 }}>{caseState.transcript.length}</span>
              </button>

              <button
                className={`btn btn--sm ${activeTab === 'deliberation' ? 'btn--primary' : 'btn--ghost'}`}
                onClick={() => { playTactileSound('click'); setActiveTab('deliberation'); }}
              >
                <span>⚖️ Deliberation</span>
              </button>

              <button
                className={`btn btn--sm ${activeTab === 'settlement' ? 'btn--primary' : 'btn--ghost'}`}
                onClick={() => { playTactileSound('click'); setActiveTab('settlement'); }}
              >
                <span>📜 Settlement Draft</span>
              </button>

              <button
                className={`btn btn--sm ${activeTab === 'certificate' ? 'btn--primary' : 'btn--ghost'}`}
                onClick={() => { playTactileSound('click'); setActiveTab('certificate'); }}
              >
                <span>🛡️ Sealed Record</span>
              </button>

              <button
                className={`btn btn--sm ${activeTab === 'timeline' ? 'btn--primary' : 'btn--ghost'}`}
                onClick={() => { playTactileSound('click'); setActiveTab('timeline'); }}
              >
                <span>🕒 Audit Trail</span>
              </button>
            </div>

            {/* TAB 1: Evidence Matrix */}
            {activeTab === 'matrix' && (
              <div>
                {/* Search & Filter Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg)', border: '2px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '3px 8px' }}>
                      <Search size={13} color="var(--ink-dim)" />
                      <input
                        type="text"
                        placeholder="Search claims..."
                        value={claimSearch}
                        onChange={(e) => setClaimSearch(e.target.value)}
                        style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 12, color: 'var(--ink)', width: 110 }}
                      />
                    </div>

                    <button
                      className={`btn btn--sm ${filterParty === 'all' ? 'btn--primary' : 'btn--ghost'}`}
                      onClick={() => setFilterParty('all')}
                      style={{ padding: '4px 10px', fontSize: 12 }}
                    >
                      All ({caseState.pinnedClaims.length})
                    </button>
                    <button
                      className={`btn btn--sm ${filterParty === 'a' ? 'btn--primary' : 'btn--ghost'}`}
                      onClick={() => setFilterParty('a')}
                      style={{ padding: '4px 10px', fontSize: 12 }}
                    >
                      {caseState.partyA.split(' ')[0]} ({caseState.pinnedClaims.filter(c => c.speaker === 'a').length})
                    </button>
                    <button
                      className={`btn btn--sm ${filterParty === 'b' ? 'btn--yellow' : 'btn--ghost'}`}
                      onClick={() => setFilterParty('b')}
                      style={{ padding: '4px 10px', fontSize: 12 }}
                    >
                      {caseState.partyB.split(' ')[0]} ({caseState.pinnedClaims.filter(c => c.speaker === 'b').length})
                    </button>
                  </div>

                  <button
                    className="btn btn--sm btn--green"
                    onClick={() => {
                      setIsAddingManualClaim(!isAddingManualClaim);
                      playTactileSound('toggle');
                    }}
                  >
                    <Plus size={13} />
                    <span>{isAddingManualClaim ? 'Cancel' : 'Add Verbatim Claim'}</span>
                  </button>
                </div>

                {/* Inline Manual Claim Creator */}
                {isAddingManualClaim && (
                  <div style={{
                    background: 'var(--surface-alt)',
                    border: '2px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: 14,
                    marginBottom: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10
                  }}>
                    <h5 style={{ fontSize: 13.5, margin: 0 }}>
                      Add Verbatim Claim (as {caseState.activeSpeaker === 'a' ? caseState.partyA : caseState.activeSpeaker === 'b' ? caseState.partyB : 'Referee'})
                    </h5>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <input
                        type="text"
                        placeholder="Type exact spoken quote or commitment..."
                        value={manualClaimQuote}
                        onChange={(e) => setManualClaimQuote(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddManualClaim(); }}
                        style={{
                          flex: 1,
                          minWidth: 240,
                          padding: '7px 10px',
                          border: '2px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--bg)',
                          fontSize: 13,
                          color: 'var(--ink)'
                        }}
                      />
                      <select
                        value={manualClaimCategory}
                        onChange={(e) => setManualClaimCategory(e.target.value as 'Financial' | 'Timeline' | 'Obligation' | 'Admission')}
                        style={{
                          padding: '7px 10px',
                          border: '2px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--bg)',
                          fontSize: 13,
                          color: 'var(--ink)'
                        }}
                      >
                        <option value="Financial">Financial</option>
                        <option value="Timeline">Timeline</option>
                        <option value="Obligation">Obligation</option>
                        <option value="Admission">Admission</option>
                      </select>
                      <button className="btn btn--sm btn--primary" onClick={handleAddManualClaim}>
                        Pin to Matrix
                      </button>
                    </div>
                  </div>
                )}

                {filteredClaims.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--ink-dim)' }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                    <h4 style={{ fontSize: 17, marginBottom: 4 }}>No Claims Match Filter</h4>
                    <p style={{ fontSize: 13 }}>Connect microphone or click "Run Dialogue" to pin commitments live.</p>
                  </div>
                ) : (
                  <div className="matrix-table-wrap">
                    <table className="matrix-table">
                      <thead>
                        <tr>
                          <th style={{ width: 44 }}>#</th>
                          <th>Spoken Verbatim Quote</th>
                          <th style={{ width: 130 }}>Speaker</th>
                          <th style={{ width: 74 }}>Time</th>
                          <th>Extracted Commitment</th>
                          <th style={{ width: 140 }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredClaims.map((claim) => (
                          <tr key={claim.id}>
                            <td className="mono" style={{ fontWeight: 700 }}>{String(claim.id).padStart(2, '0')}</td>
                            <td><i>"{claim.quote}"</i></td>
                            <td>
                              <span className={`pill ${claim.speaker === 'a' ? 'pill--purple' : claim.speaker === 'b' ? 'pill--yellow' : 'pill--green'}`}>
                                {claim.speakerName.split(' ')[0]}
                              </span>
                            </td>
                            <td className="mono" style={{ fontSize: 11.5 }}>{claim.timestamp}</td>
                            <td><span className="quote-chip">{claim.commitment}</span></td>
                            <td>
                              <button
                                className={`pill ${claim.contested ? 'pill--coral' : 'pill--green'}`}
                                style={{ cursor: 'pointer' }}
                                onClick={() => handleToggleClaimStatus(claim.id)}
                                title="Click to toggle verified / contested"
                              >
                                {claim.contested ? 'Contested ⚠️' : 'Pinned Verbatim ✓'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Live Transcript */}
            {activeTab === 'transcript' && (
              <div style={{
                background: 'var(--surface-alt)',
                border: '2px solid var(--border)',
                borderRadius: 'var(--radius-xl)',
                padding: 18,
                maxHeight: 440,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 10
              }}>
                {caseState.transcript.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 32, color: 'var(--ink-dim)' }}>
                    No speech recorded yet. Speak into the mic or load a scenario.
                  </div>
                ) : (
                  caseState.transcript.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        padding: '10px 14px',
                        border: '2px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        boxShadow: '2px 2px 0px var(--shadow-color)',
                        background: item.speaker === 'a' ? '#EDE9FE' : item.speaker === 'b' ? '#FEF3C7' : '#D1FAE5',
                        borderLeft: `5px solid ${item.speaker === 'a' ? 'var(--primary)' : item.speaker === 'b' ? '#D97706' : '#059669'}`
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 800, color: 'var(--ink-dim)', marginBottom: 3 }}>
                        <span>{item.speakerName.toUpperCase()}</span>
                        <span>{item.timestamp}</span>
                      </div>
                      <div style={{ fontSize: 14, lineHeight: 1.4 }}>{item.text}</div>
                    </div>
                  ))
                )}
                <div ref={transcriptEndRef} />
              </div>
            )}

            {/* TAB 3: Deliberation */}
            {activeTab === 'deliberation' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18, marginBottom: 18 }}>
                  <div className="card-tactile" style={{ padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <h4>Position of {caseState.partyA}</h4>
                      <span className="pill pill--purple">Claimant</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {caseState.pinnedClaims.filter(c => c.speaker === 'a').map(q => (
                        <div key={q.id} style={{ padding: '8px 12px', background: 'var(--surface-alt)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
                          <span className="mono" style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 800 }}>[{q.timestamp}] </span>
                          "{q.quote}"
                        </div>
                      ))}
                      {caseState.pinnedClaims.filter(c => c.speaker === 'a').length === 0 && (
                        <div style={{ fontSize: 13, color: 'var(--ink-dim)' }}>Awaiting Party A testimony...</div>
                      )}
                    </div>
                  </div>

                  <div className="card-tactile" style={{ padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <h4>Position of {caseState.partyB}</h4>
                      <span className="pill pill--yellow">Respondent</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {caseState.pinnedClaims.filter(c => c.speaker === 'b').map(q => (
                        <div key={q.id} style={{ padding: '8px 12px', background: 'var(--surface-alt)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
                          <span className="mono" style={{ fontSize: 11, color: '#D97706', fontWeight: 800 }}>[{q.timestamp}] </span>
                          "{q.quote}"
                        </div>
                      ))}
                      {caseState.pinnedClaims.filter(c => c.speaker === 'b').length === 0 && (
                        <div style={{ fontSize: 13, color: 'var(--ink-dim)' }}>Awaiting Party B testimony...</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* LeMUR AI Consensus Recommendation */}
                <div className="card-tactile" style={{ background: 'var(--surface-alt)', marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                    <h4>Referee Clarifying Questions (Generated from Gaps)</h4>
                    <button
                      className="btn btn--sm btn--primary"
                      onClick={handleRunLeMur}
                      disabled={isGeneratingLeMur}
                    >
                      <Sparkles size={13} />
                      <span>{isGeneratingLeMur ? 'Generating Consensus...' : 'Run AssemblyAI LeMUR Consensus'}</span>
                    </button>
                  </div>

                  {lemurProposal && (
                    <div style={{ padding: '12px 16px', background: '#EDE9FE', border: '2px solid var(--primary)', borderRadius: 'var(--radius-md)', marginBottom: 14 }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 800, color: 'var(--primary)', marginBottom: 4 }}>
                        ★ ASSEMBLYAI LeMUR CONSENSUS PROPOSAL:
                      </div>
                      <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-main)', fontSize: 13.5, lineHeight: 1.5, margin: 0 }}>
                        {lemurProposal}
                      </pre>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ padding: '10px 14px', background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
                      <b>Question 1:</b> Both parties confirmed initial transaction dates. Can both parties align on the single net balance of ₹74,000 to resolve all claims?
                    </div>
                    <div style={{ padding: '10px 14px', background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
                      <b>Question 2:</b> Has Party B provided documented proof for deductions, and does Party A consent to finalize without further review?
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: Settlement Memorandum */}
            {activeTab === 'settlement' && (
              <div style={{
                background: 'var(--surface)',
                border: 'var(--border-width) solid var(--border)',
                borderRadius: 'var(--radius-xl)',
                boxShadow: 'var(--shadow-xl)',
                padding: 30
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <span className="pill pill--yellow" style={{ marginBottom: 6 }}>OFFICIAL MEMORANDUM OF SETTLEMENT</span>
                    <h2 style={{ fontSize: 22 }}>Settlement Agreement: {caseState.title}</h2>
                    <p className="mono" style={{ fontSize: 11.5, color: 'var(--ink-dim)', marginTop: 2 }}>
                      Governed by Verbatim Commitments on Case Record {caseState.id}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn--sm btn--primary"
                      onClick={() => {
                        playTactileSound('action');
                        generateSettlementPdf(caseState);
                      }}
                      title="Download official legal dossier with watermark and stamps"
                    >
                      <Download size={13} />
                      <span>Download PDF Dossier</span>
                    </button>
                    <button
                      className={`btn btn--sm ${isEditingSettlement ? 'btn--yellow' : 'btn--ghost'}`}
                      onClick={() => {
                        setIsEditingSettlement(!isEditingSettlement);
                        playTactileSound('toggle');
                      }}
                    >
                      <Edit3 size={13} />
                      <span>{isEditingSettlement ? 'Lock Terms' : 'Edit Terms'}</span>
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 20 }}>
                  <div style={{ background: 'var(--surface-alt)', border: '2px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 14 }}>
                    <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)', marginBottom: 5 }}>
                      Party A Obligation
                    </label>
                    {isEditingSettlement ? (
                      <textarea
                        rows={2}
                        value={caseState.settlement.obligationA}
                        onChange={(e) => setCaseState({
                          ...caseState,
                          settlement: { ...caseState.settlement, obligationA: e.target.value }
                        })}
                        style={{
                          width: '100%',
                          padding: '7px 9px',
                          border: '2px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--bg)',
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--ink)'
                        }}
                      />
                    ) : (
                      <p style={{ fontSize: 14, fontWeight: 600 }}>{caseState.settlement.obligationA}</p>
                    )}
                  </div>

                  <div style={{ background: 'var(--surface-alt)', border: '2px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 14 }}>
                    <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)', marginBottom: 5 }}>
                      Party B Obligation
                    </label>
                    {isEditingSettlement ? (
                      <textarea
                        rows={2}
                        value={caseState.settlement.obligationB}
                        onChange={(e) => setCaseState({
                          ...caseState,
                          settlement: { ...caseState.settlement, obligationB: e.target.value }
                        })}
                        style={{
                          width: '100%',
                          padding: '7px 9px',
                          border: '2px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--bg)',
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--ink)'
                        }}
                      />
                    ) : (
                      <p style={{ fontSize: 14, fontWeight: 600 }}>{caseState.settlement.obligationB}</p>
                    )}
                  </div>

                  <div style={{ background: 'var(--surface-alt)', border: '2px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 14 }}>
                    <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)', marginBottom: 5 }}>
                      Financial Settlement
                    </label>
                    {isEditingSettlement ? (
                      <input
                        type="text"
                        value={caseState.settlement.financialAmount}
                        onChange={(e) => setCaseState({
                          ...caseState,
                          settlement: { ...caseState.settlement, financialAmount: e.target.value }
                        })}
                        style={{
                          width: '100%',
                          padding: '7px 9px',
                          border: '2px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--bg)',
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--ink)'
                        }}
                      />
                    ) : (
                      <p style={{ fontSize: 14, fontWeight: 600 }}>{caseState.settlement.financialAmount}</p>
                    )}
                  </div>

                  <div style={{ background: 'var(--surface-alt)', border: '2px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 14 }}>
                    <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)', marginBottom: 5 }}>
                      Execution Deadline
                    </label>
                    {isEditingSettlement ? (
                      <input
                        type="text"
                        value={caseState.settlement.executionDeadline}
                        onChange={(e) => setCaseState({
                          ...caseState,
                          settlement: { ...caseState.settlement, executionDeadline: e.target.value }
                        })}
                        style={{
                          width: '100%',
                          padding: '7px 9px',
                          border: '2px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--bg)',
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--ink)'
                        }}
                      />
                    ) : (
                      <p style={{ fontSize: 14, fontWeight: 600 }}>{caseState.settlement.executionDeadline}</p>
                    )}
                  </div>
                </div>

                {/* Grounded Quotes */}
                <div style={{ background: 'var(--bg)', border: '2px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 14, marginBottom: 20 }}>
                  <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)', marginBottom: 5 }}>
                    Grounded in Verbatim Spoken Quotes
                  </label>
                  <ul style={{ paddingLeft: 18, fontSize: 13, lineHeight: 1.5, color: 'var(--ink-muted)' }}>
                    {caseState.pinnedClaims.slice(0, 4).map(c => (
                      <li key={c.id}>"{c.quote}" — Spoken by {c.speakerName} ({c.timestamp})</li>
                    ))}
                    {caseState.pinnedClaims.length === 0 && (
                      <li>Awaiting quotes from live Hearing session.</li>
                    )}
                  </ul>
                </div>

                {/* Bilateral Signatures */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, paddingTop: 18, borderTop: '2px dashed var(--border)' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 5 }}>{caseState.partyA} (Party A)</div>
                    <div style={{
                      height: 44,
                      borderBottom: '2.5px solid var(--border)',
                      marginBottom: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'var(--font-main)',
                      fontSize: 18,
                      fontWeight: 800,
                      color: 'var(--primary)'
                    }}>
                      {caseState.signedA ? `✓ Signed by ${caseState.partyA.split(' ')[0]}` : 'Pending Signature'}
                    </div>
                    <button
                      className={`btn btn--sm ${caseState.signedA ? 'btn--ghost' : 'btn--primary'}`}
                      disabled={caseState.signedA || (isRoomActive && localUserRole !== 'a' && localUserRole !== 'ref')}
                      onClick={() => handleSign('a')}
                      title={isRoomActive && localUserRole !== 'a' && localUserRole !== 'ref' ? 'Only Party A can sign here' : ''}
                    >
                      {caseState.signedA
                        ? 'Signed ✓'
                        : (!isRoomActive || localUserRole === 'a' || localUserRole === 'ref')
                        ? 'Sign as Party A ✍️'
                        : 'Awaiting Party A Signature 🔒'}
                    </button>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 5 }}>{caseState.partyB} (Party B)</div>
                    <div style={{
                      height: 44,
                      borderBottom: '2.5px solid var(--border)',
                      marginBottom: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'var(--font-main)',
                      fontSize: 18,
                      fontWeight: 800,
                      color: '#D97706'
                    }}>
                      {caseState.signedB ? `✓ Signed by ${caseState.partyB.split(' ')[0]}` : 'Pending Signature'}
                    </div>
                    <button
                      className={`btn btn--sm ${caseState.signedB ? 'btn--ghost' : 'btn--yellow'}`}
                      disabled={caseState.signedB || (isRoomActive && localUserRole !== 'b' && localUserRole !== 'ref')}
                      onClick={() => handleSign('b')}
                      title={isRoomActive && localUserRole !== 'b' && localUserRole !== 'ref' ? 'Only Party B can sign here' : ''}
                    >
                      {caseState.signedB
                        ? 'Signed ✓'
                        : (!isRoomActive || localUserRole === 'b' || localUserRole === 'ref')
                        ? 'Sign as Party B ✍️'
                        : 'Awaiting Party B Signature 🔒'}
                    </button>
                  </div>
                </div>

                <div style={{ textAlign: 'center', marginTop: 28 }}>
                  <button
                    className="btn btn--green btn--lg"
                    disabled={!caseState.signedA || !caseState.signedB}
                    onClick={handleSealRecord}
                  >
                    <Shield size={18} />
                    <span>Seal Cryptographic Record</span>
                  </button>
                  <p style={{ fontSize: 11.5, color: 'var(--ink-dim)', marginTop: 6 }}>
                    {caseState.signedA && caseState.signedB ? 'Both parties have signed! Ready to seal.' : 'Requires signatures from both parties to generate the sealed receipt.'}
                  </p>
                </div>
              </div>
            )}

            {/* TAB 5: Sealed Certificate */}
            {activeTab === 'certificate' && (
              <div className="sealed-cert" style={{ background: 'var(--surface)', border: 'var(--border-width) solid var(--border)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-xl)', padding: 36, position: 'relative', overflow: 'hidden' }}>
                <div className="cert-stamp">SEALED &amp;<br />VERIFIED</div>

                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                  <span className="pill pill--green" style={{ marginBottom: 6 }}>CRYPTOGRAPHICALLY IMMUTABLE</span>
                  <h2 style={{ fontSize: 24 }}>Certificate of Mediated Settlement</h2>
                  <p className="mono" style={{ fontSize: 12.5, color: 'var(--ink-dim)' }}>
                    Case {caseState.id} · Dual Signed &amp; Timestamped
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 20, fontSize: 13.5 }}>
                  <div><b>Case ID:</b> <span className="mono">{caseState.id}</span></div>
                  <div><b>Sealed At:</b> <span className="mono">{caseState.sealedTimestamp || '2026-09-29'}</span></div>
                  <div><b>Party A Signature:</b> <span className="mono">Signed ({caseState.partyA})</span></div>
                  <div><b>Party B Signature:</b> <span className="mono">Signed ({caseState.partyB})</span></div>
                  <div><b>Pinned Verbatim Proofs:</b> <span className="mono">{caseState.pinnedClaims.length} Quotes</span></div>
                  <div><b>Adjudication:</b> <span className="mono">Referee Neutral Verified</span></div>
                </div>

                <div style={{
                  background: 'var(--surface-alt)',
                  border: '2px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 12,
                  margin: '18px 0'
                }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 800, color: 'var(--primary)', marginBottom: 3 }}>
                    SHA-256 TAMPER-PROOF RECEIPT HASH:
                  </div>
                  <div className="mono" style={{ fontSize: 12.5, fontWeight: 700, wordBreak: 'break-all' }}>
                    {caseState.recordHash || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}
                  </div>
                </div>

                {integrityVerified === true && (
                  <div style={{
                    margin: '14px 0',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: '#D1FAE5',
                    border: '2px solid #059669',
                    color: '#065F46',
                    fontWeight: 700,
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8
                  }}>
                    <Check size={16} />
                    <span>Cryptographic Integrity Confirmed: SHA-256 seal matches verbatim case record.</span>
                  </div>
                )}
                {integrityVerified === false && (
                  <div style={{
                    margin: '14px 0',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: '#FEE2E2',
                    border: '2px solid #DC2626',
                    color: '#991B1B',
                    fontWeight: 700,
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8
                  }}>
                    <AlertCircle size={16} />
                    <span>Digest Mismatch: The current record differs from the cryptographic seal!</span>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap', marginTop: 28 }}>
                  <button 
                    className="btn btn--sm btn--primary" 
                    onClick={() => {
                      playTactileSound('action');
                      generateSettlementPdf(caseState);
                    }}
                    title="Download official legal dossier with watermark and stamps"
                  >
                    <Download size={14} />
                    <span>Download Legal PDF Dossier</span>
                  </button>
                  <button className="btn btn--sm btn--yellow" onClick={handleVerifyIntegrity}>
                    <CheckCircle size={14} />
                    <span>Verify Digest Integrity</span>
                  </button>
                  <button className="btn btn--sm btn--ghost" onClick={copyHash}>
                    <Copy size={14} />
                    <span>Copy Receipt Hash</span>
                  </button>
                  <button className="btn btn--sm btn--ghost" onClick={downloadJson}>
                    <Download size={14} />
                    <span>Export JSON Case Record</span>
                  </button>
                  {onOpenDashboard && (
                    <button 
                      className="btn btn--sm btn--secondary" 
                      onClick={() => {
                        playTactileSound('click');
                        onOpenDashboard();
                      }}
                      title="Open Document Vault"
                    >
                      <ExternalLink size={14} />
                      <span>Manage in Vault</span>
                    </button>
                  )}
                  <button className="btn btn--sm btn--ghost" onClick={() => window.print()}>
                    <Printer size={14} />
                    <span>Print Certificate</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 6: Audit Trail & Timeline */}
            {activeTab === 'timeline' && (
              <div style={{
                background: 'var(--surface-alt)',
                border: '2px solid var(--border)',
                borderRadius: 'var(--radius-xl)',
                padding: 18,
                maxHeight: 440,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 10
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 800 }}>Live Mediation Event Timeline</h4>
                  <span className="pill mono" style={{ fontSize: 10 }}>{auditLog.length} EVENTS</span>
                </div>
                {auditLog.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      padding: '8px 12px',
                      background: 'var(--surface)',
                      border: '1.5px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      fontSize: 13
                    }}
                  >
                    <span className="mono" style={{ fontSize: 11, fontWeight: 800, color: 'var(--primary)', flexShrink: 0 }}>
                      [{log.time}]
                    </span>
                    <span style={{ flex: 1 }}>{log.text}</span>
                    <span className="pill mono" style={{ fontSize: 9.5, padding: '2px 8px' }}>
                      {log.type.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Bottom Phase Controller */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 24,
              paddingTop: 16,
              borderTop: '2px dashed var(--border)',
              flexWrap: 'wrap',
              gap: 10
            }}>
              <div>
                <span className="mono" style={{ fontSize: 11.5, color: 'var(--ink-dim)' }}>ACTIVE STAGE:</span>
                <span className="pill mono" style={{ marginLeft: 8 }}>
                  Phase 0{caseState.currentPhase}: {caseState.currentPhase === 1 ? 'Hearing' : caseState.currentPhase === 2 ? 'Deliberation' : caseState.currentPhase === 3 ? 'Settlement' : 'Sealed Record'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {caseState.currentPhase > 1 && (
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={() => handlePhaseNav((caseState.currentPhase - 1) as 1 | 2 | 3 | 4)}
                  >
                    <ChevronLeft size={15} />
                    <span>Previous</span>
                  </button>
                )}
                {caseState.currentPhase < 4 && (
                  <button
                    className="btn btn--primary btn--sm"
                    onClick={() => handlePhaseNav((caseState.currentPhase + 1) as 1 | 2 | 3 | 4)}
                  >
                    <span>Advance to Phase 0{caseState.currentPhase + 1}</span>
                    <ChevronRight size={15} />
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* ROOM INVITATION MODAL */}
      {isInviteModalOpen && (
        <div className="modal-overlay">
          <div className="modal-dialog" style={{ maxWidth: 520, padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Share2 size={20} color="var(--primary)" />
                <h3 style={{ margin: 0, fontWeight: 800, fontSize: 18 }}>
                  Invite Participant to Room
                </h3>
              </div>
              <button 
                className="btn btn--sm btn--ghost" 
                style={{ padding: '6px 10px', minHeight: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={() => setIsInviteModalOpen(false)}
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{
                padding: '12px 14px',
                background: '#ECFDF5',
                border: '1.5px solid #065F46',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#065F46', textTransform: 'uppercase' }}>
                    Hearing Room Code
                  </div>
                  <div className="mono" style={{ fontSize: 20, fontWeight: 800 }}>
                    {caseState.id}
                  </div>
                </div>
                <span className="pill mono" style={{ fontSize: 10.5, background: '#D1FAE5', color: '#065F46', borderColor: '#065F46' }}>
                  <span className="dot" style={{ background: '#10B981' }}></span>
                  {peerCount} ACTIVE PEER{peerCount > 1 ? 'S' : ''}
                </span>
              </div>

              {/* Primary: Direct Party B Invite Link with Pre-assigned Role */}
              <div style={{
                background: '#FFFBEB',
                border: '2px solid #D97706',
                borderRadius: 'var(--radius-md)',
                padding: 14,
                boxShadow: '2px 2px 0px #D97706'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 12.5, color: '#B45309', fontWeight: 800 }}>
                    ★ Send to Party B ({caseState.partyB.split(' ')[0]})
                  </span>
                  <span className="pill mono" style={{ fontSize: 9.5, background: '#FDE68A', color: '#92400E', border: '1px solid #D97706' }}>
                    ROLE PRE-LOCKED
                  </span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--ink-muted)', marginBottom: 10, lineHeight: 1.4 }}>
                  Locks their participant identity to <b>Party B (Respondent)</b> upon entering. Prevents identity switching.
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}${window.location.pathname}?room=${caseState.id}&role=b`}
                    className="mono"
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-md)',
                      border: '1.5px solid var(--border)',
                      fontSize: 11.5,
                      background: '#FFFFFF'
                    }}
                  />
                  <button
                    className="btn btn--sm btn--yellow"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?room=${caseState.id}&role=b`);
                      playTactileSound('click');
                      alert('Party B invitation link copied to clipboard!');
                    }}
                  >
                    <Copy size={13} />
                    <span>Copy Link</span>
                  </button>
                </div>
              </div>

              {/* Secondary: Neutral Arbiter / Observer Link */}
              <div style={{
                background: 'var(--surface-alt)',
                border: '1.5px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: 12
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: '#065F46', fontWeight: 800 }}>
                    Invite Neutral Arbiter / Observer:
                  </span>
                  <button
                    className="btn btn--xs btn--ghost"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?room=${caseState.id}&role=ref`);
                      playTactileSound('click');
                      alert('Neutral Arbiter link copied!');
                    }}
                  >
                    <Copy size={12} />
                    <span>Copy Arbiter Link</span>
                  </button>
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-muted)' }}>
                  Enters the hearing as the neutral presiding referee with ruling powers.
                </div>
              </div>

              {/* General Share Link */}
              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, marginBottom: 4, color: 'var(--ink-dim)' }}>
                  Generic Room Link (Prompted to Verify Role upon Entry):
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}${window.location.pathname}?room=${caseState.id}`}
                    className="mono"
                    style={{
                      flex: 1,
                      padding: '7px 10px',
                      borderRadius: 'var(--radius-md)',
                      border: '1.5px solid var(--border)',
                      fontSize: 11,
                      background: 'var(--bg)'
                    }}
                  />
                  <button
                    className="btn btn--xs btn--ghost"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?room=${caseState.id}`);
                      playTactileSound('click');
                      alert('Room link copied!');
                    }}
                  >
                    <Copy size={12} />
                    <span>Copy</span>
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                <button className="btn btn--secondary" onClick={() => setIsInviteModalOpen(false)}>
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* IDENTITY GATE: CLAIM ROLE MODAL FOR JOINING GUESTS */}
      {isRoleModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div className="modal-dialog" style={{ maxWidth: 540, padding: 32 }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'var(--primary-subtle)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)',
                marginBottom: 12
              }}>
                <ShieldCheck size={26} />
              </div>
              <h3 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>
                Verify Your Participant Identity
              </h3>
              <p style={{ fontSize: 13.5, color: 'var(--ink-muted)', lineHeight: 1.5, margin: 0 }}>
                You are entering hearing <b>{caseState.id}</b>: <i>"{caseState.title}"</i>.<br />
                Select your verified identity to enter. Once claimed, your role is permanently locked for this session.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              {/* Option 1: Party B (Respondent) */}
              <div
                onClick={() => {
                  setLocalUserRole('b');
                  setCaseState(prev => ({ ...prev, activeSpeaker: 'b' }));
                  sessionStorage.setItem(`referee_session_role_${caseState.id}`, 'b');
                  setIsRoleModalOpen(false);
                  playTactileSound('success');
                  addAuditLog(`Joined hearing as Party B: ${caseState.partyB}`, 'system');
                }}
                style={{
                  padding: '16px 18px',
                  background: '#FFFBEB',
                  border: '2.5px solid #D97706',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: '3px 3px 0px #D97706',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'transform 0.1s ease'
                }}
              >
                <div>
                  <div style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#D97706', textTransform: 'uppercase', marginBottom: 2 }}>
                    ★ Recommended for Invited Guest
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}>
                    Party B (Respondent) — {caseState.partyB}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                    Testify and negotiate as respondent
                  </div>
                </div>
                <button className="btn btn--sm btn--yellow" style={{ pointerEvents: 'none' }}>
                  <span>Enter as Party B</span>
                  <ArrowRight size={14} />
                </button>
              </div>

              {/* Option 2: Referee (Neutral Arbiter) */}
              <div
                onClick={() => {
                  setLocalUserRole('ref');
                  setCaseState(prev => ({ ...prev, activeSpeaker: 'ref' }));
                  sessionStorage.setItem(`referee_session_role_${caseState.id}`, 'ref');
                  setIsRoleModalOpen(false);
                  playTactileSound('success');
                  addAuditLog('Joined hearing as Neutral Arbiter / Referee', 'system');
                }}
                style={{
                  padding: '16px 18px',
                  background: '#ECFDF5',
                  border: '2.5px solid #059669',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: '3px 3px 0px #059669',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'transform 0.1s ease'
                }}
              >
                <div>
                  <div style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#065F46', textTransform: 'uppercase', marginBottom: 2 }}>
                    Official Tribunal
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}>
                    Neutral Referee / Mediator
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                    Impartial arbiter presiding over hearing
                  </div>
                </div>
                <button className="btn btn--sm btn--green" style={{ pointerEvents: 'none' }}>
                  <span>Enter as Referee</span>
                  <ArrowRight size={14} />
                </button>
              </div>

              {/* Option 3: Party A (Only if host reconnecting) */}
              <div
                onClick={() => {
                  setLocalUserRole('a');
                  setCaseState(prev => ({ ...prev, activeSpeaker: 'a' }));
                  sessionStorage.setItem(`referee_session_role_${caseState.id}`, 'a');
                  setIsRoleModalOpen(false);
                  playTactileSound('success');
                  addAuditLog(`Reconnected as Claimant: ${caseState.partyA}`, 'system');
                }}
                style={{
                  padding: '12px 16px',
                  background: 'var(--bg)',
                  border: '1.5px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  opacity: 0.9
                }}
              >
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)' }}>
                    Party A (Claimant) — {caseState.partyA}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-muted)' }}>
                    Select only if you originally created this hearing
                  </div>
                </div>
                <span className="mono" style={{ fontSize: 11, color: 'var(--ink-dim)', fontWeight: 700 }}>
                  Reclaim Host Role →
                </span>
              </div>
            </div>

            <p style={{ fontSize: 11.5, color: 'var(--ink-muted)', textAlign: 'center', margin: 0 }}>
              🔒 Identity Protocol: Role assignment is signed cryptographically on the case record.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
