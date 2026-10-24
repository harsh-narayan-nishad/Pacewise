import { EditorSurface } from "@/components/Editor/engine/EditorSurface";

/**
 * Selection box + 4 corner handles over the selected image. Lives in a
 * positioned container ABOVE the document (never inside the contenteditable),
 * so it can't leak into the saved HTML. Dragging a handle writes
 * `width`/`height` attributes on the <img> (aspect locked unless Shift).
 */
export class ImageResizer {
  private readonly box: HTMLDivElement;
  private drag: { corner: string; startX: number; startY: number; w: number; h: number } | null = null;
  private readonly onMove = (e: PointerEvent) => this.move(e);
  private readonly onUp = () => this.end();

  constructor(private readonly host: HTMLElement, private readonly surface: EditorSurface) {
    this.box = document.createElement("div");
    this.box.className = "sr-img-box";
    this.box.hidden = true;
    for (const c of ["nw", "ne", "sw", "se"]) {
      const h = document.createElement("span");
      h.className = `sr-img-handle sr-img-${c}`;
      h.dataset.corner = c;
      h.addEventListener("pointerdown", (e) => this.start(e, c));
      this.box.appendChild(h);
    }
    host.appendChild(this.box);
  }

  sync(): void {
    const img = this.surface.image;
    if (!img) { this.box.hidden = true; return; }
    const hr = this.host.getBoundingClientRect();
    const r = img.getBoundingClientRect();
    this.box.hidden = false;
    this.box.style.left = `${r.left - hr.left + this.host.scrollLeft}px`;
    this.box.style.top = `${r.top - hr.top + this.host.scrollTop}px`;
    this.box.style.width = `${r.width}px`;
    this.box.style.height = `${r.height}px`;
  }

  private start(e: PointerEvent, corner: string): void {
    const img = this.surface.image;
    if (!img) return;
    e.preventDefault();
    this.surface.record();
    const r = img.getBoundingClientRect();
    this.drag = { corner, startX: e.clientX, startY: e.clientY, w: r.width, h: r.height };
    window.addEventListener("pointermove", this.onMove);
    window.addEventListener("pointerup", this.onUp);
  }

  private move(e: PointerEvent): void {
    const img = this.surface.image;
    if (!img || !this.drag) return;
    const d = this.drag;
    const sx = d.corner.includes("e") ? 1 : -1;
    const sy = d.corner.includes("s") ? 1 : -1;
    let w = Math.max(24, d.w + sx * (e.clientX - d.startX));
    let h = Math.max(24, d.h + sy * (e.clientY - d.startY));
    if (!e.shiftKey) h = (w / d.w) * d.h;
    const maxW = this.surface.el.clientWidth;
    if (w > maxW) { h = (maxW / w) * h; w = maxW; }
    img.setAttribute("width", String(Math.round(w)));
    img.setAttribute("height", String(Math.round(h)));
    this.sync();
  }

  private end(): void {
    window.removeEventListener("pointermove", this.onMove);
    window.removeEventListener("pointerup", this.onUp);
    if (this.drag) { this.drag = null; this.surface.afterEdit(); }
  }

  dispose(): void { this.end(); this.box.remove(); }
}
