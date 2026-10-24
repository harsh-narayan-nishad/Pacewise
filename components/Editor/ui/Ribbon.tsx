"use client";

import * as React from "react";
import { Icon, IconName } from "@/components/Editor/ui/icons";
import { ColorPopover } from "@/components/Editor/ui/ColorPopover";
import { FormatState } from "@/components/Editor/engine/EditorSurface";
import { LANGUAGES } from "@/lib/editor/code/languages";
import { EditorPrefs } from "@/lib/editor/persistence/EditorPrefs";
import { PageSettings, RichDocument } from "@/lib/editor/model/RichDocument";

export type RibbonTab = "Home" | "Insert" | "Layout" | "Review" | "View" | "Code";
export const TABS: RibbonTab[] = ["Home", "Insert", "Layout", "Review", "View", "Code"];

export interface RibbonApi {
  fmt: FormatState;
  doc: RichDocument;
  prefs: EditorPrefs;
  fullscreen: boolean;
  canUndo: boolean;
  canRedo: boolean;
  run(id: string, arg?: string): void;
  setPrefs(p: Partial<EditorPrefs>): void;
  setCodePrefs(p: Partial<EditorPrefs["code"]>): void;
  setPage(p: Partial<PageSettings>): void;
  setMeta(p: { author?: string; description?: string }): void;
  addRecentColor(c: string): void;
  insertImage(): void;
  openFind(): void;
  toggleFullscreen(): void;
  openLink(): void;
}

interface BtnProps { icon: IconName; label: string; on?: boolean; disabled?: boolean; onClick(): void; text?: string }
export function Btn({ icon, label, on, disabled, onClick, text }: BtnProps): React.ReactElement {
  return (
    <button type="button" className="sr-btn" title={label} aria-label={label} aria-pressed={on === undefined ? undefined : on}
      disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
      <Icon name={icon} />{text}
    </button>
  );
}

function Group({ children, label }: { children: React.ReactNode; label: string }): React.ReactElement {
  return <div className="sr-group" role="group" aria-label={label}>{children}</div>;
}

function ColorButton({ api, icon, label, command, current }: { api: RibbonApi; icon: IconName; label: string; command: string; current?: string }): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const [last, setLast] = React.useState<string>(current ?? "#e5484d");
  return (
    <span className="sr-pop-anchor">
      <button type="button" className="sr-btn" title={`${label} (click arrow area to choose)`} aria-label={label} aria-haspopup="dialog" aria-expanded={open}
        onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen((o) => !o)}>
        <Icon name={icon} /><span aria-hidden style={{ width: 12, height: 3, background: last, borderRadius: 2, display: "inline-block" }} />
      </button>
      {open && (
        <ColorPopover title={label} recent={api.prefs.recentColors} onClose={() => setOpen(false)}
          onPick={(c) => { if (c) { setLast(c); api.addRecentColor(c); } api.run(command, c ?? ""); setOpen(false); }} />
      )}
    </span>
  );
}

const FONTS = ["Arial", "Helvetica", "Georgia", "Times New Roman", "Palatino", "Verdana", "Trebuchet MS", "Courier New", "Comic Sans MS", "Impact", "system-ui"];
const SIZES = [10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64, 72];
const SYMBOLS = "© ® ™ § ¶ † ‡ • … — – « » ‹ › ° ± × ÷ ≠ ≈ ≤ ≥ ∞ √ ∑ ∏ ∫ ∂ ∆ π μ Ω α β γ δ θ λ σ φ ω ← → ↑ ↓ ⇒ ⇔ ✓ ✗ ★ ☆ ♥ € £ ¥ ¢ ½ ¼ ¾ ² ³ ¹".split(" ");

