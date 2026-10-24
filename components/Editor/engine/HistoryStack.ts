export interface HistoryEntry { readonly html: string; readonly selStart: number; readonly selEnd: number }

/** Memento-style undo/redo over whole-document snapshots (bounded, deduplicated). */
export class HistoryStack {
  private stack: HistoryEntry[] = [];
  private index = -1;
  constructor(private readonly limit = 150) {}

  reset(entry: HistoryEntry): void { this.stack = [entry]; this.index = 0; }
  get current(): HistoryEntry | undefined { return this.stack[this.index]; }

  push(entry: HistoryEntry): boolean {
    if (this.current && this.current.html === entry.html) return false;
    this.stack = this.stack.slice(0, this.index + 1);
    this.stack.push(entry);
    if (this.stack.length > this.limit) this.stack.shift();
    this.index = this.stack.length - 1;
    return true;
  }
  get canUndo(): boolean { return this.index > 0; }
  get canRedo(): boolean { return this.index < this.stack.length - 1; }
  undo(): HistoryEntry | null { return this.canUndo ? this.stack[--this.index] : null; }
  redo(): HistoryEntry | null { return this.canRedo ? this.stack[++this.index] : null; }
}
