import { Link } from "react-router-dom";
import { Microphone, Crown, Lightning } from "@phosphor-icons/react";

export default function Landing() {
  return (
    <div className="relative overflow-hidden">
      <div
        className="absolute inset-0 -z-10 opacity-30 pointer-events-none"
        style={{
          backgroundImage:
            "url(https://static.prod-images.emergentagent.com/jobs/bc5b84a1-3068-43be-bd1d-ce4a7ef42009/images/cf16477431db348002b6a436d86ca76ad5c36fd9556246d490a4cd056fb7410b.png)",
          backgroundSize: "cover",
          backgroundPosition: "right center",
          maskImage: "linear-gradient(to right, black, transparent)",
          WebkitMaskImage: "linear-gradient(to right, black, transparent)",
        }}
      />
      <section className="max-w-7xl mx-auto px-6 sm:px-10 pt-20 sm:pt-32 pb-24">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.4em] text-[#FCD34D] mb-6 border border-[#FCD34D]/30 px-3 py-1 rounded-full">
            <Microphone size={14} weight="duotone" /> Voice-First Chess
          </div>
          <h1 className="font-display text-5xl sm:text-7xl lg:text-8xl leading-[0.95]">
            Play chess <br />
            <span className="text-[#FCD34D]">with your voice.</span>
          </h1>
          <p className="mt-8 text-lg sm:text-xl text-zinc-300 max-w-xl leading-relaxed">
            Lean back. Speak your moves. Battle eight Stockfish engines from
            <span className="font-mono text-[#FCD34D]"> 400</span> to
            <span className="font-mono text-[#FCD34D]"> 3200</span> Elo, challenge a friend
            across the table, or take on the world online.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link to="/register" className="btn-gold">Create account</Link>
            <Link to="/login" className="btn-ghost">I already have an account</Link>
          </div>
        </div>

        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: Microphone, title: "Hands-free", body: "Say \"Knight to F3\" — the board listens, reads, and moves." },
            { icon: Crown, title: "8 Engine Tiers", body: "From beginner to super-GM. Real Elo, real punishment." },
            { icon: Lightning, title: "Online & Local", body: "Pass-and-play across a table or matchmake in seconds." },
          ].map((f) => (
            <div key={f.title} className="glass rounded-3xl p-8">
              <f.icon size={36} weight="duotone" className="text-[#FCD34D] mb-4" />
              <div className="font-display text-2xl mb-2">{f.title}</div>
              <div className="text-zinc-400 leading-relaxed">{f.body}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
