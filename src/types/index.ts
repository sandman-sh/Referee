export type SpeakerRole = 'a' | 'b' | 'ref';

export interface PinnedClaim {
  id: number;
  quote: string;
  speaker: SpeakerRole;
  speakerName: string;
  timestamp: string;
  commitment: string;
  category: 'Financial' | 'Timeline' | 'Obligation' | 'Admission';
  verified: boolean;
  contested?: boolean;
}

export interface TranscriptItem {
  id: string;
  speaker: SpeakerRole;
  speakerName: string;
  text: string;
  timestamp: string;
  isPartial?: boolean;
}

export interface SettlementTerms {
  obligationA: string;
  obligationB: string;
  financialAmount: string;
  executionDeadline: string;
  groundedQuotes: string[];
}

export interface CaseSessionState {
  id: string;
  title: string;
  partyA: string;
  partyB: string;
  scenario: 'deposit' | 'freelance' | 'marketplace' | 'custom';
  currentPhase: 1 | 2 | 3 | 4; // 1: Hearing, 2: Deliberation, 3: Settlement, 4: Sealed
  activeSpeaker: SpeakerRole;
  isMicActive: boolean;
  claimsCountA: number;
  claimsCountB: number;
  disagreementIndex: number;
  pinnedClaims: PinnedClaim[];
  transcript: TranscriptItem[];
  settlement: SettlementTerms;
  amendmentA: string;
  amendmentB: string;
  signedA: boolean;
  signedB: boolean;
  isSealed: boolean;
  sealedTimestamp: string | null;
  recordHash: string;
}
