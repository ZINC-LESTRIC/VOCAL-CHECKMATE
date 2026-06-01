import { useEffect, useRef, useState } from "react";
import { Microphone, MicrophoneSlash } from "@phosphor-icons/react";
import { createRecognizer, isVoiceSupported, matchMove } from "@/lib/voice";
import { PLAY } from "@/constants/testIds";

/**
 * Floating voice-control pill.
 *  - Tap to start listening; speak moves like "knight to f3" or "Nf3".
 *  - Shows interim + final transcript large enough to read from a distance.
 */
export default function VoiceMic({ chessRef, onMove, disabled, hint }) {
  const [active, setActive] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const recRef = useRef(null);
  const supported = isVoiceSupported();

  const tryMove = (text) => {
    if (!chessRef.current) return;
    const m = matchMove(text, chessRef.current);
    if (m) {
      onMove(m);
      setTranscript(`✓ ${m.san}`);
      setInterim("");
    }
  };

  const start = () => {
    if (!supported) return;
    setError("");
    setTranscript("");
    setInterim("");
    const rec = createRecognizer({
      onResult: ({ final, interim: it }) => {
        if (final) {
          setTranscript(final);
          tryMove(final);
        }
        if (it) {
          setInterim(it);
          tryMove(it);
        }
      },
      onError: (e) => setError(String(e)),
      onEnd: () => {
        // auto-restart while active
        if (recRef.current === rec && active) {
          try { rec.start(); } catch (_) { /* ignore */ }
        }
      },
    });
    if (!rec) {
      setError("Speech recognition not available");
      return;
    }
    recRef.current = rec;
    try {
      rec.start();
      setActive(true);
    } catch (e) {
      setError("Microphone permission required");
    }
  };

  const stop = () => {
    setActive(false);
    if (recRef.current) {
      try { recRef.current.stop(); } catch (e) { /* ignore */ }
      recRef.current = null;
    }
  };

  useEffect(() => () => stop(), []);

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        data-testid={PLAY.voiceMic}
        onClick={active ? stop : start}
        disabled={disabled || !supported}
        className={`relative rounded-full p-5 border transition-all ${
          active
            ? "bg-[#ef4444] border-red-300/30 pulse-red"
            : "bg-zinc-900 border-white/10 hover:border-[#FCD34D]/60"
        } ${disabled || !supported ? "opacity-40 cursor-not-allowed" : ""}`}
        title={supported ? "Toggle voice control" : "Not supported in this browser"}
      >
        {active ? <Microphone size={28} weight="fill" /> : <MicrophoneSlash size={28} weight="duotone" />}
      </button>
      <div
        data-testid={PLAY.voiceTranscript}
        className="text-center min-h-[3.5rem] max-w-md font-mono text-lg sm:text-2xl tracking-wide"
      >
        {error ? (
          <span className="text-red-400 text-sm">{error}</span>
        ) : transcript ? (
          <span className="text-[#FCD34D]">{transcript}</span>
        ) : interim ? (
          <span className="text-white/60 italic">{interim}</span>
        ) : (
          <span className="text-white/40 text-sm uppercase tracking-[0.3em]">
            {active ? "Listening…" : hint || "Tap to speak a move"}
          </span>
        )}
      </div>
    </div>
  );
}
