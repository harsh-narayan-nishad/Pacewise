import { KeyValueStore } from "@/lib/session/storage/KeyValueStore";
import { UserNamespace } from "@/lib/session/UserNamespace";

export interface EditorPrefs {
  mode: "continuous" | "page";
  zoom: number;
  paper: "auto" | "light" | "dark" | "sepia";
  outline: boolean;
  recentColors: string[];
  code: { indent: "2" | "4" | "tab"; theme: "dark" | "light"; lineNumbers: boolean; wrap: boolean; whitespace: boolean };
}

export const DEFAULT_PREFS: EditorPrefs = {
  mode: "continuous", zoom: 100, paper: "auto", outline: false, recentColors: [],
  code: { indent: "2", theme: "dark", lineNumbers: true, wrap: false, whitespace: false },
};

/** Per-user UI preferences (same namespace scheme as documents). */
export class EditorPrefsRepository {
  constructor(private readonly kv: KeyValueStore, private readonly ns: UserNamespace) {}
  private get key(): string { return this.ns.key("docs:prefs"); }

  load(): EditorPrefs {
    try {
      const raw = this.kv.getItem(this.key);
      const p = raw ? (JSON.parse(raw) as Partial<EditorPrefs>) : {};
      return {
        mode: p.mode === "page" ? "page" : "continuous",
        zoom: typeof p.zoom === "number" ? Math.min(200, Math.max(50, p.zoom)) : 100,
        paper: p.paper === "light" || p.paper === "dark" || p.paper === "sepia" ? p.paper : "auto",
        outline: !!p.outline,
        recentColors: Array.isArray(p.recentColors) ? p.recentColors.filter((c) => typeof c === "string").slice(0, 10) : [],
        code: { ...DEFAULT_PREFS.code, ...(p.code ?? {}) },
      };
    } catch { return { ...DEFAULT_PREFS }; }
  }
  save(p: EditorPrefs): void { try { this.kv.setItem(this.key, JSON.stringify(p)); } catch { /* best effort */ } }
}
