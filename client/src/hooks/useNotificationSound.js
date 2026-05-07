import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const createBeepUrl = () => {
  const sampleRate = 44100;
  const duration = 0.35;
  const samples = Math.floor(sampleRate * duration);
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);

  const writeString = (offset, value) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples * 2, true);

  for (let i = 0; i < samples; i += 1) {
    const t = i / sampleRate;
    const envelope = Math.max(0, 1 - t / duration);
    const sample = Math.sin(2 * Math.PI * 880 * t) * envelope * 0.35;
    view.setInt16(44 + i * 2, sample * 32767, true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return `data:audio/wav;base64,${btoa(binary)}`;
};

export default function useNotificationSound() {
  const soundUrl = useMemo(createBeepUrl, []);
  const audioRef = useRef(null);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    const audio = new Audio(soundUrl);
    audio.preload = 'auto';
    audioRef.current = audio;
  }, [soundUrl]);

  useEffect(() => {
    const unlock = async () => {
      const audio = audioRef.current;
      if (!audio) return;

      try {
        audio.muted = true;
        await audio.play();
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
        setUnlocked(true);
        window.removeEventListener('click', unlock, true);
        window.removeEventListener('keydown', unlock, true);
        window.removeEventListener('touchstart', unlock, true);
      } catch {
        // Browser still blocked audio. Keep the UI quiet and try again later.
      }
    };

    window.addEventListener('click', unlock, true);
    window.addEventListener('keydown', unlock, true);
    window.addEventListener('touchstart', unlock, true);

    return () => {
      window.removeEventListener('click', unlock, true);
      window.removeEventListener('keydown', unlock, true);
      window.removeEventListener('touchstart', unlock, true);
    };
  }, []);

  return useCallback(() => {
    if (!unlocked || !audioRef.current) return;

    try {
      const audio = audioRef.current.cloneNode();
      audio.play().catch(() => {});
    } catch {
      // Notification sound is best-effort only.
    }
  }, [unlocked]);
}
