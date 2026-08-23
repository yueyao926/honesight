import { useEffect, useRef } from "react";
import bgmUrl from "../BGM/bgm.mp3";

const VOLUME = 0.32;

export default function BackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(bgmUrl);
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = VOLUME;
    audioRef.current = audio;

    const tryPlay = () => {
      if (document.hidden) return;
      void audio.play().catch(() => undefined);
    };

    const unlock = () => {
      tryPlay();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };

    const onVisibility = () => {
      if (document.hidden) {
        audio.pause();
        return;
      }
      tryPlay();
    };

    tryPlay();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      document.removeEventListener("visibilitychange", onVisibility);
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
  }, []);

  return null;
}
