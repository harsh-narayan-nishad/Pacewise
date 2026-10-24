type Cell = HTMLTableCellElement;

/**
 * Table structure operations over a real <table>. A table with
 * colspan/rowspan is not a simple matrix, so every operation first builds a
 * "grid": grid[r][c] = the cell that OCCUPIES that slot (a spanning cell
 * appears in several slots). All index maths goes through the grid.
 */
export class TableOps {
  static build(table: HTMLTableElement): Cell[][] {
    const grid: Cell[][] = [];
    Array.from(table.rows).forEach((tr, r) => {
      grid[r] = grid[r] ?? [];
      let c = 0;
      for (const cell of Array.from(tr.cells)) {
        while (grid[r][c]) c += 1;
        for (let dr = 0; dr < cell.rowSpan; dr += 1) {
          for (let dc = 0; dc < cell.colSpan; dc += 1) {
            grid[r + dr] = grid[r + dr] ?? [];
            grid[r + dr][c + dc] = cell;
          }
        }
        c += cell.colSpan;
      }
    });
    return grid;
  }

  static position(grid: Cell[][], cell: Cell): { r: number; c: number } | null {
    for (let r = 0; r < grid.length; r += 1) {
      const c = grid[r].indexOf(cell);
      if (c >= 0) return { r, c };
    }
    return null;
  }

  static create(rows: number, cols: number, header: boolean): string {
    const r = Math.min(30, Math.max(1, rows));
    const c = Math.min(12, Math.max(1, cols));
    const row = (tag: string) => `<tr>${`<${tag}><br></${tag}>`.repeat(c)}</tr>`;
    return `<table class="sr-table"><tbody>${header ? row("th") : ""}${Array.from({ length: r - (header ? 1 : 0) }, () => row("td")).join("")}</tbody></table><p><br></p>`;
  }

  private static blank(like: Cell): Cell {
    const c = document.createElement(like.tagName.toLowerCase() === "th" ? "th" : "td") as Cell;
    c.innerHTML = "<br>";
    return c;
  }

  static addRow(table: HTMLTableElement, cell: Cell, below: boolean): void {
    const grid = this.build(table);
    const pos = this.position(grid, cell);
    if (!pos) return;
    const t = below ? pos.r + cell.rowSpan - 1 : pos.r;
    const tr = document.createElement("tr");
    const seen = new Set<Cell>();
    for (const slot of grid[t]) {
      if (!slot || seen.has(slot)) continue;
      seen.add(slot);
      const startRow = grid.findIndex((row) => row.includes(slot));
      const crosses = below ? startRow + slot.rowSpan - 1 > t : startRow < t;
      if (crosses) { slot.rowSpan += 1; continue; }
      const nc = document.createElement("td") as Cell;
      nc.innerHTML = "<br>";
      if (slot.colSpan > 1) nc.colSpan = slot.colSpan;
      tr.appendChild(nc);
    }
    const ref = table.rows[t];
    ref.parentNode?.insertBefore(tr, below ? ref.nextSibling : ref);
  }

  static addColumn(table: HTMLTableElement, cell: Cell, after: boolean): void {
    const grid = this.build(table);
    const pos = this.position(grid, cell);
    if (!pos) return;
    const col = after ? pos.c + cell.colSpan - 1 : pos.c;
    const handled = new Set<Cell>();
    grid.forEach((row, r) => {
      const slot = row[col];
      if (!slot || handled.has(slot)) return;
      handled.add(slot);
      const inside = after ? slot.colSpan > 1 && row.indexOf(slot) + slot.colSpan - 1 > col : slot.colSpan > 1 && row.indexOf(slot) < col;
      if (inside) { slot.colSpan += 1; return; }
      const nc = this.blank(slot);
      if (slot.rowSpan > 1) nc.rowSpan = slot.rowSpan;
      slot.parentNode?.insertBefore(nc, after ? slot.nextSibling : slot);
      void r;
    });
  }

