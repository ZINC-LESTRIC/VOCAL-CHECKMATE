/**
 * Voice control:
 *  - Uses Web Speech API (Chrome/Edge/Safari with recognition).
 *  - Parses algebraic chess moves out of the transcript and matches them
 *    against the current chess.js position.
 */

const FILE_WORDS = {
  alpha: "a", apple: "a", a: "a", ay: "a",
  bravo: "b", b: "b", bee: "b", be: "b",
  charlie: "c", c: "c", see: "c", sea: "c",
  delta: "d", d: "d", dee: "d",
  echo: "e", e: "e", ee: "e",
  foxtrot: "f", f: "f", ef: "f", eff: "f",
  golf: "g", g: "g", gee: "g",
  hotel: "h", h: "h", aitch: "h", age: "h",
};

const PIECE_WORDS = {
  king: "K", k: "K",
  queen: "Q", q: "Q",
  rook: "R", r: "R", castle: "R",
  bishop: "B", b: "B",
  knight: "N", n: "N", horse: "N",
  pawn: "P", p: "P",
};

const NUMBER_WORDS = {
  one: "1", won: "1", to: "2", too: "2", two: "2", tu: "2",
  three: "3", tree: "3", four: "4", for: "4", fore: "4",
  five: "5", six: "6", sex: "6", seven: "7", eight: "8", ate: "8",
};

export function isVoiceSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function createRecognizer({ onResult, onError, onEnd } = {}) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const rec = new SR();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = "en-US";
  rec.onresult = (ev) => {
    let interim = "";
    let final = "";
    for (let i = ev.resultIndex; i < ev.results.length; i += 1) {
      const r = ev.results[i];
      if (r.isFinal) final += r[0].transcript + " ";
      else interim += r[0].transcript + " ";
    }
    onResult && onResult({ final: final.trim(), interim: interim.trim() });
  };
  rec.onerror = (ev) => onError && onError(ev.error || "unknown");
  rec.onend = () => onEnd && onEnd();
  return rec;
}

/**
 * Normalize a spoken phrase to something close to algebraic notation.
 */
function normalize(raw) {
  let s = (raw || "").toLowerCase().trim();
  s = s.replace(/[.,!?]/g, "");
  // common substitutions
  s = s.replace(/\bcastle(s)? king(side)?\b/g, "O-O");
  s = s.replace(/\bcastle(s)? queen(side)?\b/g, "O-O-O");
  s = s.replace(/\bshort castle(s)?\b/g, "O-O");
  s = s.replace(/\blong castle(s)?\b/g, "O-O-O");
  s = s.replace(/\btake(s)?\b/g, "x");
  s = s.replace(/\bcapture(s)?\b/g, "x");
  s = s.replace(/\bto\b/g, " ");
  s = s.replace(/\bcheckmate\b/g, "#");
  s = s.replace(/\bcheck\b/g, "+");
  s = s.replace(/\bpromote(s)? to\b/g, "=");
  s = s.replace(/\bequals?\b/g, "=");
  // tokenize and map words
  const tokens = s.split(/\s+/).filter(Boolean).map((t) => {
    if (PIECE_WORDS[t]) return PIECE_WORDS[t];
    if (FILE_WORDS[t]) return FILE_WORDS[t];
    if (NUMBER_WORDS[t]) return NUMBER_WORDS[t];
    return t;
  });
  return tokens.join("");
}

/**
 * Try to match the spoken phrase to a legal move from chess.js.
 * Returns the chosen move object {from, to, san, promotion} or null.
 */
export function matchMove(phrase, chess) {
  if (!phrase || !chess) return null;
  const normalized = normalize(phrase);
  if (!normalized) return null;

  const legal = chess.moves({ verbose: true });

  // Direct SAN match (strip + and #)
  const tryDirect = (s) => {
    const cleaned = s.replace(/[+#]/g, "");
    for (const m of legal) {
      const san = m.san.replace(/[+#]/g, "");
      if (san.toLowerCase() === cleaned.toLowerCase()) return m;
    }
    return null;
  };

  // 1. Try whole normalized string
  let m = tryDirect(normalized);
  if (m) return m;

  // 2. Castling
  if (/(o-o-o|0-0-0|ooo)/i.test(normalized)) {
    const c = legal.find((mm) => mm.san === "O-O-O");
    if (c) return c;
  }
  if (/(o-o|0-0|oo)\b/i.test(normalized) || normalized === "oo") {
    const c = legal.find((mm) => mm.san === "O-O");
    if (c) return c;
  }

  // 3. Search for any [a-h][1-8] pair in the string and match by destination.
  const squares = normalized.match(/[a-h][1-8]/g) || [];
  if (squares.length >= 1) {
    const dest = squares[squares.length - 1];
    const src = squares.length >= 2 ? squares[0] : null;
    // detect piece letter
    const pieceMatch = normalized.match(/[KQRBN]/);
    const piece = pieceMatch ? pieceMatch[0].toLowerCase() : null;
    const promoMatch = normalized.match(/=([qrbn])/i);
    const promo = promoMatch ? promoMatch[1].toLowerCase() : null;

    const candidates = legal.filter((mm) => {
      if (mm.to !== dest) return false;
      if (src && mm.from !== src) return false;
      if (piece && mm.piece !== piece) return false;
      if (promo && mm.promotion !== promo) return false;
      return true;
    });
    if (candidates.length === 1) return candidates[0];
    if (candidates.length > 1) {
      // ambiguous; prefer non-pawn if piece specified
      return candidates[0];
    }
  }

  // 4. SAN-like cleanups (e.g., "Nf3" without explicit destination prefix)
  const sanMatch = normalized.match(/([KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?)/i);
  if (sanMatch) {
    m = tryDirect(sanMatch[1]);
    if (m) return m;
  }
  return null;
}