function SymbolButton({ api }: { api: RibbonApi }): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  return (
    <span className="sr-pop-anchor">
      <Btn icon="symbol" label="Symbols" on={open} onClick={() => setOpen((o) => !o)} />
      {open && (
        <div className="sr-pop" role="dialog" aria-label="Symbols" onMouseDown={(e) => e.preventDefault()}>
          <div className="sr-symbols">
            {SYMBOLS.map((s) => <button key={s} type="button" className="sr-btn" onClick={() => { api.run("symbol", s); setOpen(false); }}>{s}</button>)}
          </div>
        </div>
      )}
    </span>
  );
}

function TextPrompt({ icon, label, placeholder, onSubmit }: { icon: IconName; label: string; placeholder: string; onSubmit(v: string): void }): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const [v, setV] = React.useState("");
  const done = () => { if (v.trim()) onSubmit(v.trim()); setV(""); setOpen(false); };
  return (
    <span className="sr-pop-anchor">
      <Btn icon={icon} label={label} on={open} onClick={() => setOpen((o) => !o)} />
      {open && (
        <div className="sr-pop" role="dialog" aria-label={label} onMouseDown={(e) => { if (!(e.target instanceof HTMLInputElement)) e.preventDefault(); }}>
          <input type="text" autoFocus value={v} placeholder={placeholder} aria-label={label} onChange={(e) => setV(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") done(); if (e.key === "Escape") setOpen(false); }} />
          <button type="button" className="sr-btn" onClick={done}>Insert</button>
        </div>
      )}
    </span>
  );
}

function TableButton({ api }: { api: RibbonApi }): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const [r, setR] = React.useState(3);
  const [c, setC] = React.useState(3);
  return (
    <span className="sr-pop-anchor">
      <Btn icon="table" label="Insert table" on={open} onClick={() => setOpen((o) => !o)} />
      {open && (
        <div className="sr-pop" role="dialog" aria-label="Insert table" onMouseDown={(e) => { if (!(e.target instanceof HTMLInputElement)) e.preventDefault(); }}>
          <label className="sr-lbl">Rows <input type="number" className="sr-num" min={1} max={30} value={r} onChange={(e) => setR(Number(e.target.value))} /></label>{" "}
          <label className="sr-lbl">Columns <input type="number" className="sr-num" min={1} max={12} value={c} onChange={(e) => setC(Number(e.target.value))} /></label>
          <div><button type="button" className="sr-btn" onClick={() => { api.run("table", `${r}x${c}`); setOpen(false); }}>Insert</button></div>
        </div>
      )}
    </span>
  );
}

