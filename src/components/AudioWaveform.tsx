import React, { useRef, useEffect } from 'react';

interface AudioWaveformProps {
  mediaStream: MediaStream | null;
  isActive: boolean;
  activeSpeaker?: 'a' | 'b' | 'ref';
  height?: number;
  barsCount?: number;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  mediaStream,
  isActive,
  activeSpeaker = 'a',
  height = 64,
  barsCount = 48
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;

    if (isActive && mediaStream) {
      try {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtx = new AudioContextClass();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        source = audioCtx.createMediaStreamSource(mediaStream);
        source.connect(analyser);
      } catch (err) {
        console.warn('Analyser init error:', err);
      }
    }

    const dataArray = new Uint8Array(barsCount);
    let phase = 0;

    const render = () => {
      animationId = requestAnimationFrame(render);

      const dpr = window.devicePixelRatio || 1;
      const w = canvas.offsetWidth * dpr;
      const h = height * dpr;

      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      ctx.clearRect(0, 0, w, h);

      if (isActive && analyser) {
        analyser.getByteFrequencyData(dataArray);
      } else {
        // Dual-harmonic ambient animation
        phase += 0.04;
        for (let i = 0; i < barsCount; i++) {
          const norm = i / barsCount;
          const waveA = Math.sin(norm * 8 + phase) * 0.45 + 0.5;
          const waveB = Math.cos(norm * 12 - phase * 1.3) * 0.4 + 0.5;
          dataArray[i] = Math.max(12, Math.floor(((waveA + waveB) * 0.5) * 160));
        }
      }

      const barWidth = w / barsCount;
      const isDark = document.body.classList.contains('dark-mode');

      for (let i = 0; i < barsCount; i++) {
        const val = dataArray[i];
        const barH = Math.max(4 * dpr, (val / 255) * (h * 0.85));
        const x = i * barWidth;
        const y = h - barH;

        if (activeSpeaker === 'a') {
          ctx.fillStyle = isDark ? '#A78BFA' : '#7C3AED';
        } else if (activeSpeaker === 'b') {
          ctx.fillStyle = isDark ? '#FBBF24' : '#D97706';
        } else {
          ctx.fillStyle = '#10B981';
        }

        ctx.fillRect(x + 1 * dpr, y, Math.max(2 * dpr, barWidth - 2 * dpr), barH);
        ctx.strokeStyle = isDark ? '#000000' : '#110E1B';
        ctx.lineWidth = 1.2 * dpr;
        ctx.strokeRect(x + 1 * dpr, y, Math.max(2 * dpr, barWidth - 2 * dpr), barH);
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
      if (source) source.disconnect();
      if (audioCtx && audioCtx.state !== 'closed') audioCtx.close().catch(() => {});
    };
  }, [mediaStream, isActive, activeSpeaker, height, barsCount]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: height,
        display: 'block',
        borderRadius: 'var(--radius-sm)'
      }}
    />
  );
};
