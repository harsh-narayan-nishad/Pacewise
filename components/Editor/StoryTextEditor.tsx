"use client";

import * as React from "react";
import { EditorView } from "@/components/Editor/EditorView";
import { DocumentStore } from "@/lib/editor/persistence/DocumentStore";
import { EditorPrefsRepository } from "@/lib/editor/persistence/EditorPrefs";
import { RichDocument } from "@/lib/editor/model/RichDocument";
import { sessionManager } from "@/lib/session/composition";
import { createDefaultKeyValueStore } from "@/lib/session/storage/KeyValueStore";

export interface StoryTextEditorProps {
  /** Starting content; when omitted an unsaved draft for `draftSlot` is recovered. */
  initial?: RichDocument | null;
  draftSlot: string;
  onChange(doc: RichDocument): void;
  placeholder?: string;
}

/**
 * Composition root of the text feature: builds the per-user DocumentStore
 * from the ACTIVE user's session namespace. `SessionBoundary` remounts the
 * tree on user change, so this is evaluated again for the new user — no
 * stale cross-user store can survive.
 */
export function StoryTextEditor(props: StoryTextEditorProps): React.ReactElement {
  const deps = React.useMemo(() => {
    const kv = createDefaultKeyValueStore();
    const ns = sessionManager.active().namespace;
    return { store: new DocumentStore(kv, ns), prefs: new EditorPrefsRepository(kv, ns) };
  }, []);
  return <EditorView store={deps.store} prefsRepo={deps.prefs} {...props} />;
}

/** Drops the autosaved draft for a slot (call after the story is created/saved). */
export function clearEditorDraft(slot: string): void {
  new DocumentStore(createDefaultKeyValueStore(), sessionManager.active().namespace).clearDraft(slot);
}
