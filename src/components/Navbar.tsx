import React, { useState } from 'react';
import { Sun, Moon, Settings, ArrowRight, Menu, X, Home, FileText, Activity } from 'lucide-react';
import { playTactileSound } from '../utils/audio';

interface NavbarProps {
  currentView: 'home' | 'console' | 'dashboard';
  onNavigate: (view: 'home' | 'console' | 'dashboard') => void;
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  isDark,
  onToggleTheme,
  onOpenSettings
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNav = (view: 'home' | 'console' | 'dashboard') => {
    playTactileSound('click');
    onNavigate(view);
    setMobileMenuOpen(false);
  };

  const handleSectionScroll = (id: string) => {
    playTactileSound('click');
    if (currentView !== 'home') {
      onNavigate('home');
      setTimeout(() => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
    setMobileMenuOpen(false);
  };

  return (
    <header style={{ position: 'sticky', top: 16, zIndex: 100, padding: '0 20px', marginBottom: 24 }}>
      <div style={{
        maxWidth: 1280,
        margin: '0 auto',
        background: 'var(--surface)',
        border: 'var(--border-width) solid var(--border)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-lg)',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16
      }}>
        {/* Brand */}
        <button
          onClick={() => handleNav('home')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}
        >
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
            fontSize: 20,
            transform: 'rotate(-2deg)'
          }}>
            R
          </div>
          <div style={{ fontFamily: 'var(--font-main)', fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
            Ref<span style={{ color: 'var(--primary)' }}>eree</span>
          </div>
        </button>

        {/* View Badges */}
        {currentView === 'console' && (
          <div className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="pill pill--purple mono" style={{ fontSize: 11.5, padding: '5px 14px' }}>
              <span className="dot" style={{ width: 8, height: 8 }}></span>
              <span>LIVE MEDIATION SESSION</span>
            </span>
          </div>
        )}

        {currentView === 'dashboard' && (
          <div className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="pill mono" style={{ fontSize: 11.5, padding: '5px 14px', background: 'var(--primary-subtle)', color: 'var(--primary)', borderColor: 'var(--primary)' }}>
              <FileText size={13} />
              <span>CASE DOCUMENT VAULT</span>
            </span>
          </div>
        )}

        {/* Desktop Links — HOMEPAGE ONLY */}
        {currentView === 'home' && (
          <nav style={{ display: 'flex', alignItems: 'center', gap: 6 }} className="hide-mobile">
            <button className="btn btn--sm btn--ghost" style={{ border: 'none', boxShadow: 'none' }} onClick={() => handleSectionScroll('principles')}>Principles</button>
            <button className="btn btn--sm btn--ghost" style={{ border: 'none', boxShadow: 'none' }} onClick={() => handleSectionScroll('pipeline')}>3-Step Method</button>
            <button className="btn btn--sm btn--ghost" style={{ border: 'none', boxShadow: 'none' }} onClick={() => handleSectionScroll('tester')}>Live Tester</button>
            <button className="btn btn--sm btn--ghost" style={{ border: 'none', boxShadow: 'none' }} onClick={() => handleSectionScroll('usecases')}>Use Cases</button>
            <button className="btn btn--sm btn--ghost" style={{ border: 'none', boxShadow: 'none' }} onClick={() => handleSectionScroll('evaluation')}>Scorecard</button>
          </nav>
        )}

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Vault / Dashboard Navigation Button (When not on dashboard) */}
          {currentView !== 'dashboard' && (
            <button
              className="btn btn--sm btn--secondary"
              onClick={() => handleNav('dashboard')}
              title="Open Case Documents Vault"
            >
              <FileText size={15} />
              <span className="hide-mobile">Document Vault</span>
            </button>
          )}

          {/* Theme Toggle */}
          <button
            className="theme-toggle"
            onClick={onToggleTheme}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle Theme"
          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          {/* Settings button — CONSOLE ONLY */}
          {currentView === 'console' && (
            <button
              className="btn btn--sm btn--ghost"
              onClick={onOpenSettings}
              title="Speech Engine API Keys"
            >
              <Settings size={16} />
              <span className="hide-mobile">Engine</span>
            </button>
          )}

          {/* Primary View Action Button */}
          {currentView === 'home' ? (
            <button
              className="btn btn--sm btn--primary"
              onClick={() => handleNav('console')}
            >
              <span className="dot"></span>
              <span>Open Console</span>
              <ArrowRight size={16} />
            </button>
          ) : currentView === 'console' ? (
            <button
              className="btn btn--sm btn--yellow"
              onClick={() => handleNav('home')}
            >
              <Home size={16} />
              <span className="hide-mobile">Home</span>
            </button>
          ) : (
            <>
              <button
                className="btn btn--sm btn--yellow"
                onClick={() => handleNav('home')}
              >
                <Home size={15} />
                <span className="hide-mobile">Home</span>
              </button>
              <button
                className="btn btn--sm btn--primary"
                onClick={() => handleNav('console')}
              >
                <span className="dot"></span>
                <span>Open Console</span>
                <ArrowRight size={15} />
              </button>
            </>
          )}

          {/* Mobile Menu Button */}
          <button
            className="btn btn--sm btn--ghost show-mobile"
            style={{ padding: '8px 12px' }}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Mobile Menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div style={{
          position: 'fixed',
          top: 86,
          left: 20,
          right: 20,
          background: 'var(--surface)',
          border: 'var(--border-width) solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-xl)',
          padding: 24,
          zIndex: 99,
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}>
          {currentView === 'home' && (
            <>
              <button className="btn btn--ghost" onClick={() => handleSectionScroll('principles')}>Principles</button>
              <button className="btn btn--ghost" onClick={() => handleSectionScroll('pipeline')}>3-Step Method</button>
              <button className="btn btn--ghost" onClick={() => handleSectionScroll('tester')}>Live Verbatim Tester</button>
              <button className="btn btn--ghost" onClick={() => handleSectionScroll('usecases')}>Real-World Use Cases</button>
              <button className="btn btn--ghost" onClick={() => handleSectionScroll('evaluation')}>Evaluation Criteria</button>
            </>
          )}

          <button className="btn btn--secondary" onClick={() => handleNav('dashboard')}>
            <FileText size={16} />
            <span>Case Document Vault</span>
          </button>

          <button className="btn btn--primary" onClick={() => handleNav('console')}>
            <span className="dot"></span>
            <span>Launch Live Console</span>
            <ArrowRight size={16} />
          </button>

          {currentView !== 'home' && (
            <button className="btn btn--yellow" onClick={() => handleNav('home')}>
              <Home size={16} />
              <span>Back to Home</span>
            </button>
          )}
        </div>
      )}
    </header>
  );
};
