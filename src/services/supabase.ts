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

// Browser Database & Local Identity Scoping
const STORAGE_KEY_CLIENT_ID = 'referee_client_id';
const STORAGE_KEY_MY_ROOMS = 'referee_my_rooms';
const STORAGE_KEY_MY_DOC_IDS = 'referee_my_doc_ids';
const STORAGE_KEY_LOCAL_DOCS = 'referee_sealed_docs';

export function getBrowserClientId(): string {
  try {
    let clientId = localStorage.getItem(STORAGE_KEY_CLIENT_ID);
    if (!clientId) {
      clientId = `CLIENT-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
      localStorage.setItem(STORAGE_KEY_CLIENT_ID, clientId);
    }
    return clientId;
  } catch {
    return 'CLIENT-ANON-LOCAL';
  }
}

export function getMyParticipatedRooms(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MY_ROOMS);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function recordMyRoomParticipation(roomId: string): void {
  if (!roomId) return;
  const cleanId = roomId.trim().toUpperCase();
  try {
    const rooms = getMyParticipatedRooms();
    if (!rooms.includes(cleanId)) {
      rooms.push(cleanId);
      localStorage.setItem(STORAGE_KEY_MY_ROOMS, JSON.stringify(rooms));
    }
  } catch (e) {
    console.warn('Failed to record room participation in browser database:', e);
  }
}

export function getMyVaultDocumentIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MY_DOC_IDS);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function recordMyVaultDocument(doc: DocumentRecord): void {
  try {
    // 1. Record doc ID in user's vault
    const docIds = getMyVaultDocumentIds();
    if (!docIds.includes(doc.id)) {
      docIds.push(doc.id);
      localStorage.setItem(STORAGE_KEY_MY_DOC_IDS, JSON.stringify(docIds));
    }
    // 2. Record participating room ID
    if (doc.room_id) {
      recordMyRoomParticipation(doc.room_id);
    }
    // 3. Cache document object in browser database
    const rawCache = localStorage.getItem(STORAGE_KEY_LOCAL_DOCS);
    const cache: Record<string, DocumentRecord> = rawCache ? JSON.parse(rawCache) : {};
    cache[doc.id] = doc;
    localStorage.setItem(STORAGE_KEY_LOCAL_DOCS, JSON.stringify(cache));
  } catch (e) {
    console.warn('Failed to save document in browser database:', e);
  }
}

export function getLocalVaultDocuments(): DocumentRecord[] {
  try {
    const rawCache = localStorage.getItem(STORAGE_KEY_LOCAL_DOCS);
    if (!rawCache) return [];
    const cache: Record<string, DocumentRecord> = JSON.parse(rawCache);
    return Object.values(cache);
  } catch {
    return [];
  }
}

export function removeLocalVaultDocument(docId: string): void {
  try {
    const docIds = getMyVaultDocumentIds().filter(id => id !== docId);
    localStorage.setItem(STORAGE_KEY_MY_DOC_IDS, JSON.stringify(docIds));

    const rawCache = localStorage.getItem(STORAGE_KEY_LOCAL_DOCS);
    if (rawCache) {
      const cache: Record<string, DocumentRecord> = JSON.parse(rawCache);
      delete cache[docId];
      localStorage.setItem(STORAGE_KEY_LOCAL_DOCS, JSON.stringify(cache));
    }
  } catch (e) {
    console.warn('Failed to remove document from browser storage:', e);
  }
}

// Documents Dashboard CRUD (Scoped to Browser & Participated Sessions)
export async function saveDocumentToVault(doc: {
  id: string;
  roomId: string;
  caseTitle: string;
  docType: string;
  recordHash: string;
  sealedAt: string;
  metadata?: any;
}): Promise<DocumentRecord> {
  const clientId = getBrowserClientId();
  const enrichedMetadata = {
    ...(doc.metadata || {}),
    creatorClientId: clientId,
    browserStoredAt: new Date().toISOString()
  };

  const docRecord: DocumentRecord = {
    id: doc.id,
    room_id: doc.roomId,
    case_title: doc.caseTitle,
    doc_type: doc.docType,
    record_hash: doc.recordHash,
    sealed_at: doc.sealedAt,
    status: 'sealed',
    metadata: enrichedMetadata,
    created_at: new Date().toISOString()
  };

  // 1. Save immediately in browser database (offline-ready, instant isolation)
  recordMyVaultDocument(docRecord);

  // 2. Persist to Supabase ledger
  try {
    await supabase.from('referee_documents').upsert([{
      id: doc.id,
      room_id: doc.roomId,
      case_title: doc.caseTitle,
      doc_type: doc.docType,
      record_hash: doc.recordHash,
      sealed_at: doc.sealedAt,
      status: 'sealed',
      metadata: enrichedMetadata
    }]);
  } catch (err) {
    console.warn('Supabase document vault sync warning (retained in browser database):', err);
  }

  return docRecord;
}

export function clearAllLocalVault(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_MY_DOC_IDS);
    localStorage.removeItem(STORAGE_KEY_MY_ROOMS);
    localStorage.removeItem(STORAGE_KEY_LOCAL_DOCS);
  } catch (e) {
    console.warn('Failed to clear local vault:', e);
  }
}

export async function fetchVaultDocuments(): Promise<DocumentRecord[]> {
  const myRooms = getMyParticipatedRooms();
  const myDocIds = getMyVaultDocumentIds();
  const localDocs = getLocalVaultDocuments();

  // Strict Browser Isolation:
  // If this browser has never created or joined any hearing rooms and has no saved document IDs,
  // return an empty array. Do NOT leak other users' sealed legal settlements!
  if (myRooms.length === 0 && myDocIds.length === 0) {
    return [];
  }

  const docMap = new Map<string, DocumentRecord>();

  // Fetch scoped remote records from Supabase only for rooms or documents this browser is authorized for
  try {
    const queries: Promise<any>[] = [];

    if (myRooms.length > 0) {
      queries.push(
        Promise.resolve(
          supabase
            .from('referee_documents')
            .select('*')
            .in('room_id', myRooms)
        )
      );
    }

    if (myDocIds.length > 0) {
      queries.push(
        Promise.resolve(
          supabase
            .from('referee_documents')
            .select('*')
            .in('id', myDocIds)
        )
      );
    }

    const responses = await Promise.all(queries);
    const remoteDocs = new Map<string, DocumentRecord>();

    for (const res of responses) {
      if (!res.error && res.data) {
        for (const d of res.data) {
          const docRecord: DocumentRecord = {
            id: d.id,
            room_id: d.room_id,
            case_title: d.case_title,
            doc_type: d.doc_type,
            record_hash: d.record_hash,
            sealed_at: d.sealed_at,
            status: d.status,
            metadata: d.metadata,
            created_at: d.created_at
          };
          remoteDocs.set(docRecord.id, docRecord);
        }
      }
    }

    // Authoritative Sync:
    // If Supabase queries succeeded, sync authoritatively so deleted previous test records are purged
    if (responses.length > 0 && responses.every(r => !r.error)) {
      const validCache: Record<string, DocumentRecord> = {};
      const validDocIds: string[] = [];

      for (const [id, doc] of remoteDocs.entries()) {
        validCache[id] = doc;
        validDocIds.push(id);
      }

      localStorage.setItem(STORAGE_KEY_LOCAL_DOCS, JSON.stringify(validCache));
      localStorage.setItem(STORAGE_KEY_MY_DOC_IDS, JSON.stringify(validDocIds));

      return Array.from(remoteDocs.values()).sort((a, b) => {
        const timeA = new Date(a.sealed_at || a.created_at).getTime();
        const timeB = new Date(b.sealed_at || b.created_at).getTime();
        return timeB - timeA;
      });
    }
  } catch (err) {
    console.warn('Supabase fetchVaultDocuments network exception (serving from local cache):', err);
  }

  // Fallback to local cache if network/Supabase was unreachable
  for (const doc of localDocs) {
    if (myDocIds.includes(doc.id) || (doc.room_id && myRooms.includes(doc.room_id))) {
      docMap.set(doc.id, doc);
    }
  }

  return Array.from(docMap.values()).sort((a, b) => {
    const timeA = new Date(a.sealed_at || a.created_at).getTime();
    const timeB = new Date(b.sealed_at || b.created_at).getTime();
    return timeB - timeA;
  });
}

// Fetch a single document by Room Code or Docket ID to explicitly import into this browser's vault
export async function fetchDocumentByIdOrRoom(identifier: string): Promise<DocumentRecord | null> {
  const clean = identifier.trim().toUpperCase();
  if (!clean) return null;

  try {
    // Check local database first
    const localDocs = getLocalVaultDocuments();
    const localMatch = localDocs.find(d => d.id.toUpperCase() === clean || d.room_id.toUpperCase() === clean);
    if (localMatch) {
      recordMyVaultDocument(localMatch);
      return localMatch;
    }

    // Query Supabase for matching record
    const { data, error } = await supabase
      .from('referee_documents')
      .select('*')
      .or(`id.eq.${clean},room_id.eq.${clean}`)
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    const docRecord: DocumentRecord = {
      id: data.id,
      room_id: data.room_id,
      case_title: data.case_title,
      doc_type: data.doc_type,
      record_hash: data.record_hash,
      sealed_at: data.sealed_at,
      status: data.status,
      metadata: data.metadata,
      created_at: data.created_at
    };

    // Store into this browser's database
    recordMyVaultDocument(docRecord);
    return docRecord;
  } catch (e) {
    console.warn('Error fetching document by ID or Room:', e);
    return null;
  }
}

export async function deleteVaultDocument(id: string): Promise<void> {
  // 1. Remove from local browser database
  removeLocalVaultDocument(id);

  // 2. Delete from Supabase
  try {
    await supabase.from('referee_documents').delete().eq('id', id);
  } catch (e) {
    console.warn('Error deleting document from Supabase:', e);
  }
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
