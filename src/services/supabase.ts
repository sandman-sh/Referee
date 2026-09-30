import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import { CaseSessionState, PinnedClaim, TranscriptItem } from '../types';

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://ncfrzscpvxyftdlrbgzs.supabase.co';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jZnJ6c2Nwdnh5ZnRkbHJiZ3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNDk0NDEsImV4cCI6MjEwNDYyNTQ0MX0.yPT_enQ6anLw20E4d0PukW5brIjQJ-BMORh4blZbGhE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

export interface SupabaseRoomRow {
  id: string;
  title: string;
  party_a: string;
  party_b: string;
  party_a_email?: string;
  party_b_email?: string;
  scenario?: string;
  current_phase: number;
  active_speaker: string;
  disagreement_index: number;
  settlement: any;
  signed_a: boolean;
  signed_b: boolean;
  is_sealed: boolean;
  sealed_timestamp?: string | null;
  record_hash?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DocumentRecord {
  id: string;
  room_id: string;
  case_title: string;
  doc_type: string;
  record_hash: string;
  sealed_at: string;
  status: string;
  metadata: any;
  created_at: string;
}

// Map Supabase row to CaseSessionState
export function mapRowToCaseState(row: SupabaseRoomRow, evidence: PinnedClaim[] = [], transcript: TranscriptItem[] = []): CaseSessionState {
  return {
    id: row.id,
    title: row.title || 'Mediation Hearing',
    partyA: row.party_a || 'Party A',
    partyB: row.party_b || 'Party B',
    scenario: (row.scenario as any) || 'custom',
    currentPhase: (row.current_phase as 1 | 2 | 3 | 4) || 1,
    activeSpeaker: (row.active_speaker as any) || 'a',
    isMicActive: false,
    claimsCountA: evidence.filter(e => e.speaker === 'a').length,
    claimsCountB: evidence.filter(e => e.speaker === 'b').length,
    disagreementIndex: row.disagreement_index || 0,
    pinnedClaims: evidence,
    transcript: transcript,
    settlement: row.settlement || {
      obligationA: '',
      obligationB: '',
      financialAmount: '',
      executionDeadline: '',
      groundedQuotes: []
    },
    amendmentA: '',
    amendmentB: '',
    signedA: !!row.signed_a,
    signedB: !!row.signed_b,
    isSealed: !!row.is_sealed,
    sealedTimestamp: row.sealed_timestamp || null,
    recordHash: row.record_hash || ''
  };
}

// Fetch or create a room
export async function getOrCreateRoom(
  roomId: string,
  initialData?: Partial<CaseSessionState>
): Promise<{ state: CaseSessionState; isNew: boolean }> {
  const { data: existing, error: fetchErr } = await supabase
    .from('referee_rooms')
    .select('*')
    .eq('id', roomId)
    .single();

  if (existing && !fetchErr) {
    const [evidence, transcripts] = await Promise.all([
      fetchEvidenceClaims(roomId),
      fetchTranscriptItems(roomId)
    ]);
    return { state: mapRowToCaseState(existing, evidence, transcripts), isNew: false };
  }

  // Create room
  const newRow: Partial<SupabaseRoomRow> = {
    id: roomId,
    title: initialData?.title || 'Security Deposit Return Dispute',
    party_a: initialData?.partyA || 'Meera Sharma (Tenant)',
    party_b: initialData?.partyB || 'Mr. R.K. Khanna (Landlord)',
    scenario: initialData?.scenario || 'deposit',
    current_phase: initialData?.currentPhase || 1,
    active_speaker: initialData?.activeSpeaker || 'a',
    disagreement_index: initialData?.disagreementIndex || 0,
    settlement: initialData?.settlement || {
      obligationA: 'Hand over flat keys and shared move-out photographs.',
      obligationB: 'Return full security deposit minus the agreed ₹6,000 painting deduction.',
      financialAmount: '₹74,000 to be transferred via direct bank deposit.',
      executionDeadline: 'By 7 October 2026 (7 days from execution).',
      groundedQuotes: []
    },
    signed_a: false,
    signed_b: false,
    is_sealed: false,
    sealed_timestamp: null,
    record_hash: ''
  };

  const { data: created, error: insertErr } = await supabase
    .from('referee_rooms')
    .insert([newRow])
    .select()
    .single();

  if (insertErr || !created) {
    console.warn('Failed to insert room to Supabase, running local state:', insertErr);
    return {
      state: initialData as CaseSessionState,
      isNew: true
    };
  }

  return { state: mapRowToCaseState(created, [], []), isNew: true };
}

// Update room state in Supabase
export async function updateRemoteRoom(roomId: string, patch: Partial<CaseSessionState>): Promise<void> {
  const dbPatch: Record<string, any> = {
    updated_at: new Date().toISOString()
  };

  if (patch.title !== undefined) dbPatch.title = patch.title;
  if (patch.partyA !== undefined) dbPatch.party_a = patch.partyA;
  if (patch.partyB !== undefined) dbPatch.party_b = patch.partyB;
  if (patch.currentPhase !== undefined) dbPatch.current_phase = patch.currentPhase;
  if (patch.activeSpeaker !== undefined) dbPatch.active_speaker = patch.activeSpeaker;
  if (patch.disagreementIndex !== undefined) dbPatch.disagreement_index = patch.disagreementIndex;
  if (patch.settlement !== undefined) dbPatch.settlement = patch.settlement;
  if (patch.signedA !== undefined) dbPatch.signed_a = patch.signedA;
  if (patch.signedB !== undefined) dbPatch.signed_b = patch.signedB;
  if (patch.isSealed !== undefined) dbPatch.is_sealed = patch.isSealed;
  if (patch.sealedTimestamp !== undefined) dbPatch.sealed_timestamp = patch.sealedTimestamp;
  if (patch.recordHash !== undefined) dbPatch.record_hash = patch.recordHash;

  await supabase
    .from('referee_rooms')
    .update(dbPatch)
    .eq('id', roomId);
}

// Evidence Claims CRUD
export async function insertEvidenceClaim(roomId: string, claim: PinnedClaim): Promise<void> {
  await supabase.from('referee_evidence').insert([{
    room_id: roomId,
    quote: claim.quote,
    speaker: claim.speaker,
    speaker_name: claim.speakerName,
    timestamp: claim.timestamp,
    commitment: claim.commitment,
    category: claim.category,
    contested: !!claim.contested,
    verified: !!claim.verified
  }]);
}

export async function fetchEvidenceClaims(roomId: string): Promise<PinnedClaim[]> {
  const { data, error } = await supabase
    .from('referee_evidence')
    .select('*')
    .eq('room_id', roomId)
    .order('id', { ascending: true });

  if (error || !data) return [];
  return data.map((d, index) => ({
    id: index + 1,
    quote: d.quote,
    speaker: d.speaker,
    speakerName: d.speaker_name,
    timestamp: d.timestamp,
    commitment: d.commitment,
    category: d.category,
    contested: d.contested,
    verified: d.verified
  }));
}

export async function toggleEvidenceContestedRemote(roomId: string, quoteText: string, contested: boolean): Promise<void> {
  await supabase
    .from('referee_evidence')
    .update({ contested })
    .eq('room_id', roomId)
    .eq('quote', quoteText);
}

// Transcript Items CRUD
export async function insertTranscriptItem(roomId: string, item: TranscriptItem): Promise<void> {
  await supabase.from('referee_transcripts').insert([{
    id: item.id,
    room_id: roomId,
    speaker: item.speaker,
    speaker_name: item.speakerName,
    text: item.text,
    timestamp: item.timestamp
  }]);
}

export async function fetchTranscriptItems(roomId: string): Promise<TranscriptItem[]> {
  const { data, error } = await supabase
    .from('referee_transcripts')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true });

  if (error || !data) return [];
  return data.map(d => ({
    id: d.id,
    speaker: d.speaker,
    speakerName: d.speaker_name,
    text: d.text,
    timestamp: d.timestamp
  }));
}

