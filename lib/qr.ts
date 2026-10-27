/**
 * Minimal QR Code generator (byte mode, error-correction level M, versions 1-10),
 * so the profile can show a scannable code without adding a dependency.
 * Output: a square boolean matrix (true = dark module). Throws if the text is too long (> 213 bytes).
 */

// ECC level M: [total codewords, EC codewords per block, [blocks, data codewords per block][]]
const VERSIONS: { total: number; ec: number; groups: [number, number][] }[] = [
  { total: 26, ec: 10, groups: [[1, 16]] },
  { total: 44, ec: 16, groups: [[1, 28]] },
  { total: 70, ec: 26, groups: [[1, 44]] },
  { total: 100, ec: 18, groups: [[2, 32]] },
  { total: 134, ec: 24, groups: [[2, 43]] },
  { total: 172, ec: 16, groups: [[4, 27]] },
  { total: 196, ec: 18, groups: [[4, 31]] },
  { total: 242, ec: 22, groups: [[2, 38], [2, 39]] },
  { total: 292, ec: 22, groups: [[3, 36], [2, 37]] },
  { total: 346, ec: 26, groups: [[4, 43], [1, 44]] },
];
const ALIGN: number[][] = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

// --- GF(256) / Reed-Solomon -------------------------------------------------
const EXP = new Array<number>(512);
const LOG = new Array<number>(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();
const mul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

function generator(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array<number>(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= mul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

function remainder(data: number[], degree: number): number[] {
  const gen = generator(degree);
  const rem = new Array<number>(degree).fill(0);
  for (const byte of data) {
    const factor = byte ^ rem.shift()!;
    rem.push(0);
    for (let i = 0; i < degree; i++) rem[i] ^= mul(gen[i + 1], factor);
  }
  return rem;
}

// --- Bit helpers ------------------------------------------------------------
function bchFormat(data: number): number {
  let v = data << 10;
  for (let i = 14; i >= 10; i--) if ((v >> i) & 1) v ^= 0x537 << (i - 10);
  return ((data << 10) | v) ^ 0x5412;
}
function bchVersion(version: number): number {
  let v = version << 12;
  for (let i = 17; i >= 12; i--) if ((v >> i) & 1) v ^= 0x1f25 << (i - 12);
  return (version << 12) | v;
}

const MASKS: ((r: number, c: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function penalty(m: boolean[][]): number {
  const n = m.length;
  let score = 0;
  const run = (line: boolean[]) => {
    let s = 0, count = 1;
    for (let i = 1; i <= line.length; i++) {
      if (i < line.length && line[i] === line[i - 1]) count++;
      else { if (count >= 5) s += 3 + (count - 5); count = 1; }
    }
    return s;
  };
  for (let i = 0; i < n; i++) {
    score += run(m[i]);
    score += run(m.map((row) => row[i]));
  }
  for (let r = 0; r < n - 1; r++)
    for (let c = 0; c < n - 1; c++) if (m[r][c] === m[r][c + 1] && m[r][c] === m[r + 1][c] && m[r][c] === m[r + 1][c + 1]) score += 3;
  const dark = m.reduce((t, row) => t + row.filter(Boolean).length, 0);
  score += Math.floor(Math.abs((dark * 100) / (n * n) - 50) / 5) * 10;
  return score;
}

export function qrMatrix(text: string): boolean[][] {
  const bytes = Array.from(new TextEncoder().encode(text));
  const vIndex = VERSIONS.findIndex((v) => {
    const dataWords = v.groups.reduce((t, [b, d]) => t + b * d, 0);
    const countBits = vIndexBits(VERSIONS.indexOf(v) + 1);
    return 4 + countBits + bytes.length * 8 <= dataWords * 8;
  });
  if (vIndex < 0) throw new Error("QR: text too long");
  const version = vIndex + 1;
  const spec = VERSIONS[vIndex];
  const dataWords = spec.groups.reduce((t, [b, d]) => t + b * d, 0);

  // Bit stream: mode (0100), length, data, terminator, padding.
  const bits: number[] = [];
  const push = (value: number, len: number) => { for (let i = len - 1; i >= 0; i--) bits.push((value >> i) & 1); };
  push(0b0100, 4);
  push(bytes.length, vIndexBits(version));
  bytes.forEach((b) => push(b, 8));
  push(0, Math.min(4, dataWords * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const words: number[] = [];
  for (let i = 0; i < bits.length; i += 8) words.push(parseInt(bits.slice(i, i + 8).join(""), 2));
  for (let pad = 0xec; words.length < dataWords; pad = pad === 0xec ? 0x11 : 0xec) words.push(pad);

  // Split into blocks, add EC, interleave.
  const blocks: { data: number[]; ec: number[] }[] = [];
  let offset = 0;
  spec.groups.forEach(([count, size]) => {
    for (let i = 0; i < count; i++) {
      const data = words.slice(offset, offset + size);
      offset += size;
      blocks.push({ data, ec: remainder(data, spec.ec) });
    }
  });
  const stream: number[] = [];
  const maxData = Math.max(...blocks.map((b) => b.data.length));
  for (let i = 0; i < maxData; i++) blocks.forEach((b) => { if (i < b.data.length) stream.push(b.data[i]); });
  for (let i = 0; i < spec.ec; i++) blocks.forEach((b) => stream.push(b.ec[i]));
  const payload: number[] = [];
  stream.forEach((w) => push2(payload, w));

  const size = 17 + version * 4;
  const modules: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const reserved: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const set = (r: number, c: number, dark: boolean) => { modules[r][c] = dark; reserved[r][c] = true; };

  // Finder patterns + separators.
  const finder = (r0: number, c0: number) => {
    for (let r = -1; r <= 7; r++)
      for (let c = -1; c <= 7; c++) {
        const rr = r0 + r, cc = c0 + c;
        if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
        const inRing = r >= 0 && r <= 6 && c >= 0 && c <= 6 && (r === 0 || r === 6 || c === 0 || c === 6);
        const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        set(rr, cc, inRing || inCore);
      }
  };
  finder(0, 0); finder(0, size - 7); finder(size - 7, 0);
  // Timing.
  for (let i = 8; i < size - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  // Alignment.
  const pos = ALIGN[vIndex];
  pos.forEach((r0) => pos.forEach((c0) => {
    const last = pos[pos.length - 1];
    if ((r0 === 6 && c0 === 6) || (r0 === 6 && c0 === last) || (r0 === last && c0 === 6)) return; // would overlap a finder
    for (let r = -2; r <= 2; r++) for (let c = -2; c <= 2; c++) set(r0 + r, c0 + c, Math.max(Math.abs(r), Math.abs(c)) !== 1);
  }));
  // Reserve format + version areas, dark module.
  for (let i = 0; i < 9; i++) { reserved[8][i] = true; reserved[i][8] = true; }
  for (let i = 0; i < 8; i++) { reserved[8][size - 1 - i] = true; reserved[size - 1 - i][8] = true; }
  set(size - 8, 8, true);
  if (version >= 7) for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) { reserved[i][size - 11 + j] = true; reserved[size - 11 + j][i] = true; }

  // Place data (zig-zag, right to left, skipping the vertical timing column).
  let bit = 0;
  const cells: [number, number][] = [];
  for (let right = size - 1, up = true; right >= 1; right -= 2, up = !up) {
    if (right === 6) right = 5;
    for (let i = 0; i < size; i++) {
      const r = up ? size - 1 - i : i;
      for (const c of [right, right - 1]) if (!reserved[r][c]) cells.push([r, c]);
    }
  }
  cells.forEach(([r, c]) => { modules[r][c] = bit < payload.length ? payload[bit] === 1 : false; bit++; });

  // Choose the best mask, then write format / version info.
  let best: boolean[][] | null = null, bestScore = Infinity, bestMask = 0;
  for (let mask = 0; mask < 8; mask++) {
    const trial = modules.map((row) => row.slice());
    cells.forEach(([r, c]) => { if (MASKS[mask](r, c)) trial[r][c] = !trial[r][c]; });
    writeFormat(trial, mask, size);
    const s = penalty(trial);
    if (s < bestScore) { bestScore = s; best = trial; bestMask = mask; }
  }
  const out = best!;
  writeFormat(out, bestMask, size);
  if (version >= 7) {
    const info = bchVersion(version);
    for (let i = 0; i < 18; i++) {
      const dark = ((info >> i) & 1) === 1;
      const a = Math.floor(i / 3), b = i % 3;
      out[a][size - 11 + b] = dark;
      out[size - 11 + b][a] = dark;
    }
  }
  return out;
}

function vIndexBits(version: number): number {
  return version <= 9 ? 8 : 16;
}
function push2(target: number[], word: number) {
  for (let i = 7; i >= 0; i--) target.push((word >> i) & 1);
}

function writeFormat(m: boolean[][], mask: number, size: number) {
  const f = bchFormat((0b00 << 3) | mask); // ECC level M = 00
  const bit = (i: number) => ((f >> i) & 1) === 1;
  for (let i = 0; i <= 5; i++) m[i][8] = bit(i);
  m[7][8] = bit(6);
  m[8][8] = bit(7);
  m[8][7] = bit(8);
  for (let i = 9; i < 15; i++) m[8][14 - i] = bit(i);
  for (let i = 0; i < 8; i++) m[8][size - 1 - i] = bit(i);
  for (let i = 8; i < 15; i++) m[size - 15 + i][8] = bit(i);
  m[size - 8][8] = true;
}