export function Ribbon({ tab, api }: { tab: RibbonTab; api: RibbonApi }): React.ReactElement {
  const f = api.fmt;
  const [fontText, setFontText] = React.useState("");
  const [sizeText, setSizeText] = React.useState("");
  const [lang, setLang] = React.useState("javascript");

  if (tab === "Home") {
    return (
      <div className="sr-ribbon-panel" role="toolbar" aria-label="Home">
        <Group label="History">
          <Btn icon="undo" label="Undo (Ctrl+Z)" disabled={!api.canUndo} onClick={() => api.run("undo")} />
          <Btn icon="redo" label="Redo (Ctrl+Y)" disabled={!api.canRedo} onClick={() => api.run("redo")} />
        </Group>
        <Group label="Style">
          <select className="sr-sel" aria-label="Paragraph style" value={f.block} onChange={(e) => api.run("blockStyle", e.target.value)}>
            <option value="p">Normal</option><option value="title">Title</option><option value="subtitle">Subtitle</option>
            {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={`h${n}`}>Heading {n}</option>)}
            <option value="quote">Quote</option>
          </select>
        </Group>
        <Group label="Font">
          <input className="sr-sel" list="sr-fonts" aria-label="Font family (type any installed font)" placeholder={f.fontFamily || "Font"} style={{ width: 120 }}
            value={fontText} onChange={(e) => setFontText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && fontText.trim()) { api.run("fontFamily", fontText.trim()); setFontText(""); } }}
            onBlur={() => { if (fontText.trim()) { api.run("fontFamily", fontText.trim()); setFontText(""); } }} />
          <datalist id="sr-fonts">{FONTS.map((x) => <option key={x} value={x} />)}</datalist>
          <input className="sr-num" list="sr-sizes" aria-label="Font size in px (type a custom value)" placeholder={f.fontSize.replace("px", "") || "16"}
            value={sizeText} onChange={(e) => setSizeText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && /^\d+(\.\d+)?$/.test(sizeText)) { api.run("fontSize", sizeText); setSizeText(""); } }}
            onBlur={() => { if (/^\d+(\.\d+)?$/.test(sizeText)) { api.run("fontSize", sizeText); setSizeText(""); } }} />
          <datalist id="sr-sizes">{SIZES.map((x) => <option key={x} value={x} />)}</datalist>
        </Group>
        <Group label="Text">
          <Btn icon="bold" label="Bold (Ctrl+B)" on={f.bold} onClick={() => api.run("bold")} />
          <Btn icon="italic" label="Italic (Ctrl+I)" on={f.italic} onClick={() => api.run("italic")} />
          <Btn icon="underline" label="Underline (Ctrl+U)" on={f.underline} onClick={() => api.run("underline")} />
          <Btn icon="strike" label="Strikethrough" on={f.strike} onClick={() => api.run("strike")} />
          <Btn icon="sub" label="Subscript" on={f.sub} onClick={() => api.run("sub")} />
          <Btn icon="sup" label="Superscript" on={f.sup} onClick={() => api.run("sup")} />
          <ColorButton api={api} icon="color" label="Font colour" command="color" />
          <ColorButton api={api} icon="highlight" label="Highlight colour" command="highlight" current="#ffd54a" />
          <Btn icon="clear" label="Clear formatting" onClick={() => api.run("clearFormat")} />
        </Group>
        <Group label="Paragraph">
          <Btn icon="alignL" label="Align left" on={f.align === "left"} onClick={() => api.run("alignLeft")} />
          <Btn icon="alignC" label="Align centre" on={f.align === "center"} onClick={() => api.run("alignCenter")} />
          <Btn icon="alignR" label="Align right" on={f.align === "right"} onClick={() => api.run("alignRight")} />
          <Btn icon="alignJ" label="Justify" on={f.align === "justify"} onClick={() => api.run("alignJustify")} />
          <Btn icon="ul" label="Bulleted list" on={f.ul && !f.checklist} onClick={() => api.run("ul")} />
          <Btn icon="ol" label="Numbered list" on={f.ol} onClick={() => api.run("ol")} />
          <Btn icon="check" label="Checklist" on={f.checklist} onClick={() => api.run("checklist")} />
          <Btn icon="outdent" label="Decrease indent (Shift+Tab)" onClick={() => api.run("outdent")} />
          <Btn icon="indent" label="Increase indent (Tab)" onClick={() => api.run("indent")} />
        </Group>
      </div>
    );
  }

  if (tab === "Insert") {
    return (
      <div className="sr-ribbon-panel" role="toolbar" aria-label="Insert">
        <Group label="Objects">
          <Btn icon="link" label="Link (Ctrl+K)" onClick={api.openLink} />
          <Btn icon="image" label="Image" onClick={api.insertImage} />
          <TableButton api={api} />
          <Btn icon="code" label="Code block" onClick={() => api.run("codeBlock", api.prefs.code ? "plaintext" : "plaintext")} />
        </Group>
        <Group label="Separators">
          <Btn icon="hr" label="Horizontal rule" onClick={() => api.run("hr")} />
          <Btn icon="pagebreak" label="Page break" onClick={() => api.run("pageBreak")} />
        </Group>
        <Group label="Text objects">
          <SymbolButton api={api} />
          <TextPrompt icon="math" label="Equation (LaTeX-lite, e.g. x^2 + \alpha)" placeholder="x^2 + \alpha_1" onSubmit={(v) => api.run("math", v)} />
          <TextPrompt icon="footnote" label="Footnote" placeholder="Footnote text" onSubmit={(v) => api.run("footnote", v)} />
        </Group>
      </div>
    );
  }

  if (tab === "Layout") {
    const p = api.doc.page;
    const setM = (k: keyof PageSettings["margins"], v: number) => api.setPage({ margins: { ...p.margins, [k]: Math.min(60, Math.max(5, v || 0)) } });
    return (
      <div className="sr-ribbon-panel" role="toolbar" aria-label="Layout">
        <Group label="Spacing">
          <span className="sr-lbl">Line</span>
          <select className="sr-sel" aria-label="Line spacing" defaultValue="" onChange={(e) => api.run("lineHeight", e.target.value)}>
            <option value="">Default</option><option value="1">1.0</option><option value="1.15">1.15</option><option value="1.5">1.5</option><option value="2">2.0</option><option value="2.5">2.5</option>
          </select>
          <span className="sr-lbl">Before</span>
          <input type="number" className="sr-num" min={0} max={96} defaultValue={0} aria-label="Space before (px)" onChange={(e) => api.run("spaceBefore", e.target.value)} />
          <span className="sr-lbl">After</span>
          <input type="number" className="sr-num" min={0} max={96} defaultValue={11} aria-label="Space after (px)" onChange={(e) => api.run("spaceAfter", e.target.value)} />
          <ColorButton api={api} icon="highlight" label="Paragraph background" command="paragraphBg" />
        </Group>
        <Group label="Page">
          <select className="sr-sel" aria-label="Paper size" value={p.paper} onChange={(e) => api.setPage({ paper: e.target.value as PageSettings["paper"] })}>
            <option>A4</option><option>Letter</option><option>Legal</option>
          </select>
          <select className="sr-sel" aria-label="Orientation" value={p.orientation} onChange={(e) => api.setPage({ orientation: e.target.value as PageSettings["orientation"] })}>
            <option value="portrait">Portrait</option><option value="landscape">Landscape</option>
          </select>
          <ColorButton api={api} icon="page" label="Page background" command="pageBg" />
        </Group>
        <Group label="Margins (mm)">
          {(["top", "right", "bottom", "left"] as const).map((k) => (
            <label key={k} className="sr-lbl">{k[0].toUpperCase()}<input type="number" className="sr-num" min={5} max={60} value={p.margins[k]} onChange={(e) => setM(k, Number(e.target.value))} aria-label={`${k} margin`} /></label>
          ))}
        </Group>
        <Group label="Header and footer">
          <input type="text" className="sr-sel" style={{ width: 130 }} placeholder="Header text" aria-label="Header text" value={p.header} onChange={(e) => api.setPage({ header: e.target.value })} />
          <input type="text" className="sr-sel" style={{ width: 130 }} placeholder="Footer text" aria-label="Footer text" value={p.footer} onChange={(e) => api.setPage({ footer: e.target.value })} />
          <label className="sr-lbl"><input type="checkbox" checked={p.pageNumbers} onChange={(e) => api.setPage({ pageNumbers: e.target.checked })} /> Page numbers</label>
        </Group>
      </div>
    );
  }

  if (tab === "Review") {
    const s = api.doc.stats;
    return (
      <div className="sr-ribbon-panel" role="toolbar" aria-label="Review">
        <Group label="Proofing"><Btn icon="find" label="Find and replace (Ctrl+F)" onClick={api.openFind} text=" Find & replace" /></Group>
        <Group label="Statistics">
          <span className="sr-lbl">{s.words} words · {s.characters} chars · {s.charactersNoSpaces} without spaces · {s.paragraphs} paragraphs · {s.codeBlocks} code blocks · ~{s.readingMinutes} min read</span>
        </Group>
        <Group label="Properties">
          <input type="text" className="sr-sel" style={{ width: 130 }} placeholder="Author" aria-label="Author" value={api.doc.meta.author} onChange={(e) => api.setMeta({ author: e.target.value })} />
          <input type="text" className="sr-sel" style={{ width: 200 }} placeholder="Description" aria-label="Description" value={api.doc.meta.description} onChange={(e) => api.setMeta({ description: e.target.value })} />
        </Group>
      </div>
    );
  }

  if (tab === "View") {
    return (
      <div className="sr-ribbon-panel" role="toolbar" aria-label="View">
        <Group label="Layout">
          <Btn icon="alignJ" label="Continuous view" on={api.prefs.mode === "continuous"} onClick={() => api.setPrefs({ mode: "continuous" })} text=" Continuous" />
          <Btn icon="page" label="Page view" on={api.prefs.mode === "page"} onClick={() => api.setPrefs({ mode: "page" })} text=" Pages" />
          <Btn icon="outline" label="Outline / navigation" on={api.prefs.outline} onClick={() => api.setPrefs({ outline: !api.prefs.outline })} text=" Outline" />
        </Group>
        <Group label="Zoom">
          <input type="range" min={50} max={200} step={10} value={api.prefs.zoom} aria-label="Zoom" onChange={(e) => api.setPrefs({ zoom: Number(e.target.value) })} />
          <span className="sr-lbl">{api.prefs.zoom}%</span>
        </Group>
        <Group label="Theme">
          <select className="sr-sel" aria-label="Paper theme" value={api.prefs.paper} onChange={(e) => api.setPrefs({ paper: e.target.value as EditorPrefs["paper"] })}>
            <option value="auto">Match site</option><option value="light">Light</option><option value="dark">Dark</option><option value="sepia">Eye comfort</option>
          </select>
        </Group>
        <Group label="Focus">
          <Btn icon={api.fullscreen ? "exitfull" : "full"} label={api.fullscreen ? "Exit fullscreen (Esc)" : "Fullscreen (F11)"} onClick={api.toggleFullscreen} text={api.fullscreen ? " Exit" : " Fullscreen"} />
        </Group>
      </div>
    );
  }

  const cp = api.prefs.code;
  return (
    <div className="sr-ribbon-panel" role="toolbar" aria-label="Code">
      <Group label="Insert">
        <select className="sr-sel" aria-label="Language for new code block" value={lang} onChange={(e) => setLang(e.target.value)}>
          {LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
        <Btn icon="code" label="Insert code block" onClick={() => api.run("codeBlock", lang)} text=" Code block" />
        <Btn icon="code" label="Convert selection to code block" onClick={() => api.run("toCode", lang)} text=" Selection → code" />
      </Group>
      <Group label="Code defaults (all blocks)">
        <select className="sr-sel" aria-label="Indent width" value={cp.indent} onChange={(e) => api.setCodePrefs({ indent: e.target.value as "2" | "4" | "tab" })}>
          <option value="2">2 spaces</option><option value="4">4 spaces</option><option value="tab">Tab</option>
        </select>
        <select className="sr-sel" aria-label="Code theme" value={cp.theme} onChange={(e) => api.setCodePrefs({ theme: e.target.value as "dark" | "light" })}>
          <option value="dark">Dark code</option><option value="light">Light code</option>
        </select>
        <label className="sr-lbl"><input type="checkbox" checked={cp.lineNumbers} onChange={(e) => api.setCodePrefs({ lineNumbers: e.target.checked })} /> Line numbers</label>
        <label className="sr-lbl"><input type="checkbox" checked={cp.wrap} onChange={(e) => api.setCodePrefs({ wrap: e.target.checked })} /> Wrap</label>
        <label className="sr-lbl"><input type="checkbox" checked={cp.whitespace} onChange={(e) => api.setCodePrefs({ whitespace: e.target.checked })} /> Whitespace</label>
      </Group>
      <Group label="Tips"><span className="sr-lbl">Tab / Shift+Tab indent · Ctrl+/ comment · Ctrl+F find · Esc leaves the block · type ```js + Enter</span></Group>
    </div>
  );
}