// Documents Dashboard CRUD
export async function saveDocumentToVault(doc: {
  id: string;
  roomId: string;
  caseTitle: string;
  docType: string;
  recordHash: string;
  sealedAt: string;
  metadata?: any;
}): Promise<void> {
  await supabase.from('referee_documents').upsert([{
    id: doc.id,
    room_id: doc.roomId,
    case_title: doc.caseTitle,
    doc_type: doc.docType,
    record_hash: doc.recordHash,
    sealed_at: doc.sealedAt,
    status: 'sealed',
    metadata: doc.metadata || {}
  }]);
}

export async function fetchVaultDocuments(): Promise<DocumentRecord[]> {
  const { data, error } = await supabase
    .from('referee_documents')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data.map(d => ({
    id: d.id,
    room_id: d.room_id,
    case_title: d.case_title,
    doc_type: d.doc_type,
    record_hash: d.record_hash,
    sealed_at: d.sealed_at,
    status: d.status,
    metadata: d.metadata,
    created_at: d.created_at
  }));
}

export async function deleteVaultDocument(id: string): Promise<void> {
  await supabase.from('referee_documents').delete().eq('id', id);
}

// Realtime Room Channel for Sync & WebRTC Peer Signaling
export function subscribeToRealtimeRoom(
  roomId: string,
  callbacks: {
    onRoomUpdate?: (row: SupabaseRoomRow) => void;
    onNewClaim?: (claim: PinnedClaim) => void;
    onNewTranscript?: (item: TranscriptItem) => void;
    onWebRTCSignal?: (signal: any) => void;
    onPeerPresence?: (peers: any) => void;
  }
): { channel: RealtimeChannel; unsubscribe: () => void; broadcastSignal: (payload: any) => void } {
  const channel = supabase.channel(`referee:${roomId}`, {
    config: {
      presence: { key: roomId }
    }
  });

  // Database changes for rooms
  channel
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'referee_rooms', filter: `id=eq.${roomId}` },
      (payload) => {
        callbacks.onRoomUpdate?.(payload.new as SupabaseRoomRow);
      }
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'referee_evidence', filter: `room_id=eq.${roomId}` },
      (payload) => {
        const d = payload.new;
        callbacks.onNewClaim?.({
          id: d.id,
          quote: d.quote,
          speaker: d.speaker,
          speakerName: d.speaker_name,
          timestamp: d.timestamp,
          commitment: d.commitment,
          category: d.category,
          contested: d.contested,
          verified: d.verified
        });
      }
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'referee_transcripts', filter: `room_id=eq.${roomId}` },
      (payload) => {
        const d = payload.new;
        callbacks.onNewTranscript?.({
          id: d.id,
          speaker: d.speaker,
          speakerName: d.speaker_name,
          text: d.text,
          timestamp: d.timestamp
        });
      }
    );

  // Broadcast channel for instantaneous WebRTC audio signaling & typing events
  channel.on('broadcast', { event: 'webrtc_signal' }, (payload) => {
    callbacks.onWebRTCSignal?.(payload.payload);
  });

  channel.on('presence', { event: 'sync' }, () => {
    const presenceState = channel.presenceState();
    callbacks.onPeerPresence?.(presenceState);
  });

  channel.subscribe((status) => {
    console.log(`Supabase Realtime room [${roomId}] status:`, status);
  });

  const broadcastSignal = (payload: any) => {
    channel.send({
      type: 'broadcast',
      event: 'webrtc_signal',
      payload
    });
  };

  const unsubscribe = () => {
    supabase.removeChannel(channel);
  };

  return { channel, unsubscribe, broadcastSignal };
}