  static deleteRow(table: HTMLTableElement, cell: Cell): void {
    if (table.rows.length <= 1) { table.remove(); return; }
    const grid = this.build(table);
    const pos = this.position(grid, cell);
    if (!pos) return;
    const tr = table.rows[pos.r];
    for (const c of Array.from(tr.cells)) {
      if (c.rowSpan > 1) {
        // Move the spanning cell down into the next row before removing.
        const next = table.rows[pos.r + 1];
        const gridCol = grid[pos.r].indexOf(c);
        const before = Array.from(next.cells).find((n) => grid[pos.r + 1].indexOf(n) > gridCol) ?? null;
        c.rowSpan -= 1;
        next.insertBefore(c, before);
      }
    }
    tr.remove();
  }

  static deleteColumn(table: HTMLTableElement, cell: Cell): void {
    const grid = this.build(table);
    const pos = this.position(grid, cell);
    if (!pos) return;
    if ((grid[0]?.length ?? 0) <= 1) { table.remove(); return; }
    const done = new Set<Cell>();
    for (const row of grid) {
      const slot = row[pos.c];
      if (!slot || done.has(slot)) continue;
      done.add(slot);
      if (slot.colSpan > 1) slot.colSpan -= 1; else slot.remove();
    }
  }

  /** Merge `cell` with the cell to its right (same rows). */
  static mergeRight(table: HTMLTableElement, cell: Cell): boolean {
    const grid = this.build(table);
    const pos = this.position(grid, cell);
    if (!pos) return false;
    const right = grid[pos.r][pos.c + cell.colSpan];
    if (!right || right.rowSpan !== cell.rowSpan || grid[pos.r].indexOf(right) !== pos.c + cell.colSpan) return false;
    this.absorb(cell, right);
    cell.colSpan += right.colSpan;
    right.remove();
    return true;
  }

  /** Merge `cell` with the cell below it (same columns). */
  static mergeDown(table: HTMLTableElement, cell: Cell): boolean {
    const grid = this.build(table);
    const pos = this.position(grid, cell);
    if (!pos) return false;
    const below = grid[pos.r + cell.rowSpan]?.[pos.c];
    if (!below || below.colSpan !== cell.colSpan || grid[pos.r + cell.rowSpan].indexOf(below) !== pos.c) return false;
    this.absorb(cell, below);
    cell.rowSpan += below.rowSpan;
    below.remove();
    return true;
  }

  private static absorb(into: Cell, from: Cell): void {
    const empty = (c: Cell) => c.textContent?.trim() === "" && !c.querySelector("img,pre,.sr-code-widget");
    if (empty(from)) return;
    if (empty(into)) { into.innerHTML = ""; }
    else into.appendChild(document.createElement("br"));
    while (from.firstChild) {
      if (from.firstChild.nodeName === "BR" && from.childNodes.length === 1) { from.firstChild.remove(); break; }
      into.appendChild(from.firstChild);
    }
  }

  /** Split a merged cell back into single cells. */
  static split(table: HTMLTableElement, cell: Cell): boolean {
    if (cell.colSpan === 1 && cell.rowSpan === 1) return false;
    const grid = this.build(table);
    const pos = this.position(grid, cell);
    if (!pos) return false;
    const { colSpan, rowSpan } = cell;
    cell.colSpan = 1;
    cell.rowSpan = 1;
    for (let dr = 0; dr < rowSpan; dr += 1) {
      const tr = table.rows[pos.r + dr];
      const row = grid[pos.r + dr];
      // DOM insertion point: after the last cell that starts left of this column in this row.
      let anchor: Node | null = dr === 0 ? cell.nextSibling : null;
      if (dr > 0) {
        const lefts = Array.from(tr.cells).filter((c) => row.indexOf(c) < pos.c);
        anchor = lefts.length ? lefts[lefts.length - 1].nextSibling : tr.firstChild;
      }
      const from = dr === 0 ? 1 : 0;
      for (let dc = from; dc < colSpan; dc += 1) {
        const nc = this.blank(cell);
        tr.insertBefore(nc, anchor);
      }
    }
    return true;
  }

  static setCellBackground(cell: Cell, color: string | null): void {
    if (color) cell.style.backgroundColor = color; else cell.style.removeProperty("background-color");
    if (!cell.getAttribute("style")) cell.removeAttribute("style");
  }
}
