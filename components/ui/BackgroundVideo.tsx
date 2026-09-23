"use client";

import { useRef, useState } from "react";
import { PauseIcon, PlayIcon } from "./Icons";

type BackgroundVideoProps = {
  src: string;
  poster: string;
  pauseLabel: string;
  playLabel: string;
};

// Muted, looping background video with a pause/play button (bottom-right).
export default function BackgroundVideo({
  src,
  poster,
  pauseLabel,
  playLabel,
}: BackgroundVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);

  function toggle() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        poster={poster}
        className="absolute inset-0 h-full w-full object-cover"
      >
        <source src={src} type="video/webm" />
      </video>
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? pauseLabel : playLabel}
        className={`absolute bottom-4 right-4 flex h-8 w-8 items-center justify-center rounded-pill border border-brand-purple/16 shadow-button backdrop-blur-[8px] transition-colors md:bottom-6 md:right-6 md:h-[34px] md:w-[38px] ${
          playing ? "bg-brand-purple/8 text-paper" : "bg-paper text-brand-purple"
        }`}
      >
        {playing ? <PauseIcon className="h-3 w-3" /> : <PlayIcon className="h-3 w-3" />}
      </button>
    </div>
  );
}
