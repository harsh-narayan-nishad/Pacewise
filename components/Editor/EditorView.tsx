"use client";

import * as React from "react";
import { Icon } from "@/components/Editor/ui/icons";
import { Btn, Ribbon, RibbonApi, RibbonTab, TABS } from "@/components/Editor/ui/Ribbon";
import { ColorPopover } from "@/components/Editor/ui/ColorPopover";
import { EditorSurface, FormatState } from "@/components/Editor/engine/EditorSurface";
import { ImageResizer } from "@/components/Editor/engine/ImageResizer";
import { FullscreenController } from "@/components/Editor/engine/FullscreenController";
import { CommandRegistry } from "@/components/Editor/engine/commands";
import { CodePrefs } from "@/components/Editor/engine/CodeBlockWidget";
import { DocumentStore, StorageFullError, VersionConflictError } from "@/lib/editor/persistence/DocumentStore";
import { EditorPrefs, EditorPrefsRepository } from "@/lib/editor/persistence/EditorPrefs";
import { AutosaveScheduler, SaveStatus } from "@/lib/editor/persistence/AutosaveScheduler";
import { EditLock } from "@/lib/editor/persistence/EditLock";
import { PageSettings, RichDocument, pageDimensionsMm } from "@/lib/editor/model/RichDocument";
import { ExporterRegistry } from "@/lib/editor/export/ExporterRegistry";
import { ImporterRegistry } from "@/lib/editor/import/Importers";
import { HtmlExporter } from "@/lib/editor/export/TextExporters";

export interface EditorViewProps {
  store: DocumentStore;
  prefsRepo: EditorPrefsRepository;
  /** Starting document. When absent the saved draft for `draftSlot` (if any) is used. */
  initial?: RichDocument | null;
  /** Remount key: a new value reloads `initial`. */
  draftSlot: string;
  onChange(doc: RichDocument): void;
  placeholder?: string;
}

const EMPTY_FMT: FormatState = { bold: false, italic: false, underline: false, strike: false, sub: false, sup: false, ul: false, ol: false, checklist: false, block: "p", align: "left", fontFamily: "", fontSize: "", color: "", inTable: false, inCode: false, image: false };
const MM_PX = 96 / 25.4;
const exporters = new ExporterRegistry();
const importers = new ImporterRegistry();

function dataUrlToBytes(url: string): { bytes: Uint8Array; mime: string } | null {
  const m = /^data:([\w/+.-]+);base64,(.*)$/.exec(url);
  if (!m) return null;
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return { bytes, mime: m[1] };
}

