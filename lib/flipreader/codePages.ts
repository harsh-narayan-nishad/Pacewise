import { getTokenizer, LANGUAGE_ALIASES } from '@/lib/editor/code/languages';
import type { TokenType } from '@/lib/editor/code/Tokenizer';
import { newId } from './pages';
import type { ImageSource } from './types';

/**
 * Code and text files added to a book as pages: the file is laid out on A4 pages (file name at the top, line numbers,
 * syntax colours for the languages Pacewise knows), long lines wrap, and a long file runs on to as many pages as it
 * needs. Each page becomes a picture page, like an added image.
 */

const CODE_EXT =
    /\.(c|h|cc|cpp|cxx|hpp|hh|cs|java|kt|kts|scala|go|rs|swift|m|mm|py|pyw|rb|php|pl|lua|r|dart|js|jsx|mjs|cjs|ts|tsx|vue|svelte|html?|css|scss|sass|less|json|jsonc|xml|ya?ml|toml|ini|cfg|conf|env|sql|sh|bash|zsh|ps1|bat|cmd|gradle|make|mk|cmake|dockerfile|tex|graphql|gql|proto|md|markdown|txt|log|csv|tsv)$/i;

export const isCodeFile = (f: File) => CODE_EXT.test(f.name) || /^(text\/|application\/(json|xml|javascript|typescript|x-sh|x-yaml|yaml))/.test(f.type) || /^(Dockerfile|Makefile)$/i.test(f.name);

const EXT_LANG: Record<string, string> = { h: 'c', hpp: 'cpp', hh: 'cpp', kt: 'java', kts: 'java', scala: 'java', swift: 'java', dart: 'java', mjs: 'javascript', cjs: 'javascript', vue: 'html', svelte: 'html', scss: 'css', sass: 'css', less: 'css', jsonc: 'json', bash: 'bash', ps1: 'bash', bat: 'bash', cmd: 'bash', yml: 'plaintext', yaml: 'plaintext' };

function languageOf(name: string): string {
    const ext = (name.split('.').pop() ?? '').toLowerCase();
    return EXT_LANG[ext] ?? LANGUAGE_ALIASES[ext] ?? ext;
}

// light code theme (GitHub-like), readable when printed
const COLOURS: Record<TokenType, string> = {
    keyword: '#cf222e',
    string: '#0a3069',
    comment: '#6e7781',
    number: '#0550ae',
    type: '#953800',
    func: '#8250df',
    punct: '#24292f',
    tag: '#116329',
    attr: '#0550ae',
    plain: '#24292f',
};

/**
 * A code / text file split into lines of coloured pieces (the same colours and language rules as the code pages),
 * for showing it on screen, e.g. in the Library preview.
 */
export function codeLines(text: string, name: string): { text: string; color: string; italic: boolean; type: TokenType }[][] {
    const raw = text.replace(/\r\n?/g, '\n').replace(/\t/g, '    ');
    let tokens: { type: TokenType; text: string }[];
    try {
        tokens = getTokenizer(languageOf(name)).tokenize(raw) as { type: TokenType; text: string }[];
    } catch {
        tokens = [{ type: 'plain', text: raw }];
    }
    const lines: { text: string; color: string; italic: boolean; type: TokenType }[][] = [[]];
    for (const t of tokens) {
        t.text.split('\n').forEach((part, i) => {
            if (i > 0) lines.push([]);
            if (part) lines[lines.length - 1].push({ text: part, color: COLOURS[t.type] ?? COLOURS.plain, italic: t.type === 'comment', type: t.type });
        });
    }
    return lines;
}

