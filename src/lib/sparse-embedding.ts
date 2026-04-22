const VOCAB_SIZE = 30000;

function hash(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
    h = h >>> 0; // unsigned 32-bit
  }
  return h % VOCAB_SIZE;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^가-힣ᄀ-ᇿ㄰-㆏a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);
}

export function computeSparseVector(text: string): { indices: number[]; values: number[] } {
  const tokens = tokenize(text);
  if (tokens.length === 0) return { indices: [], values: [] };

  const freq = new Map<number, number>();
  for (const token of tokens) {
    const idx = hash(token);
    freq.set(idx, (freq.get(idx) ?? 0) + 1);
  }

  const indices: number[] = [];
  const values: number[] = [];
  for (const [idx, count] of freq) {
    indices.push(idx);
    values.push(count / tokens.length);
  }

  return { indices, values };
}
