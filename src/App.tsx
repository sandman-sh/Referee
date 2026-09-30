import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Homepage } from './views/Homepage';
import { MediationConsole } from './views/MediationConsole';
import { DocumentDashboard } from './views/DocumentDashboard';
import { SettingsModal } from './components/SettingsModal';
import { playTactileSound } from './utils/audio';
import { SpeakerRole } from './types';

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'home' | 'console' | 'dashboard'>('home');
  const [isDark, setIsDark] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [activeRoomId, setActiveRoomId] = useState<string | undefined>(undefined);
  const [activeRole, setActiveRole] = useState<SpeakerRole | undefined>(undefined);

  useEffect(() => {
    // Check URL parameters for direct room entry
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    const roleParam = params.get('role') as SpeakerRole | null;

    if (roomParam) {
      setActiveRoomId(roomParam);
      if (roleParam && ['a', 'b', 'ref'].includes(roleParam)) {
        setActiveRole(roleParam);
      }
      setCurrentView('console');
    }

    const savedTheme = localStorage.getItem('referee_theme_pref');
    if (savedTheme === 'dark') {
      setIsDark(true);
      document.body.classList.add('dark-mode');
    } else {
      setIsDark(false);
      document.body.classList.remove('dark-mode');
    }
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.body.classList.add('dark-mode');
      localStorage.setItem('referee_theme_pref', 'dark');
    } else {
      document.body.classList.remove('dark-mode');
      localStorage.setItem('referee_theme_pref', 'light');
    }
    playTactileSound('toggle');
  };

  const handleSaveApiKey = (key: string) => {
    if (key) {
      localStorage.setItem('assemblyai_api_key_referee', key);
    } else {
      localStorage.removeItem('assemblyai_api_key_referee');
    }
  };

  const handleOpenRoomFromDashboard = (roomId: string, role?: SpeakerRole) => {
    setActiveRoomId(roomId);
    if (role) setActiveRole(role);
    setCurrentView('console');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        currentView={currentView}
        onNavigate={(view) => setCurrentView(view)}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <main style={{ flex: 1 }}>
        {currentView === 'home' && (
          <Homepage 
            onLaunchConsole={() => setCurrentView('console')} 
          />
        )}

        {currentView === 'dashboard' && (
          <DocumentDashboard
            onOpenRoom={handleOpenRoomFromDashboard}
            onBackToHome={() => setCurrentView('home')}
          />
        )}

        {currentView === 'console' && (
          <MediationConsole 
            initialRoomId={activeRoomId}
            initialRole={activeRole}
            onOpenDashboard={() => setCurrentView('dashboard')}
          />
        )}
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaveKey={handleSaveApiKey}
      />
    </div>
  );
};

export default App;