function download(name: string, mime: string, data: string | Uint8Array): void {
  const blob = new Blob([data as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function EditorView({ store, prefsRepo, initial, draftSlot, onChange, placeholder }: EditorViewProps): React.ReactElement {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const hostRef = React.useRef<HTMLDivElement>(null);
  const surfaceEl = React.useRef<HTMLDivElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const importRef = React.useRef<HTMLInputElement>(null);
  const replaceRef = React.useRef<HTMLInputElement>(null);
  const surfaceRef = React.useRef<EditorSurface | null>(null);
  const resizerRef = React.useRef<ImageResizer | null>(null);
  const fsRef = React.useRef<FullscreenController | null>(null);
  const commands = React.useMemo(() => new CommandRegistry(), []);

  const [prefs, setPrefsState] = React.useState<EditorPrefs>(() => prefsRepo.load());
  const prefsRef = React.useRef(prefs);
  prefsRef.current = prefs;

  const draftRecovered = React.useRef(false);
  const [doc, setDocState] = React.useState<RichDocument>(() => {
    if (initial) return initial;
    const d = store.loadDraft(draftSlot);
    if (d) draftRecovered.current = true;
    return d ?? RichDocument.empty();
  });
  const docRef = React.useRef(doc);
  const [docId, setDocId] = React.useState<string | null>(null);
  const docIdRef = React.useRef<string | null>(null);
  const versionRef = React.useRef<number | null>(null);
  const lockRef = React.useRef<EditLock | null>(null);
  const [readOnly, setReadOnly] = React.useState(false);

  const [tab, setTab] = React.useState<RibbonTab>("Home");
  const [ribbonOpen, setRibbonOpen] = React.useState(true);
  const [fmt, setFmt] = React.useState<FormatState>(EMPTY_FMT);
  const [status, setStatus] = React.useState<SaveStatus>("idle");
  const [fullscreen, setFullscreen] = React.useState(false);
  const [menu, setMenu] = React.useState<null | "docs" | "export">(null);
  const [findOpen, setFindOpen] = React.useState(false);
  const [findQ, setFindQ] = React.useState("");
  const [findR, setFindR] = React.useState("");
  const [findCase, setFindCase] = React.useState(false);
  const [findInfo, setFindInfo] = React.useState("");
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [linkUrl, setLinkUrl] = React.useState("");
  const [toast, setToast] = React.useState<string | null>(null);
  const [outline, setOutline] = React.useState<Array<{ level: number; text: string }>>([]);
  const [, bump] = React.useState(0);
  const [tick, setTick] = React.useState(0);
  const [bgPicker, setBgPicker] = React.useState<null | "pageBg" | "cellBg">(null);
  const [canUndo, setCanUndo] = React.useState(false);
  const [canRedo, setCanRedo] = React.useState(false);

  const notify = React.useCallback((m: string) => { setToast(m); setTimeout(() => setToast((t) => (t === m ? null : t)), 3200); }, []);

  // ---- document state helpers ------------------------------------------------
  const commit = React.useCallback((next: RichDocument) => {
    if (next === docRef.current) return;
    docRef.current = next;
    setDocState(next);
    autosaveRef.current?.schedule(next);
    onChangeRef.current(next);
  }, []);
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  const autosaveRef = React.useRef<AutosaveScheduler<RichDocument> | null>(null);
  if (!autosaveRef.current) {
    autosaveRef.current = new AutosaveScheduler<RichDocument>(
      (d) => {
        store.saveDraft(draftSlot, d);
        if (docIdRef.current) {
          const row = store.save(docIdRef.current, d, versionRef.current);
          versionRef.current = row.version;
        }
      },
      (s, err) => {
        setStatus(s);
        if (err instanceof VersionConflictError) notify("This document changed in another tab. Save As… to keep your copy.");
        else if (err instanceof StorageFullError) notify(err.message);
      }
    );
  }

  const syncFromSurface = React.useCallback(() => {
    const s = surfaceRef.current;
    if (!s) return;
    commit(docRef.current.withHtml(s.getHtml()));
    setTick((t) => t + 1);
    setCanUndo(s.history.canUndo);
    setCanRedo(s.history.canRedo);
  }, [commit]);

  const changeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleSync = React.useCallback(() => {
    if (changeTimer.current) clearTimeout(changeTimer.current);
    changeTimer.current = setTimeout(syncFromSurface, 180);
  }, [syncFromSurface]);

  const refreshFmt = React.useCallback(() => {
    const s = surfaceRef.current;
    if (!s) return;
    setFmt(s.queryState());
    resizerRef.current?.sync();
  }, []);

  // ---- surface lifecycle ------------------------------------------------------
  React.useEffect(() => {
    const el = surfaceEl.current;
    if (!el) return undefined;
    const surface = new EditorSurface(el, {
      onChange: scheduleSync,
      onSelection: refreshFmt,
      onShortcut: (n) => {
        if (n === "find") setFindOpen(true);
        if (n === "save") void saveNow();
        if (n === "link") { setLinkOpen(true); }
        if (n === "fullscreen") void toggleFullscreen();
      },
      resolveImage: (src) => store.resolveSrc(src),
      storeImage: (d) => store.putImage(d),
      codePrefs: () => prefsRef.current.code as CodePrefs,
      notify,
    });
    surfaceRef.current = surface;
    surface.setHtml(docRef.current.html, { resetHistory: true });
    if (hostRef.current) resizerRef.current = new ImageResizer(hostRef.current, surface);
    if (rootRef.current) fsRef.current = new FullscreenController(rootRef.current, surface.memento, setFullscreen);
    if (draftRecovered.current) notify("Recovered your unsaved draft.");
    onChangeRef.current(docRef.current);
    setOutline(surface.outline());
    const flush = () => { if (changeTimer.current) { clearTimeout(changeTimer.current); syncFromSurface(); } autosaveRef.current?.flush(); };
    const hide = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", hide);
    const ro = new ResizeObserver(() => resizerRef.current?.sync());
    ro.observe(el);
    return () => {
      flush();
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", hide);
      ro.disconnect();
      resizerRef.current?.dispose();
      fsRef.current?.dispose();
      surface.dispose();
      lockRef.current?.release();
      surfaceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => { surfaceEl.current?.setAttribute("contenteditable", readOnly ? "false" : "true"); }, [readOnly]);
  React.useEffect(() => { const s = surfaceRef.current; if (s) setOutline(s.outline()); }, [tick]);
  React.useEffect(() => { surfaceRef.current?.setCodePrefsForAll(prefs.code); }, [prefs.code]);

  // ---- actions -----------------------------------------------------------------
  const setPrefs = (p: Partial<EditorPrefs>) => { const n = { ...prefsRef.current, ...p }; setPrefsState(n); prefsRepo.save(n); };
  const setCodePrefs = (p: Partial<EditorPrefs["code"]>) => setPrefs({ code: { ...prefsRef.current.code, ...p } });
  const addRecentColor = (c: string) => setPrefs({ recentColors: [c, ...prefsRef.current.recentColors.filter((x) => x !== c)].slice(0, 8) });
  const setPage = (p: Partial<PageSettings>) => commit(docRef.current.withPage(p));
  const setMeta = (p: { title?: string; author?: string; description?: string }) => commit(docRef.current.withMeta(p));

  const run = (id: string, arg?: string) => {
    const s = surfaceRef.current;
    if (!s || readOnly) return;
    if (id === "pageBg") { setPage({ background: arg || undefined }); return; }
    commands.run(id, s, arg);
    refreshFmt();
    scheduleSync();
  };

  async function toggleFullscreen(): Promise<void> {
    const c = fsRef.current;
    if (!c) return;
    if (c.isActive) await c.exit(); else await c.enter();
  }

  async function saveNow(): Promise<void> {
    if (changeTimer.current) { clearTimeout(changeTimer.current); syncFromSurface(); }
    const d = docRef.current;
    try {
      if (!docIdRef.current) {
        const id = store.newId();
        const row = store.save(id, d, null);
        docIdRef.current = id; setDocId(id); versionRef.current = row.version;
        lockRef.current = store.lock(id); lockRef.current.acquire();
      } else {
        versionRef.current = store.save(docIdRef.current, d, versionRef.current).version;
      }
      store.saveDraft(draftSlot, d);
      setStatus("saved");
      notify("Saved");
    } catch (e) {
      setStatus("error");
      notify(e instanceof Error ? e.message : "Save failed");
    }
  }

  function saveAs(): void {
    docIdRef.current = null; setDocId(null); versionRef.current = null;
    lockRef.current?.release();
    commit(docRef.current.withMeta({ title: `${docRef.current.meta.title} (copy)` }));
    void saveNow();
  }

  function loadDoc(d: RichDocument, id: string | null, version: number | null): void {
    lockRef.current?.release();
    lockRef.current = null;
    let ro = false;
    if (id) { lockRef.current = store.lock(id); ro = !lockRef.current.acquire(); }
    setReadOnly(ro);
    docIdRef.current = id; setDocId(id); versionRef.current = version;
    docRef.current = d; setDocState(d);
    surfaceRef.current?.setHtml(d.html, { resetHistory: true });
    store.saveDraft(draftSlot, d);
    onChangeRef.current(d);
    setTick((t) => t + 1);
    if (ro) notify("Open in another tab — read-only here.");
  }

  function openDoc(id: string): void {
    const d = store.load(id);
    if (!d) { notify("That document can't be opened."); return; }
    const row = store.list().find((r) => r.id === id);
    loadDoc(d, id, row?.version ?? null);
    setMenu(null);
  }

  function newDoc(): void { loadDoc(RichDocument.empty(), null, null); setMenu(null); }

  function exportAs(id: string): void {
    const d = docRef.current;
    const resolved = d.html.replace(/sr-img:([a-z0-9]+)/g, (m) => store.resolveSrc(m) ?? m);
    const forExport = id === "html" ? RichDocument.fromHtml(resolved, d.meta, d.page) : d;
    Promise.resolve(exporters.get(id).export(forExport, (src) => { const u = store.resolveSrc(src); return u ? dataUrlToBytes(u) : null; }))
      .then((r) => download(r.filename, r.mime, r.data))
      .catch(() => notify("Export failed."));
    setMenu(null);
  }

  function printDoc(): void {
    const d = docRef.current;
    const resolved = RichDocument.fromHtml(d.html.replace(/sr-img:([a-z0-9]+)/g, (m) => store.resolveSrc(m) ?? m), d.meta, d.page);
    const html = (new HtmlExporter().export(resolved).data as string).replace("</style>", `@page{size:${d.page.paper} ${d.page.orientation};margin:${d.page.margins.top}mm ${d.page.margins.right}mm ${d.page.margins.bottom}mm ${d.page.margins.left}mm}</style>`);
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    frame.srcdoc = html;
    frame.onload = () => { frame.contentWindow?.focus(); frame.contentWindow?.print(); setTimeout(() => frame.remove(), 1500); };
    document.body.appendChild(frame);
    setMenu(null);
  }

  async function importFile(file: File): Promise<void> {
    const text = await file.text();
    const title = file.name.replace(/\.[^.]+$/, "");
    let d: RichDocument | null = null;
    if (/\.json$/i.test(file.name)) {
      try {
        const j = JSON.parse(text) as Record<string, unknown>;
        d = RichDocument.fromSnapshot(j) ?? RichDocument.fromSnapshot(j.richDocument);
        if (!d && Array.isArray(j.story)) {
          const paras = (j.story as Array<{ paragraph?: unknown }>).map((p) => String(p.paragraph ?? "")).filter(Boolean);
          d = importers.forFilename("x.txt")!.import(paras.join("\n\n"), String(j.title ?? title));
        }
      } catch { d = null; }
    } else {
      d = importers.forFilename(file.name)?.import(text, title) ?? null;
    }
    if (!d) { notify("Couldn't read that file."); return; }
    loadDoc(d, null, null);
    commit(d);
    notify(`Imported ${file.name}`);
  }

  // ---- image helpers -----------------------------------------------------------
  async function replaceImage(file: File): Promise<void> {
    const s = surfaceRef.current; const img = s?.image;
    if (!s || !img) return;
    const before = s.el.querySelectorAll("img").length;
    await s.insertImageFile(file);
    const imgs = Array.from(s.el.querySelectorAll("img"));
    if (imgs.length > before) { const fresh = imgs.find((i) => i !== img && !i.hasAttribute("width"))!; if (fresh) { img.src = fresh.src; img.setAttribute("data-sr-src", fresh.getAttribute("data-sr-src") ?? ""); img.setAttribute("data-img-id", fresh.getAttribute("data-img-id") ?? ""); fresh.closest("figure")?.remove(); img.removeAttribute("width"); img.removeAttribute("height"); } }
    s.afterEdit();
  }

  async function cropImage(ratio: number): Promise<void> {
    const s = surfaceRef.current; const img = s?.image;
    if (!s || !img) return;
    const w = img.naturalWidth, h = img.naturalHeight;
    let cw = w, ch = Math.round(w / ratio);
    if (ch > h) { ch = h; cw = Math.round(h * ratio); }
    const c = document.createElement("canvas");
    c.width = cw; c.height = ch;
    c.getContext("2d")!.drawImage(img, (w - cw) / 2, (h - ch) / 2, cw, ch, 0, 0, cw, ch);
    const url = c.toDataURL("image/png");
    const id = await store.putImage(url);
    s.record();
    img.src = url;
    img.setAttribute("data-sr-src", `sr-img:${id}`);
    img.setAttribute("data-img-id", id);
    img.removeAttribute("width"); img.removeAttribute("height");
    s.afterEdit();
  }

  // ---- find ----------------------------------------------------------------------
  const runFind = (q: string, cs: boolean) => { const n = surfaceRef.current?.find(q, cs) ?? 0; setFindInfo(q ? `${n} match${n === 1 ? "" : "es"}` : ""); };

  // ---- render --------------------------------------------------------------------
  const api: RibbonApi = {
    fmt, doc, prefs, fullscreen, canUndo, canRedo, run, setPrefs, setCodePrefs, setPage, setMeta, addRecentColor,
    insertImage: () => fileRef.current?.click(), openFind: () => setFindOpen(true), toggleFullscreen: () => void toggleFullscreen(), openLink: () => { surfaceRef.current?.memento.save(); setLinkOpen(true); },
  };
  // pageBg uses its own picker so it can write PageSettings; cellBg lives in the context bar.
  const dims = pageDimensionsMm(doc.page);
  const m = doc.page.margins;
  const pageStyle: React.CSSProperties = prefs.mode === "page"
    ? ({ width: `${dims.width * MM_PX}px`, maxWidth: "100%", minHeight: `${dims.height * MM_PX}px`, padding: `${m.top * MM_PX}px ${m.right * MM_PX}px ${m.bottom * MM_PX}px ${m.left * MM_PX}px`, ["--page-h" as string]: `${dims.height * MM_PX}px`, background: doc.page.background } as React.CSSProperties)
    : { background: doc.page.background };
  const recent = prefs.recentColors;

  return (
    <div ref={rootRef} className="sr-editor" data-paper={prefs.paper === "auto" ? undefined : prefs.paper} data-mode={prefs.mode} data-ribbon-open={ribbonOpen}
      onKeyDown={(e) => { if (e.key === "Escape" && fullscreen) { e.stopPropagation(); void toggleFullscreen(); } }}>
      <div className="sr-topbar">
        <input className="sr-title-input" value={doc.meta.title} aria-label="Document title" onChange={(e) => setMeta({ title: e.target.value })} onFocus={(e) => e.currentTarget.select()} />
        <span className="sr-status" data-s={status} role="status" aria-live="polite">
          {status === "dirty" || status === "saving" ? "Saving…" : status === "saved" ? "Saved" : status === "error" ? "Save failed" : docId ? "Saved to documents" : "Draft"}
        </span>
        <Btn icon="undo" label="Undo" disabled={!canUndo} onClick={() => run("undo")} />
        <Btn icon="redo" label="Redo" disabled={!canRedo} onClick={() => run("redo")} />
        <span className="sr-pop-anchor">
          <Btn icon="folder" label="Documents" on={menu === "docs"} onClick={() => setMenu(menu === "docs" ? null : "docs")} />
          {menu === "docs" && (
            <div className="sr-pop" style={{ right: 0, minWidth: 260 }} role="menu" aria-label="Documents">
              <button type="button" className="sr-menu-item" onClick={newDoc}><Icon name="plus" /> New document</button>
              <button type="button" className="sr-menu-item" onClick={() => { void saveNow(); setMenu(null); }}><Icon name="save" /> Save (Ctrl+S)</button>
              <button type="button" className="sr-menu-item" onClick={() => { saveAs(); setMenu(null); }}><Icon name="copy" /> Save as copy</button>
              <button type="button" className="sr-menu-item" onClick={() => importRef.current?.click()}><Icon name="upload" /> Import .txt .md .html .json…</button>
              <div className="sr-lbl" style={{ margin: "6px 4px 2px" }}>Your documents</div>
              {store.list().length === 0 && <div className="sr-lbl" style={{ padding: 6 }}>Nothing saved yet.</div>}
              {store.list().slice(0, 12).map((r) => (
                <div key={r.id} className="sr-doc-row">
                  <button type="button" className="sr-menu-item" onClick={() => openDoc(r.id)} title={new Date(r.updatedAt).toLocaleString()}>
                    <Icon name="page" /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</span><span className="sr-lbl">{r.words}w</span>
                  </button>
                  <button type="button" className="sr-btn" aria-label={`Delete ${r.title}`} title="Delete" onClick={() => { store.remove(r.id); if (docIdRef.current === r.id) { docIdRef.current = null; setDocId(null); } bump((x) => x + 1); }}><Icon name="trash" /></button>
                </div>
              ))}
            </div>
          )}
        </span>
        <span className="sr-pop-anchor">
          <Btn icon="download" label="Export" on={menu === "export"} onClick={() => setMenu(menu === "export" ? null : "export")} />
          {menu === "export" && (
            <div className="sr-pop" style={{ right: 0 }} role="menu" aria-label="Export">
              {exporters.list().map((x) => <button key={x.id} type="button" className="sr-menu-item" onClick={() => exportAs(x.id)}>{x.label}</button>)}
              <button type="button" className="sr-menu-item" onClick={printDoc}><Icon name="print" /> PDF / Print…</button>
            </div>
          )}
        </span>
        <Btn icon="outline" label="Outline" on={prefs.outline} onClick={() => setPrefs({ outline: !prefs.outline })} />
        <Btn icon={fullscreen ? "exitfull" : "full"} label={fullscreen ? "Exit fullscreen" : "Expand (fullscreen)"} onClick={() => void toggleFullscreen()} text={fullscreen ? " Exit" : ""} />
      </div>

      <div className="sr-tabs" role="tablist" aria-label="Editor ribbon">
        {TABS.map((t) => (
          <button key={t} type="button" role="tab" className="sr-tab" aria-selected={tab === t}
            onClick={() => { if (tab === t && fullscreen) setRibbonOpen((o) => !o); else { setTab(t); setRibbonOpen(true); } }}>{t}</button>
        ))}
      </div>
      <Ribbon tab={tab} api={api} />
      {tab === "Layout" && (
        <div className="sr-context">
          <span className="sr-pop-anchor">
            <button type="button" className="sr-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => setBgPicker(bgPicker === "pageBg" ? null : "pageBg")}>Page background…</button>
            {bgPicker === "pageBg" && <ColorPopover title="Page background" recent={recent} onClose={() => setBgPicker(null)} onPick={(c) => { setPage({ background: c ?? undefined }); if (c) addRecentColor(c); setBgPicker(null); }} />}
          </span>
        </div>
      )}
      <div className="sr-context" hidden={!fmt.inTable}>
        <span className="sr-lbl">Table</span>
        {([["rowAbove", "+ Row above"], ["rowBelow", "+ Row below"], ["colLeft", "+ Col left"], ["colRight", "+ Col right"], ["delRow", "− Row"], ["delCol", "− Col"], ["mergeRight", "Merge →"], ["mergeDown", "Merge ↓"], ["split", "Split"], ["borders", "Borders"], ["delTable", "Delete table"]] as const).map(([id, label]) => (
          <button key={id} type="button" className="sr-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => run("tableOp", id)}>{label}</button>
        ))}
        <span className="sr-pop-anchor">
          <button type="button" className="sr-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => setBgPicker(bgPicker === "cellBg" ? null : "cellBg")}>Cell colour</button>
          {bgPicker === "cellBg" && <ColorPopover title="Cell background" recent={recent} onClose={() => setBgPicker(null)} onPick={(c) => { run("cellBg", c ?? ""); if (c) addRecentColor(c); setBgPicker(null); }} />}
        </span>
      </div>
      <div className="sr-context" hidden={!fmt.image}>
        <span className="sr-lbl">Image</span>
        {([["align:left", "Left"], ["align:center", "Centre"], ["align:right", "Right"], ["width:150", "S"], ["width:300", "M"], ["width:500", "L"], ["border:", "Border"], ["margin:8", "Spacing"], ["delete:", "Delete"]] as const).map(([v, label]) => (
          <button key={v} type="button" className="sr-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => run("imageProp", v)}>{label}</button>
        ))}
        <input type="text" className="sr-sel" style={{ width: 120 }} placeholder="Alt text" aria-label="Alt text" defaultValue={surfaceRef.current?.image?.alt ?? ""} key={`alt-${tick}-${fmt.image}`} onChange={(e) => run("imageProp", `alt:${e.target.value}`)} />
        <input type="text" className="sr-sel" style={{ width: 140 }} placeholder="Caption" aria-label="Caption" onChange={(e) => run("imageProp", `caption:${e.target.value}`)} />
        <button type="button" className="sr-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => replaceRef.current?.click()}>Replace…</button>
        {([["1:1", 1], ["4:3", 4 / 3], ["16:9", 16 / 9]] as const).map(([l, r]) => <button key={l} type="button" className="sr-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => void cropImage(r)}>Crop {l}</button>)}
      </div>

      <div className="sr-find" hidden={!findOpen} role="search">
        <input type="text" aria-label="Find" placeholder="Find" value={findQ} onChange={(e) => { setFindQ(e.target.value); runFind(e.target.value, findCase); }}
          onKeyDown={(e) => { if (e.key === "Enter") { const r = surfaceRef.current?.findStep(e.shiftKey ? -1 : 1); if (r) setFindInfo(`${r.index} of ${r.total}`); } if (e.key === "Escape") { setFindOpen(false); surfaceRef.current?.clearFindHighlight(); } }} />
        <input type="text" aria-label="Replace with" placeholder="Replace with" value={findR} onChange={(e) => setFindR(e.target.value)} />
        <button type="button" className="sr-btn" onClick={() => { const r = surfaceRef.current?.findStep(-1); if (r) setFindInfo(`${r.index} of ${r.total}`); }}>↑</button>
        <button type="button" className="sr-btn" onClick={() => { const r = surfaceRef.current?.findStep(1); if (r) setFindInfo(`${r.index} of ${r.total}`); }}>↓</button>
        <button type="button" className="sr-btn" onClick={() => { surfaceRef.current?.replaceCurrent(findQ, findR, findCase); runFind(findQ, findCase); }}>Replace</button>
        <button type="button" className="sr-btn" onClick={() => { const n = surfaceRef.current?.replaceAll(findQ, findR, findCase) ?? 0; setFindInfo(`${n} replaced`); }}>Replace all</button>
        <label className="sr-lbl"><input type="checkbox" checked={findCase} onChange={(e) => { setFindCase(e.target.checked); runFind(findQ, e.target.checked); }} /> Match case</label>
        <span className="sr-lbl">{findInfo}</span>
        <button type="button" className="sr-btn" aria-label="Close find" onClick={() => { setFindOpen(false); surfaceRef.current?.clearFindHighlight(); }}><Icon name="close" /></button>
      </div>
      <div className="sr-find" hidden={!linkOpen}>
        <input type="text" aria-label="Link address" placeholder="https://example.com" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} autoFocus
          onKeyDown={(e) => { if (e.key === "Enter") { run("link", linkUrl.trim()); setLinkOpen(false); setLinkUrl(""); } if (e.key === "Escape") setLinkOpen(false); }} />
        <button type="button" className="sr-btn" onClick={() => { run("link", linkUrl.trim()); setLinkOpen(false); setLinkUrl(""); }}>Apply link</button>
        <button type="button" className="sr-btn" onClick={() => { run("link", ""); setLinkOpen(false); }}>Remove link</button>
        <button type="button" className="sr-btn" aria-label="Close" onClick={() => setLinkOpen(false)}><Icon name="close" /></button>
      </div>
      {readOnly && <div className="sr-readonly-note" role="alert">This document is open for editing in another tab, so it is read-only here.</div>}

      <div className="sr-body">
        {prefs.outline && (
          <nav className="sr-outline" aria-label="Outline">
            {outline.length === 0 && <span className="sr-lbl">Add headings to build an outline.</span>}
            {outline.map((o, i) => (
              <button key={i} type="button" style={{ paddingLeft: 4 + (o.level - 1) * 10 }} onClick={() => surfaceRef.current?.outline()[i]?.el.scrollIntoView({ behavior: "smooth", block: "start" })}>{o.text}</button>
            ))}
          </nav>
        )}
        <div className="sr-scroll" ref={hostRef} onScroll={() => resizerRef.current?.sync()}>
          <div className="sr-page-wrap" style={{ zoom: prefs.zoom / 100 } as React.CSSProperties}>
            <div className="sr-page" style={pageStyle}>
              <div className="sr-page-head">{doc.page.header}</div>
              <div ref={surfaceEl} className="sr-surface" data-placeholder={placeholder ?? "Start writing…"} spellCheck />
              <div className="sr-page-foot">{[doc.page.footer, doc.page.pageNumbers ? "Page 1" : ""].filter(Boolean).join("  ·  ")}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="sr-statusbar" role="status">
        <span>{doc.stats.words} words</span><span>{doc.stats.characters} characters</span><span>{doc.stats.paragraphs} paragraphs</span>
        <span>~{doc.stats.readingMinutes} min read</span>
        <span className="sr-grow" />
        <span>{prefs.mode === "page" ? `${doc.page.paper} ${doc.page.orientation}` : "Continuous"}</span>
        <span>{prefs.zoom}%</span>
      </div>
      {toast && <div className="sr-toast" role="status">{toast}</div>}

      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/avif" hidden multiple
        onChange={(e) => { Array.from(e.target.files ?? []).forEach((f) => void surfaceRef.current?.insertImageFile(f)); e.target.value = ""; }} />
      <input ref={replaceRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/avif" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void replaceImage(f); e.target.value = ""; }} />
      <input ref={importRef} type="file" accept={`${importers.accept},.json`} hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = ""; setMenu(null); }} />
    </div>
  );
}