const W = 1240; // A4 at 150 dpi
const H = 1754;
const MARGIN = 80;
const FONT = 21;
const LINE = Math.round(FONT * 1.5);
const MONO = `${FONT}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;

export async function codeFileToPages(file: File): Promise<ImageSource[]> {
    const raw = (await file.text()).replace(/\r\n?/g, '\n').replace(/\t/g, '    ');
    if (raw.includes('\u0000')) throw new Error(`"${file.name}" is not a text or code file.`);
    return codeTextToPages(raw, file.name);
}

/**
 * Code / text laid out on pages, numbered from `firstLine` (an edited page keeps its numbers). Each page keeps its own
 * lines (a line is never split between two pages), so one page can be edited and drawn again on its own.
 */
export async function codeTextToPages(text: string, fileName: string, firstLine = 1): Promise<ImageSource[]> {
    const file = { name: fileName };
    const raw = text.replace(/\r\n?/g, '\n').replace(/\t/g, '    ');
    let tokens: { type: TokenType; text: string }[];
    try {
        tokens = getTokenizer(languageOf(file.name)).tokenize(raw) as { type: TokenType; text: string }[];
    } catch {
        tokens = [{ type: 'plain', text: raw }];
    }

    // tokens split into lines of coloured pieces
    type Piece = { type: TokenType; text: string };
    const lines: Piece[][] = [[]];
    for (const t of tokens) {
        const parts = t.text.split('\n');
        parts.forEach((part, i) => {
            if (i > 0) lines.push([]);
            if (part) lines[lines.length - 1].push({ type: t.type, text: part });
        });
    }

    const measure = document.createElement('canvas').getContext('2d')!;
    measure.font = MONO;
    const cw = measure.measureText('M').width;
    const gutter = Math.max(3, String(lines.length + firstLine - 1).length) * cw + cw * 2;
    const cols = Math.max(20, Math.floor((W - MARGIN * 2 - gutter) / cw));

    // wrap long lines; each visual row keeps the number of the line it came from (only on its first row)
    const rows: { no: number | null; li: number; pieces: Piece[] }[] = [];
    lines.forEach((pieces, li) => {
        let row: Piece[] = [];
        let used = 0;
        let first = true;
        const flush = () => {
            rows.push({ no: first ? li + firstLine : null, li, pieces: row });
            first = false;
            row = [];
            used = 0;
        };
        for (const p of pieces) {
            let text = p.text;
            while (text.length) {
                const room = cols - used;
                if (room <= 0) flush();
                const take = text.slice(0, Math.max(1, cols - used));
                row.push({ type: p.type, text: take });
                used += take.length;
                text = text.slice(take.length);
            }
        }
        flush();
    });

    const headH = 70;
    const perPage = Math.max(1, Math.floor((H - MARGIN * 2 - headH) / LINE));
    // pages of whole lines: a wrapped line that does not fit goes on to the next page with all its rows
    const pagesRows: (typeof rows)[] = [[]];
    for (let r = 0; r < rows.length; ) {
        let end = r + 1;
        while (end < rows.length && rows[end].no === null) end++;
        const line = rows.slice(r, end);
        let cur = pagesRows[pagesRows.length - 1];
        if (cur.length && cur.length + line.length > perPage) pagesRows.push((cur = []));
        for (const row of line) {
            if (cur.length >= perPage) pagesRows.push((cur = [])); // one line longer than a whole page
            cur.push(row);
        }
        r = end;
    }
    const pageCount = pagesRows.length;
    const rawLines = raw.split('\n');
    const out: ImageSource[] = [];
    for (let pg = 0; pg < pageCount; pg++) {
        const c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);
        // file name (no "n / N" of the file's own pages: drawn into the picture it could not follow the book's page
        // numbers once pages are added, moved or deleted, so it disagreed with them)
        ctx.font = `600 24px Inter, system-ui, sans-serif`;
        ctx.fillStyle = '#16171a';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(file.name, MARGIN, MARGIN + 24);
        ctx.fillStyle = '#d0d7de';
        ctx.fillRect(MARGIN, MARGIN + 44, W - MARGIN * 2, 1);
        // code
        ctx.font = MONO;
        const top = MARGIN + headH + FONT;
        pagesRows[pg].forEach((r, i) => {
            const y = top + i * LINE;
            if (r.no !== null) {
                ctx.fillStyle = '#8c959f';
                const n = String(r.no);
                ctx.fillText(n, MARGIN + gutter - cw * 2 - measure.measureText(n).width, y);
            }
            let x = MARGIN + gutter;
            for (const p of r.pieces) {
                ctx.fillStyle = COLOURS[p.type] ?? COLOURS.plain;
                ctx.font = p.type === 'comment' ? `italic ${MONO}` : MONO;
                ctx.fillText(p.text, x, y);
                x += p.text.length * cw;
            }
        });
        const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('The page could not be made.'))), 'image/png'));
        const own = pagesRows[pg];
        const a = own.length ? own[0].li : 0;
        const z = own.length ? own[own.length - 1].li : -1;
        out.push({
            id: newId(),
            kind: 'image',
            name: pageCount > 1 ? `${file.name} (${pg + 1})` : file.name,
            blob,
            width: W,
            height: H,
            code: { name: file.name, text: rawLines.slice(a, z + 1).join('\n'), firstLine: a + firstLine },
        });
    }
    return out;
}
