import { escapeAttr, escapeText } from "@/lib/editor/html/entities";
import { dedent, guessLanguage, looksLikeCode, splitFences } from "@/lib/editor/code/CodeHeuristics";

/**
 * Turns plain story paragraphs (stories without a rich snapshot: JSON, PDF,
 * old saves) into HTML for StoryContentRenderer. Code is detected so it can be
 * shown IDE-style (own lines, indentation kept, highlighted):
 *   - ``` fenced blocks, with an optional language
 *   - multi-line paragraphs / single-line blobs that look like code
 * Other text stays a paragraph; its line breaks are kept (`white-space: pre-line`
 * via the `sr-lines` class). Returns null when the story has no code, so the
 * reader keeps its original plain layout.
 */
export function plainStoryToHtml(paragraphs: readonly string[]): string | null {
  let hasCode = false;
  const out: string[] = [];
  const pre = (code: string, lang?: string) => {
    const text = dedent(code);
    if (!text) return;
    hasCode = true;
    out.push(`<pre data-lang="${escapeAttr(lang || guessLanguage(text))}"><code>${escapeText(text)}</code></pre>`);
  };
  const para = (t: string) => {
    const text = t.replace(/\r\n?/g, "\n").trim();
    if (text) out.push(`<p${text.includes("\n") ? ' class="sr-lines"' : ""}>${escapeText(text)}</p>`);
  };
  for (const p of paragraphs) {
    for (const seg of splitFences(p)) {
      if (seg.kind === "code") pre(seg.text, seg.lang);
      else if (looksLikeCode(seg.text)) pre(seg.text);
      else para(seg.text);
    }
  }
  return hasCode ? out.join("") : null;
}
