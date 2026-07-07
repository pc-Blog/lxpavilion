"use client";

import { useAudioPlayer } from "@/lib/useAudioPlayer";
import Tooltip from "@/app/_components/common/Tooltip";
import { assetUrl } from "@/lib/asset-url";
import { siteConfig } from "@/lib/siteConfig";

function fmt(sec: number) {
  if (!sec || isNaN(sec)) return "00:00";
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function MusicPlayer() {
  if (!siteConfig.featureMusic) {
    return (
      <div className="rounded-3xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl p-6 min-h-[220px] h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
        <div className="text-3xl mb-3">🎵</div>
        <p className="text-xs font-bold tracking-widest uppercase">Music Unavailable</p>
        <p className="text-[10px] mt-1">音乐播放器未启用</p>
      </div>
    );
  }

  const {
    currentTrack, isPlaying,
    progress, currentTime, duration, volume, isCoverSpinning,
    audioRef, progressRef,
    toggle, handleNext,
    handleVolumeChange, handleMuteToggle, handleSeek,
  } = useAudioPlayer();

  if (!currentTrack) {
    return (
      <div className="relative rounded-3xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl p-6 min-h-[220px] h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 overflow-hidden group">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
        <span className="text-xs font-bold tracking-widest uppercase animate-pulse">CONNECTING...</span>
      </div>
    );
  }

  return (
    <div className="relative rounded-3xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl p-5 sm:p-6 min-h-[220px] h-full flex flex-col justify-center transition-all duration-700 hover:scale-[1.01] group overflow-hidden">
      {isPlaying && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-indigo-500/15 dark:bg-indigo-500/20 blur-[50px] rounded-full pointer-events-none animate-pulse" />
      )}

      <div className="relative z-10 flex items-center gap-5 mb-4">
        <div key={currentTrack?.id}
             className={`relative w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 ${isCoverSpinning ? "animate-[spin_6s_linear_infinite]" : ""}`}
             style={{ animationPlayState: isCoverSpinning ? "running" : "paused" }}>
          <div className={`absolute -inset-1 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 transition-all duration-500 ${isPlaying ? "opacity-60 blur-[6px]" : "opacity-0"}`} />
          <div className="absolute -inset-0.5 rounded-full bg-gradient-to-tr from-indigo-400 to-purple-400 p-[2px]">
            <div className="w-full h-full rounded-full bg-slate-50 dark:bg-slate-900" />
          </div>
          <div className="absolute inset-[3px] rounded-full overflow-hidden shadow-inner">
            {currentTrack.pictureUrl ? (
              <img src={assetUrl(currentTrack.pictureUrl)} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-2xl">🎵</div>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0 relative z-10">
          <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded-md bg-indigo-500/80 text-white backdrop-blur-lg mb-2">Cloud Music</span>
          <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{currentTrack.title}</h3>
        </div>
      </div>

      <div className="relative z-10 flex items-center gap-2 mb-3">
        <span className="text-[11px] text-slate-500 dark:text-slate-400 w-10 text-right tabular-nums font-mono">{fmt(currentTime)}</span>
        <div className="flex-1 relative group/seek">
          <input ref={progressRef} type="range" min={0} max={100} value={progress} onChange={handleSeek}
            className="w-full h-1.5 appearance-none bg-slate-200 dark:bg-slate-700 rounded-full cursor-pointer group-hover/seek:h-2 transition-all duration-200"
            style={{ background: `linear-gradient(to right, #818cf8 ${progress}%, rgba(148,163,184,0.4) ${progress}%)` }} />
          <style jsx>{`
            input[type="range"]::-webkit-slider-thumb { appearance: none; width: 12px; height: 12px; background: #818cf8; border-radius: 50%; cursor: pointer; transition: all 0.2s; box-shadow: 0 0 6px rgba(129,140,248,0.5); }
            input[type="range"]::-webkit-slider-thumb:hover { transform: scale(1.3); background: #6366f1; }
            input[type="range"]::-moz-range-thumb { width: 12px; height: 12px; background: #818cf8; border-radius: 50%; cursor: pointer; border: none; }
          `}</style>
        </div>
        <span className="text-[11px] text-slate-500 dark:text-slate-400 w-10 tabular-nums font-mono">{fmt(duration)}</span>
      </div>

      <div className="relative z-10 flex items-center justify-between gap-2">
        <div className="flex items-center gap-4">
          <button onClick={(e) => { e.stopPropagation(); e.preventDefault(); toggle(); }}
            className="w-12 h-12 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white flex items-center justify-center text-xl transition-all duration-300 hover:scale-110 shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:shadow-xl">
            {isPlaying ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>
            ) : (
              <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            )}
          </button>
          <Tooltip text="Random next">
            <button onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleNext(); }}
              className="w-10 h-10 rounded-full text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:scale-110 transition-all duration-300 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
          </button>
          </Tooltip>
        </div>

        <div className="flex items-center gap-1.5 group/vol">
          <Tooltip text={volume === 0 ? "Unmute" : "Mute"}>
            <button onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleMuteToggle(); }}
              className="w-8 h-8 rounded-full text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-all duration-200 flex items-center justify-center">
            {volume === 0 ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 8.5v7a4.47 4.47 0 002.5-3.5zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /><line x1="3" y1="4" x2="21" y2="20" stroke="currentColor" strokeWidth="2" /></svg>
            ) : volume < 0.4 ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm10 3.5A2.5 2.5 0 0011.5 10v4a2.5 2.5 0 001.5-1.5z" /></svg>
            ) : volume < 0.7 ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm11 3a3 3 0 00-3-3v6a3 3 0 003-3z" /></svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 8.5v7a4.47 4.47 0 002.5-3.5z" /><path d="M14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /></svg>
            )}
          </button>
          </Tooltip>
          <input type="range" min={0} max={100} value={volume * 100} onChange={handleVolumeChange}
            className="w-20 h-1 appearance-none bg-slate-200 dark:bg-slate-700 rounded-full cursor-pointer hover:h-1.5 transition-all duration-200"
            style={{ background: `linear-gradient(to right, #818cf8 ${volume * 100}%, rgba(148,163,184,0.4) ${volume * 100}%)` }} />
        </div>
      </div>
    </div>
  );
}
