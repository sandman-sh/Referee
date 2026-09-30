import React from 'react';
import { ArrowRight, Mic, ShieldCheck, FileCheck, Scale, Cpu, Sparkles, Building, Briefcase, ShoppingBag, Users, CheckCircle } from 'lucide-react';
import { AudioWaveform } from '../components/AudioWaveform';
import { InteractiveMiniTester } from '../components/InteractiveMiniTester';
import { playTactileSound } from '../utils/audio';

interface HomepageProps {
  onLaunchConsole: () => void;
}

export const Homepage: React.FC<HomepageProps> = ({ onLaunchConsole }) => {
  const handleLaunch = () => {
    playTactileSound('click');
    onLaunchConsole();
  };

  const scrollToTester = () => {
    playTactileSound('click');
    const el = document.getElementById('tester');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div style={{ paddingBottom: 0 }}>
      {/* Hero Section */}
      <section className="wrap" style={{ paddingTop: 28, paddingBottom: 64 }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1.1fr 0.9fr',
          gap: 48,
          alignItems: 'center'
        }} className="hero-grid-responsive">
          {/* Hero Left Column */}
          <div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '7px 16px',
              background: 'var(--accent-yellow)',
              border: 'var(--border-width) solid var(--border)',
              borderRadius: 'var(--radius-pill)',
              boxShadow: 'var(--shadow-sm)',
              fontFamily: 'var(--font-mono)',
              fontWeight: 800,
              fontSize: 12.5,
              marginBottom: 24
            }}>
              <span>★</span>
              <span>TRIADIC DISPUTE MEDIATION · REAL-TIME SPEECH</span>
            </div>

            <h1 style={{
              fontSize: 'clamp(36px, 4.4vw, 56px)',
              lineHeight: 1.12,
              marginBottom: 24,
              letterSpacing: '-0.02em',
              fontWeight: 800
            }}>
              Every conflict deserves a fair hearing.{' '}
              <span style={{
                background: 'var(--primary)',
                color: '#FFFFFF',
                padding: '2px 12px',
                borderRadius: 'var(--radius-sm)',
                display: 'inline-block',
                border: '2.5px solid var(--border)',
                boxShadow: '4px 4px 0px var(--shadow-color)',
                transform: 'rotate(-1deg)'
              }}>
                Referee listens.
              </span>
            </h1>

            <p style={{
              fontSize: 17,
              lineHeight: 1.65,
              color: 'var(--ink-muted)',
              marginBottom: 32,
              maxWidth: 580
            }}>
              Referee sits between two people in a dispute — landlord &amp; tenant, client &amp; freelancer, buyer &amp; seller.
              It listens to <b>both sides in real time</b>, pins commitments <b>verbatim to an evidence matrix</b>,
              monitors the <b>disagreement gap</b>, and drafts a balanced settlement that <b>only humans approve</b>.
            </p>

            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 34 }}>
              <button
                className="btn btn--primary"
                onClick={handleLaunch}
              >
                <span className="dot"></span>
                <span>Open Live Mediation Console</span>
                <ArrowRight size={17} />
              </button>

              <button
                className="btn btn--ghost"
                onClick={scrollToTester}
              >
                <span>Test Verbatim Engine</span>
                <span>↓</span>
              </button>
            </div>

            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--ink-dim)' }}>
                <span style={{ color: 'var(--accent-green)', fontWeight: 900 }}>✓</span>
                <span>Streaming Speech-to-Text</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--ink-dim)' }}>
                <span style={{ color: 'var(--accent-green)', fontWeight: 900 }}>✓</span>
                <span>Zero Hallucinations</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--ink-dim)' }}>
                <span style={{ color: 'var(--accent-green)', fontWeight: 900 }}>✓</span>
                <span>SHA-256 Sealed Receipt</span>
              </div>
            </div>
          </div>

          {/* Hero Right Visual Card */}
          <div style={{
            background: 'var(--surface)',
            border: 'var(--border-width) solid var(--border)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-xl)',
            padding: 28
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: 16,
              marginBottom: 18,
              borderBottom: '3px dashed var(--border)'
            }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#EF4444', border: '2px solid var(--border)' }}></span>
                <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#FACC15', border: '2px solid var(--border)' }}></span>
                <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#10B981', border: '2px solid var(--border)' }}></span>
              </div>
              <span className="pill pill--purple mono" style={{ fontSize: 11 }}>CASE 09-842 · DEPOSIT DISPUTE</span>
            </div>

            {/* Audio Waveform Canvas */}
            <div style={{
              background: 'var(--surface-alt)',
              border: '3px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: 14,
              marginBottom: 20
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 800, marginBottom: 8 }}>
                <span>LIVE SPECTRAL AUDIO</span>
                <span style={{ color: 'var(--accent-green)' }}>DUAL CHANNEL ACTIVE</span>
              </div>
              <AudioWaveform
                mediaStream={null}
                isActive={true}
                activeSpeaker="a"
                height={64}
              />
            </div>

            {/* Conversation Snippets with Hard Drop Shadows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              <div style={{
                background: '#EDE9FE',
                border: '3px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                boxShadow: '4px 4px 0px var(--shadow-color)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 800, color: 'var(--primary)', marginBottom: 4 }}>
                  <span>MEERA (TENANT)</span>
                  <span>00:14</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  "I transferred eighty thousand rupees on May 2nd and sent move-out photos."
                </div>
                <div style={{ marginTop: 6 }}>
                  <span className="quote-chip">₹80,000 · May 2nd · move-out photos</span>
                </div>
              </div>

              <div style={{
                background: '#FEF3C7',
                border: '3px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                boxShadow: '4px 4px 0px var(--shadow-color)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 800, color: '#D97706', marginBottom: 4 }}>
                  <span>MR. KHANNA (LANDLORD)</span>
                  <span>00:38</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  "I can refund seventy-four thousand by Friday after the painting deduction."
                </div>
                <div style={{ marginTop: 6 }}>
                  <span className="quote-chip">₹74,000 · Friday · refund</span>
                </div>
              </div>
            </div>

            {/* Live Disagreement Meter */}
            <div style={{
              background: 'var(--surface-alt)',
              border: '3px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 11.5, fontWeight: 800, marginBottom: 6 }}>
                <span>DISAGREEMENT GAP</span>
                <span style={{ color: 'var(--accent-green)' }}>CONVERGED TO 12%</span>
              </div>
              <div className="meter-gauge">
                <div className="meter-gauge__bar" style={{ width: '12%', background: 'var(--accent-green)' }}></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Marquee Ticker */}
      <div className="ticker">
        <div className="ticker__track">
          <span className="ticker__item">No Arbitrary Judgments</span>
          <span className="ticker__item">Only Verbatim Commitments</span>
          <span className="ticker__item">Bilateral Consensus Required</span>
          <span className="ticker__item">Cryptographic SHA-256 Receipt</span>
          <span className="ticker__item">Zero AI Hallucinations</span>
          <span className="ticker__item">Dual-Party Voice Streaming</span>
          <span className="ticker__item">No Arbitrary Judgments</span>
          <span className="ticker__item">Only Verbatim Commitments</span>
          <span className="ticker__item">Bilateral Consensus Required</span>
          <span className="ticker__item">Cryptographic SHA-256 Receipt</span>
        </div>
      </div>

      {/* Core Principles */}
      <section id="principles" className="wrap" style={{ paddingTop: 80, paddingBottom: 80 }}>
        <div style={{ textAlign: 'center', maxWidth: 740, margin: '0 auto 50px' }}>
          <span className="pill pill--purple" style={{ marginBottom: 14 }}>FOUNDATIONAL ARCHITECTURE</span>
          <h2 style={{ fontSize: 'clamp(32px, 4vw, 44px)', marginBottom: 16 }}>
            Three Non-Negotiable Tenets of Triadic Mediation
          </h2>
          <p style={{ fontSize: 18, color: 'var(--ink-muted)' }}>
            Most AI tools try to replace human judgement. Referee does the opposite: it locks both parties to their exact spoken words so nobody can backtrack.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 28
        }}>
          <div className="card-tactile">
            <div className="card-tactile__icon" style={{ background: '#EDE9FE', color: 'var(--primary)' }}>
              <Scale size={32} />
            </div>
            <h3>Impartial Triadic Mediator</h3>
            <p>
              Referee does not take sides or act as an echo chamber. It sits firmly between both parties, ensuring equal speaking opportunities, noting objections without emotional bias, and recording exact spoken terms.
            </p>
          </div>

          <div className="card-tactile">
            <div className="card-tactile__icon" style={{ background: '#FEF3C7', color: '#D97706' }}>
              <FileCheck size={32} />
            </div>
            <h3>Verbatim Evidence Matrix</h3>
            <p>
              Every dollar, date, concession, and obligation is pinned word-for-word to an immutable evidence matrix with timestamps. The settlement contract can only reference claims explicitly spoken on record.
            </p>
          </div>

          <div className="card-tactile">
            <div className="card-tactile__icon" style={{ background: '#D1FAE5', color: '#059669' }}>
              <ShieldCheck size={32} />
            </div>
            <h3>Cryptographic Integrity Seal</h3>
            <p>
              The moment both parties digitally sign the agreement, a SHA-256 hash is stamped over the complete audio transcript and matrix, producing an unforgeable proof receipt admissible in court or escrow.
            </p>
          </div>
        </div>
      </section>

      {/* 3-Step Pipeline */}
      <section id="pipeline" style={{ background: 'var(--surface-alt)', borderTop: 'var(--border-width) solid var(--border)', borderBottom: 'var(--border-width) solid var(--border)', padding: '80px 0' }}>
        <div className="wrap">
          <div style={{ textAlign: 'center', maxWidth: 740, margin: '0 auto 50px' }}>
            <span className="pill pill--yellow" style={{ marginBottom: 14 }}>THE 3-STEP METHOD</span>
            <h2 style={{ fontSize: 'clamp(32px, 4vw, 44px)', marginBottom: 16 }}>
              From Heated Conflict to Sealed Accord
            </h2>
            <p style={{ fontSize: 18, color: 'var(--ink-muted)' }}>
              How real-time speech transforms an unstructured argument into an airtight, signed agreement in under 10 minutes.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 28
          }}>
            <div className="card-tactile" style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute',
                top: 20,
                right: 20,
                fontFamily: 'var(--font-head)',
                fontSize: 38,
                fontWeight: 800,
                color: 'var(--primary)',
                opacity: 0.25
              }}>
                01
              </div>
              <div className="card-tactile__icon" style={{ background: '#EDE9FE', color: 'var(--primary)' }}>
                <Mic size={30} />
              </div>
              <h3>Live Verbatim Ingestion</h3>
              <p>
                Both participants speak. High-precision streaming speech models transcribe in real time. Entities, numbers, and deadlines are parsed instantaneously and pinned into the case matrix.
              </p>
            </div>

            <div className="card-tactile" style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute',
                top: 20,
                right: 20,
                fontFamily: 'var(--font-head)',
                fontSize: 38,
                fontWeight: 800,
                color: '#D97706',
                opacity: 0.25
              }}>
                02
              </div>
              <div className="card-tactile__icon" style={{ background: '#FEF3C7', color: '#D97706' }}>
                <Cpu size={30} />
              </div>
              <h3>Gap Analysis &amp; Deliberation</h3>
              <p>
                Referee compares positions side by side, highlights points of tension, flags contradictions, and poses surgical clarifying questions to collapse the disagreement gap.
              </p>
            </div>

            <div className="card-tactile" style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute',
                top: 20,
                right: 20,
                fontFamily: 'var(--font-head)',
                fontSize: 38,
                fontWeight: 800,
                color: '#059669',
                opacity: 0.25
              }}>
                03
              </div>
              <div className="card-tactile__icon" style={{ background: '#D1FAE5', color: '#059669' }}>
                <ShieldCheck size={30} />
              </div>
              <h3>Bilateral Seal &amp; Proof</h3>
              <p>
                Referee generates a balanced memorandum strictly referencing verbatim quotes. Both parties sign digitally, generating a cryptographic SHA-256 seal and downloadable case dossier.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Mini Tester (Landing Page Sandbox) */}
      <section id="tester" className="wrap" style={{ paddingTop: 80, paddingBottom: 80 }}>
        <div style={{ textAlign: 'center', maxWidth: 740, margin: '0 auto 40px' }}>
          <span className="pill pill--green" style={{ marginBottom: 14 }}>LIVE EXTRACTION SANDBOX</span>
          <h2 style={{ fontSize: 'clamp(32px, 4vw, 44px)', marginBottom: 16 }}>
            Test Verbatim Entity Extraction Live
          </h2>
          <p style={{ fontSize: 18, color: 'var(--ink-muted)' }}>
            Speak into your microphone or try sample statements. Watch Referee extract financial commitments, timelines, and admissions instantly.
          </p>
        </div>

        <InteractiveMiniTester />
      </section>

      {/* Real-World Use Cases */}
      <section id="usecases" style={{ background: 'var(--surface-alt)', borderTop: 'var(--border-width) solid var(--border)', borderBottom: 'var(--border-width) solid var(--border)', padding: '80px 0' }}>
        <div className="wrap">
          <div style={{ textAlign: 'center', maxWidth: 740, margin: '0 auto 50px' }}>
            <span className="pill pill--purple" style={{ marginBottom: 14 }}>PRODUCTION APPLICATIONS</span>
            <h2 style={{ fontSize: 'clamp(32px, 4vw, 44px)', marginBottom: 16 }}>
              Where Referee Resolves High-Stakes Friction
            </h2>
            <p style={{ fontSize: 18, color: 'var(--ink-muted)' }}>
              Built for disputes where lawyers are too expensive, but trust has broken down completely.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 26
          }}>
            <div className="card-tactile">
              <div className="card-tactile__icon" style={{ background: '#EDE9FE', color: 'var(--primary)' }}>
                <Building size={28} />
              </div>
              <h3>Tenant &amp; Landlord</h3>
              <p>
                Security deposit returns, wear-and-tear vs property damage, maintenance obligations, move-out condition agreements.
              </p>
            </div>

            <div className="card-tactile">
              <div className="card-tactile__icon" style={{ background: '#FEF3C7', color: '#D97706' }}>
                <Briefcase size={28} />
              </div>
              <h3>Client &amp; Freelancer</h3>
              <p>
                Scope creep, milestone sign-offs, delayed invoice disbursements, revision limits, and copyright deliverable handovers.
              </p>
            </div>

            <div className="card-tactile">
              <div className="card-tactile__icon" style={{ background: '#D1FAE5', color: '#059669' }}>
                <ShoppingBag size={28} />
              </div>
              <h3>Buyer &amp; Marketplace Seller</h3>
              <p>
                Broken seals, item condition mismatches, partial refund settlements, return shipping costs, and dispute escalations.
              </p>
            </div>

            <div className="card-tactile">
              <div className="card-tactile__icon" style={{ background: '#FCE7F3', color: '#DB2777' }}>
                <Users size={28} />
              </div>
              <h3>Partners &amp; Co-founders</h3>
              <p>
                Asset division, project wind-downs, vendor contract terminations, and equity vesting reconciliation hearings.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Scorecard / Evaluation Matrix */}
      <section id="evaluation" className="wrap" style={{ paddingTop: 80, paddingBottom: 80 }}>
        <div style={{ textAlign: 'center', maxWidth: 740, margin: '0 auto 50px' }}>
          <span className="pill pill--yellow" style={{ marginBottom: 14 }}>BENCHMARKS &amp; SCORECARD</span>
          <h2 style={{ fontSize: 'clamp(32px, 4vw, 44px)', marginBottom: 16 }}>
            Adjudication &amp; Reliability Scorecard
          </h2>
          <p style={{ fontSize: 18, color: 'var(--ink-muted)' }}>
            Every aspect of Referee is measured against the highest standards of reliability, latency, and legal utility.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 26
        }}>
          <div className="card-tactile">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span className="pill pill--purple">Audio &amp; Speech</span>
              <span className="mono" style={{ fontWeight: 800 }}>&lt; 350ms</span>
            </div>
            <h3>Sub-Second Streaming</h3>
            <p>
              Powered by WebSocket streaming speech pipelines with native browser audio capture and automatic fallback.
            </p>
          </div>

          <div className="card-tactile">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span className="pill pill--yellow">Visuals &amp; Motion</span>
              <span className="mono" style={{ fontWeight: 800 }}>High Contrast</span>
            </div>
            <h3>Full-Motion Single-Screen Console</h3>
            <p>
              Bold borders, hard drop shadows, tactile audio feedback, live spectral analysis, dynamic disagreement meters, and bilateral digital signature pads.
            </p>
          </div>

          <div className="card-tactile">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span className="pill pill--green">Business Value</span>
              <span className="mono" style={{ fontWeight: 800 }}>$50B+ Market</span>
            </div>
            <h3>Alternative Dispute Resolution</h3>
            <p>
              Bypasses backlogged small-claims courts and expensive mediation fees. Reduces customer support chargebacks for marketplaces and property management platforms.
            </p>
          </div>

          <div className="card-tactile">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span className="pill pill--purple">Originality</span>
              <span className="mono" style={{ fontWeight: 800 }}>Novel Paradigm</span>
            </div>
            <h3>Triadic Mediation: Machine in the Middle</h3>
            <p>
              Instead of an AI chatbot talking to one user, Referee acts as an impartial adjudicator between two opposing human parties, ensuring equal airtime and mutual consensus.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="app-footer">
        <div className="app-footer__inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 'var(--radius-md)',
              background: 'var(--primary)',
              border: '2.5px solid var(--border)',
              boxShadow: '2.5px 2.5px 0px var(--shadow-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              fontFamily: 'var(--font-main)',
              fontWeight: 800,
              fontSize: 20
            }}>
              R
            </div>
            <div style={{ fontFamily: 'var(--font-main)', fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
              Ref<span style={{ color: 'var(--primary)' }}>eree</span>
            </div>
          </div>

          <button className="btn btn--primary" onClick={handleLaunch}>
            <span className="dot"></span>
            <span>Launch Mediation Console</span>
            <ArrowRight size={18} />
          </button>
        </div>

        <div style={{
          maxWidth: 1280,
          margin: '24px auto 0',
          borderTop: '3px dashed var(--border)',
          paddingTop: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          color: 'var(--ink-dim)'
        }}>
          <span>REFEREE · VERBATIM EVIDENCE DISPUTE RESOLUTION</span>
          <span>EVERY SPOKEN WORD ON THE RECORD · 2026</span>
        </div>
      </footer>
    </div>
  );
};
