import { SelectionMemento } from "@/components/Editor/engine/SelectionMemento";

/**
 * Fullscreen with graceful degradation:
 *  1. Fullscreen API on the editor root (the DOM is NOT moved, so caret,
 *     scroll and unsaved edits are untouched).
 *  2. Fallback when the API is unavailable/denied: the root is re-parented
 *     to <body> and pinned with CSS (a `position:fixed` element inside a
 *     transformed modal would otherwise not cover the viewport). The
 *     selection is restored through the memento.
 */
export class FullscreenController {
  private placeholder: Comment | null = null;
  private active = false;
  private readonly onFs = () => {
    if (this.active && !document.fullscreenElement && !this.placeholder) this.finish();
  };

  constructor(
    private readonly root: HTMLElement,
    private readonly memento: SelectionMemento,
    private readonly onChange: (on: boolean) => void
  ) {
    document.addEventListener("fullscreenchange", this.onFs);
  }

  get isActive(): boolean { return this.active; }

  async enter(): Promise<void> {
    if (this.active) return;
    this.memento.save();
    this.active = true;
    this.root.classList.add("sr-fs");
    let native = false;
    try {
      if (this.root.requestFullscreen) { await this.root.requestFullscreen(); native = true; }
    } catch { native = false; }
    if (!native) {
      this.placeholder = document.createComment("sr-editor-anchor");
      this.root.parentNode?.insertBefore(this.placeholder, this.root);
      document.body.appendChild(this.root);
      this.root.classList.add("sr-fs-fallback");
    }
    this.onChange(true);
    requestAnimationFrame(() => this.memento.restore());
  }

  async exit(): Promise<void> {
    if (!this.active) return;
    this.memento.save();
    if (document.fullscreenElement === this.root) { try { await document.exitFullscreen(); } catch { /* ignore */ } }
    this.finish();
  }

  private finish(): void {
    if (this.placeholder?.parentNode) {
      this.placeholder.parentNode.insertBefore(this.root, this.placeholder);
      this.placeholder.remove();
    }
    this.placeholder = null;
    this.root.classList.remove("sr-fs", "sr-fs-fallback");
    this.active = false;
    this.onChange(false);
    requestAnimationFrame(() => this.memento.restore());
  }

  dispose(): void {
    document.removeEventListener("fullscreenchange", this.onFs);
    if (this.active) this.finish();
  }
}
