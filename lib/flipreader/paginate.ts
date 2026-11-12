import { Block, PageBlock, TEXT_PAGE, TextPageData } from './types';

/*
 * These style objects are used BOTH for measuring (here) and for rendering (pages.tsx),
 * so the text breaks exactly where it was measured. Values are strings with units so they
 * work with both React and Object.assign(el.style, ...).
 */
export const PAGE_STYLE = {
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontSize: '19px',
    lineHeight: '1.55',
    color: '#2b2a28',
    textAlign: 'justify',
    overflowWrap: 'break-word',
    display: 'flow-root',
} as const;

export const P_STYLE = { margin: '0 0 12px', padding: '0', fontWeight: '400' } as const;
export const H_STYLE = { margin: '0 0 18px', padding: '0', fontSize: '26px', lineHeight: '1.25', fontWeight: '600' } as const;

const countWords = (blocks: PageBlock[]) =>
    blocks.reduce((n, b) => n + b.text.split(' ').filter(Boolean).length, 0);

const yieldToBrowser = () => new Promise<void>((r) => setTimeout(r, 0));

/**
 * Splits blocks into pages by measuring them in a hidden element of the real page width.
 * Long paragraphs are split with a binary search on the number of words that fit.
 * Yields to the browser regularly so the UI (progress bar) stays responsive.
 */
export async function paginate(
    blocks: Block[],
    onProgress?: (fraction: number) => void
): Promise<TextPageData[]> {
    const { w, h, padX, padY } = TEXT_PAGE;
    const limit = h - 2 * padY;

    const m = document.createElement('div');
    Object.assign(m.style, PAGE_STYLE, {
        position: 'fixed',
        left: '-10000px',
        top: '0',
        visibility: 'hidden',
        width: `${w - 2 * padX}px`,
    });
    document.body.appendChild(m);

    const makeNode = (b: PageBlock) => {
        const el = document.createElement(b.type === 'h' ? 'h2' : 'p');
        Object.assign(el.style, b.type === 'h' ? H_STYLE : P_STYLE);
        el.textContent = b.text;
        return el;
    };

    const pages: TextPageData[] = [];
    let cur: PageBlock[] = [];

    const flush = () => {
        if (cur.length) pages.push({ blocks: cur, words: countWords(cur) });
        cur = [];
        m.textContent = '';
    };

    const fits = (node: HTMLElement) => {
        m.appendChild(node);
        const ok = m.offsetHeight <= limit;
        m.removeChild(node);
        return ok;
    };

    try {
        let counter = 0;
        for (let bi = 0; bi < blocks.length; bi++) {
            const first = blocks[bi];
            if (first.type === 'break') {
                flush();
                continue;
            }

            let b: PageBlock = first;
            while (true) {
                const node = makeNode(b);
                m.appendChild(node);
                const ok = m.offsetHeight <= limit;
                if (ok) {
                    cur.push(b); // node stays in the measuring page
                    break;
                }
                m.removeChild(node);

                if (b.type === 'h') {
                    if (cur.length) {
                        flush();
                        continue; // retry on a fresh page
                    }
                    cur.push(b); // heading taller than a page: keep it anyway
                    m.appendChild(makeNode(b));
                    break;
                }

                // paragraph that does not fit: find how many words do
                const words = b.text.split(' ');
                let lo = 0;
                let hi = words.length - 1;
                while (lo < hi) {
                    const mid = Math.ceil((lo + hi) / 2);
                    const probe = makeNode({ type: 'p', text: words.slice(0, mid).join(' ') });
                    if (fits(probe)) lo = mid;
                    else hi = mid - 1;
                }

                if (lo === 0) {
                    if (cur.length) {
                        flush();
                        continue; // not even one word fits here, start a new page
                    }
                    lo = 1; // empty page and still no fit: force progress
                }

                const head = words.slice(0, lo).join(' ');
                const rest = words.slice(lo).join(' ');
                cur.push({ type: 'p', text: head, cont: b.cont });
                flush();
                if (!rest) break;
                b = { type: 'p', text: rest, cont: true };
            }

            if (++counter % 120 === 0) {
                onProgress?.(bi / blocks.length);
                await yieldToBrowser();
            }
        }
        flush();
    } finally {
        m.remove();
    }

    onProgress?.(1);
    return pages;
}
