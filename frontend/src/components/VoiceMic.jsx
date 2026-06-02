import { useEffect, useRef, useState } from "react";
import { Microphone, MicrophoneSlash } from "@phosphor-icons/react";
import { createRecognizer, isVoiceSupported, matchMove } from "@/lib/voice";
import { PLAY } from "@/constants/testIds";

export default function VoiceMic({ chessRef, onMove, disabled, hint }) {
  const [active, setActive] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const [ambiguous, setAmbiguous] = useState(null);
  const recRef = useRef(null);
  const supported = isVoiceSupported();

  const tryMove = (text) => {
    if (!chessRef.current) return;
    const m = matchMove(text, chessRef.current);
    if (!m) return;
    if (m.ambiguous) {
      setAmbiguous(m);
      setTranscript(`Ambiguous: which piece?`);
      setInterim("");
      return;
    }
    onMove(m);
    setTranscript(`✓ ${m.san}`);
    setInterim("");
    setAmbiguous(null);
  };

  const pickCandidate = (m) => {
    onMove(m);
    setTranscript(`✓ ${m.san}`);
    setAmbiguous(null);
  };

  const start = () => {
    if (!supported) return;
    setError("");
    setTranscript("");
    setInterim("");
    setAmbiguous(null);
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
        if (recRef.current === rec && active) {
          try { rec.start(); } catch (_) {}
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
      try { recRef.current.stop(); } catch (e) {}
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

      {ambiguous && (
        <div className="flex flex-col items-center gap-2 bg-zinc-900 border border-[#FCD34D]/40 rounded-2xl px-5 py-4 max-w-xs w-full">
          <p className="text-xs uppercase tracking-widest text-zinc-400">Which piece?</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {ambiguous.candidates.map((m) => (
              <button
                key={m.from + m.to}
                onClick={() => pickCandidate(m)}
                className="px-4 py-2 rounded-xl bg-zinc-800 border border-white/10 hover:border-[#FCD34D]/60 text-sm font-mono text-white transition-all"
              >
                {m.san}
                <span className="text-zinc-500 ml-1 text-xs">({m.from}→{m.to})</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => setAmbiguous(null)}
            className="text-xs text-zinc-500 hover:text-zinc-300 mt-1"
          >
            Cancel
          </button>
        </div>
      )}

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
