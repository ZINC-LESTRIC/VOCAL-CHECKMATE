/**
 * Stockfish engine wrapper.
 *
 * Loads Stockfish.js from a CDN inside a Web Worker so it works inside CRA
 * without any bundler config. Each level has its own Elo/skill/depth settings.
 */

const STOCKFISH_CDN = "https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js";

const LEVEL_CONFIG = {
  1: { elo: 400,  skill: 0,  depth: 1,  movetime: 50,   useElo: false },
  2: { elo: 800,  skill: 3,  depth: 2,  movetime: 100,  useElo: false },
  3: { elo: 1200, skill: 6,  depth: 4,  movetime: 200,  useElo: false },
  4: { elo: 1600, skill: 10, depth: 6,  movetime: 400,  useElo: true  },
  5: { elo: 2000, skill: 14, depth: 8,  movetime: 600,  useElo: true  },
  6: { elo: 2400, skill: 17, depth: 12, movetime: 900,  useElo: true  },
  7: { elo: 2800, skill: 19, depth: 16, movetime: 1500, useElo: true  },
  8: { elo: 3200, skill: 20, depth: 22, movetime: 2500, useElo: false }, // full strength
};

export const LEVELS = Object.entries(LEVEL_CONFIG).map(([k, v]) => ({
  level: Number(k),
  elo: v.elo,
}));

export class StockfishEngine {
  constructor() {
    const blobSrc = `importScripts('${STOCKFISH_CDN}');`;
    const url = URL.createObjectURL(new Blob([blobSrc], { type: "application/javascript" }));
    this.worker = new Worker(url);
    this.listeners = new Set();
    this.ready = new Promise((resolve) => {
      const onMsg = (e) => {
        const line = typeof e.data === "string" ? e.data : "";
        if (line === "uciok" || line.startsWith("uciok")) {
          this.worker.postMessage("isready");
        }
        if (line === "readyok") {
          this.worker.removeEventListener("message", onMsg);
          resolve();
        }
      };
      this.worker.addEventListener("message", onMsg);
    });
    this.worker.addEventListener("message", (e) => {
      const line = typeof e.data === "string" ? e.data : "";
      for (const fn of this.listeners) fn(line);
    });
    this.worker.postMessage("uci");
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  send(cmd) { this.worker.postMessage(cmd); }

  async configure(level) {
    await this.ready;
    const cfg = LEVEL_CONFIG[level] || LEVEL_CONFIG[4];
    this.cfg = cfg;
    this.send(`setoption name Skill Level value ${cfg.skill}`);
    if (cfg.useElo) {
      this.send("setoption name UCI_LimitStrength value true");
      this.send(`setoption name UCI_Elo value ${cfg.elo}`);
    } else {
      this.send("setoption name UCI_LimitStrength value false");
    }
    this.send("ucinewgame");
    this.send("isready");
  }

  /**
   * Ask the engine for the best move given a fen.
   * Resolves with { from, to, promotion } in algebraic squares.
   */
  bestMove(fen) {
    const cfg = this.cfg || LEVEL_CONFIG[4];
    return new Promise((resolve) => {
      const off = this.on((line) => {
        if (line.startsWith("bestmove")) {
          off();
          const parts = line.split(/\s+/);
          const mv = parts[1] || "";
          if (!mv || mv === "(none)") {
            resolve(null);
            return;
          }
          const from = mv.slice(0, 2);
          const to = mv.slice(2, 4);
          const promotion = mv.length > 4 ? mv[4] : undefined;
          resolve({ from, to, promotion });
        }
      });
      this.send(`position fen ${fen}`);
      this.send(`go depth ${cfg.depth} movetime ${cfg.movetime}`);
    });
  }

  destroy() {
    try { this.worker.terminate(); } catch (e) { /* noop */ }
  }
}

/**
 * Lightweight analyzer — independent of the game engine config.
 * Always uses full-strength Stockfish for objective evaluation.
 */
export class StockfishAnalyzer {
  constructor() {
    const blobSrc = `importScripts('${STOCKFISH_CDN}');`;
    const url = URL.createObjectURL(new Blob([blobSrc], { type: "application/javascript" }));
    this.worker = new Worker(url);
    this.listeners = new Set();
    this.busy = false;
    this.ready = new Promise((resolve) => {
      const onMsg = (e) => {
        const line = typeof e.data === "string" ? e.data : "";
        if (line.startsWith("uciok")) this.worker.postMessage("isready");
        if (line === "readyok") {
          this.worker.removeEventListener("message", onMsg);
          this.worker.postMessage("setoption name UCI_LimitStrength value false");
          this.worker.postMessage("setoption name Skill Level value 20");
          resolve();
        }
      };
      this.worker.addEventListener("message", onMsg);
    });
    this.worker.addEventListener("message", (e) => {
      const line = typeof e.data === "string" ? e.data : "";
      for (const fn of this.listeners) fn(line);
    });
    this.worker.postMessage("uci");
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  /**
   * Evaluate the position. Always returns the eval from WHITE's perspective.
   * { cp?: number, mate?: number, bestMove?: { from, to, promotion } }
   */
  async evaluate(fen, depth = 14) {
    await this.ready;
    // chess.js fen has side-to-move as field index 1
    const sideToMove = fen.split(" ")[1] === "w" ? 1 : -1;

    // Cancel any in-flight search
    if (this.busy) this.worker.postMessage("stop");

    return new Promise((resolve) => {
      let lastCp = null;
      let lastMate = null;
      const off = this.on((line) => {
        if (line.startsWith("info ")) {
          const cpMatch = line.match(/score cp (-?\d+)/);
          const mateMatch = line.match(/score mate (-?\d+)/);
          if (mateMatch) {
            const m = parseInt(mateMatch[1], 10);
            lastMate = m * sideToMove;
            lastCp = null;
          } else if (cpMatch) {
            const cp = parseInt(cpMatch[1], 10);
            lastCp = cp * sideToMove;
          }
        } else if (line.startsWith("bestmove")) {
          off();
          this.busy = false;
          const parts = line.split(/\s+/);
          const mv = parts[1] || "";
          let bestMove = null;
          if (mv && mv !== "(none)") {
            bestMove = {
              from: mv.slice(0, 2),
              to: mv.slice(2, 4),
              promotion: mv.length > 4 ? mv[4] : undefined,
            };
          }
          resolve({ cp: lastCp, mate: lastMate, bestMove });
        }
      });
      this.busy = true;
      this.worker.postMessage(`position fen ${fen}`);
      this.worker.postMessage(`go depth ${depth}`);
    });
  }

  destroy() {
    try { this.worker.postMessage("stop"); this.worker.terminate(); } catch (e) { /* noop */ }
  }
}
