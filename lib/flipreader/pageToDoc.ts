import { guessLanguage, isStrongCodeLine, looksLikeCode, dedent } from '@/lib/editor/code/CodeHeuristics';
import type { PageItem } from '@/lib/flipreader/types';

/**
 * Turns the text of one PDF page into document HTML for the rich text editor (components/Editor): lines are
 * rebuilt from pdf.js text items in reading order, larger text becomes headings, runs of code (monospace text, or
 * lines that read as code) become code blocks with their indentation kept, and the rest becomes paragraphs.
 * Returns null when the page has no text to take (a picture page, or a scanned PDF without a text layer).
 */

interface Line {
    text: string;
    /** left edge and baseline, in PDF units */
    x: number;
    y: number;
    /** font height of the line */
    size: number;
    mono: boolean;
    /** average width of one character, for rebuilding code indentation */
    charW: number;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function pageToDocHtml(item: PageItem): Promise<string | null> {
    if (item.type !== 'pdf') return null;
    const page = await item.src.pdf.getPage(item.index + 1);
    const content = await page.getTextContent();
    page.cleanup();
    const styles = content.styles as Record<string, { fontFamily?: string }>;

    // 1. Lines, in the order the PDF stores its text (usually the reading order, column by column).
    const lines: Line[] = [];
    let cur: Line | null = null;
    let lastEnd = 0;
    let breakNext = false;
    for (const raw of content.items) {
        if (!('str' in raw)) continue;
        const it = raw as { str: string; transform: number[]; width: number; height: number; fontName: string; hasEOL?: boolean };
        const x = it.transform[4];
        const y = it.transform[5];
        const size = Math.abs(it.height) || Math.hypot(it.transform[2], it.transform[3]) || 10;
        const mono = /mono|courier|consol/i.test(styles[it.fontName]?.fontFamily ?? '') || /mono|courier|consol/i.test(it.fontName);
        const newLine = !cur || breakNext || Math.abs(y - cur.y) > size * 0.5 || x < lastEnd - size * 2;
        if (newLine) {
            if (cur && cur.text.trim()) lines.push(cur);
            cur = { text: '', x, y, size, mono, charW: it.str.length ? it.width / it.str.length : size * 0.5 };
        } else if (cur && it.str && x - lastEnd > size * 0.15 && !/\s$/.test(cur.text) && !/^\s/.test(it.str)) {
            cur.text += ' ';
        }
        if (cur && it.str) {
            cur.text += it.str;
            cur.size = Math.max(cur.size, size);
            cur.mono = cur.mono && (mono || !it.str.trim());
            if (it.str.trim() && it.width > 0) cur.charW = it.width / it.str.length;
        }
        lastEnd = x + (it.width || 0);
        breakNext = !!it.hasEOL;
    }
    if (cur && cur.text.trim()) lines.push(cur);
    if (lines.length === 0) return null;

    // 2. Body text size = the most common line size; clearly bigger lines are headings.
    const sizes = new Map<number, number>();
    for (const l of lines) {
        const k = Math.round(l.size);
        sizes.set(k, (sizes.get(k) ?? 0) + l.text.length);
    }
    const body = [...sizes.entries()].sort((a, b) => b[1] - a[1])[0][0] || 10;
    const isCodeLine = (l: Line) => l.mono || isStrongCodeLine(l.text);

    // 3. Blocks: headings, code blocks, paragraphs.
    const out: string[] = [];
    let para: Line[] = [];
    const flushPara = () => {
        if (para.length === 0) return;
        const text = para.map((l) => l.text.trim()).join(' ').replace(/(\w)- (\w)/g, '$1$2').replace(/\s+/g, ' ').trim();
        if (text) out.push(`<p>${esc(text)}</p>`);
        para = [];
    };
    for (let i = 0; i < lines.length; i += 1) {
        const l = lines[i];
        // a run of code lines (two or more, or one monospace line)
        if (isCodeLine(l)) {
            let j = i;
            const run: Line[] = [];
            // keep going through the code's other lines: more code, braces / brackets alone, or lines indented under it
            const runLeft = l.x;
            const continues = (n: Line) =>
                isCodeLine(n) || n.mono || /^[\s{}()[\];,]*$/.test(n.text) || (n.x > runLeft + n.charW * 1.5 && n.size <= l.size * 1.1);
            while (j < lines.length && (j === i || continues(lines[j]))) run.push(lines[j++]);
            const left = Math.min(...run.map((r) => r.x));
            const text = dedent(run.map((r) => ' '.repeat(Math.max(0, Math.round((r.x - left) / Math.max(1, r.charW)))) + r.text.replace(/\s+$/, '')).join('\n'));
            if (l.mono || looksLikeCode(text)) {
                flushPara();
                out.push(`<pre data-lang="${guessLanguage(text)}"><code>${esc(text)}</code></pre>`);
                i = j - 1;
                continue;
            }
        }
        const ratio = l.size / body;
        if (ratio >= 1.25 && l.text.trim().length <= 120) {
            flushPara();
            const level = ratio >= 1.8 ? 1 : ratio >= 1.45 ? 2 : 3;
            out.push(`<h${level}>${esc(l.text.trim())}</h${level}>`);
            continue;
        }
        // a new paragraph after a clear vertical gap, or when the line starts a numbered / lettered item
        const prev = para[para.length - 1];
        const gap = prev ? Math.abs(prev.y - l.y) : 0;
        if (prev && (gap > prev.size * 1.9 || /^\s*(\d+[.)]|\([a-z0-9]\)|[•●▪-])\s/i.test(l.text))) flushPara();
        para.push(l);
    }
    flushPara();
    return out.join('') || null;
}
