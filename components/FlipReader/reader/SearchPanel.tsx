'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

import LiquidGlass from '@/components/FlipReader/ui/LiquidGlass';
import { Hit, MIN_QUERY, search, SearchIndex, SearchResult } from '@/lib/flipreader/search';

export interface IndexProgress {
    filled: number;
    total: number;
    done: boolean;
}

interface Props {
    index: SearchIndex | null;
    progress: IndexProgress;
    query: string;
    onQuery: (q: string) => void;
    onOpenHit: (hit: Hit) => void;
    onClose: () => void;
}

const EMPTY: SearchResult = { hits: [], mode: 'phrase', pagesMatched: 0, truncated: false };

/**
 * Search across the whole book. Results update while typing (debounced) and while the pages are still
 * being read, and every result opens its page. Keyboard: Up/Down move, Enter opens, Escape closes.
 */
export function SearchPanel({ index, progress, query, onQuery, onOpenHit, onClose }: Props) {
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLUListElement>(null);
    const [debounced, setDebounced] = useState(query);
    const [sel, setSel] = useState(0);

    useEffect(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
    }, []);

    // wait for a pause in typing before searching a big book
    useEffect(() => {
        const t = setTimeout(() => setDebounced(query), 180);
        return () => clearTimeout(t);
    }, [query]);

    // re-run while pages are still being read, but only every 5 % so typing stays smooth
    const bucket = progress.done ? 'done' : Math.floor((progress.filled / Math.max(1, progress.total)) * 20);

    const result = useMemo(
        () => (index ? search(index, debounced) : EMPTY),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [index, debounced, bucket]
    );

    useEffect(() => setSel(0), [result]);

    useEffect(() => {
        listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
    }, [sel, result]);

    const typed = query.trim().length >= MIN_QUERY;
    const reading = !progress.done;

    let status: string;
    if (!typed) status = reading ? `Reading pages… ${progress.filled}/${progress.total}` : 'Type at least 2 letters. The whole book is searched.';
    else if (result.hits.length === 0) status = reading ? `No matches yet. Still reading pages… ${progress.filled}/${progress.total}` : 'No matches.';
    else {
        const n = result.truncated ? `${result.hits.length}+` : String(result.hits.length);
        status = `${n} result${result.hits.length === 1 ? '' : 's'} on ${result.pagesMatched} page${result.pagesMatched === 1 ? '' : 's'}`;
        if (result.mode === 'words') status += ' (pages containing all the words)';
        if (reading) status += ` · reading ${progress.filled}/${progress.total}`;
    }

    const open = (hit: Hit | undefined) => hit && onOpenHit(hit);

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSel((s) => Math.min(result.hits.length - 1, s + 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSel((s) => Math.max(0, s - 1));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            open(result.hits[sel]);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            onClose();
        }
    };

    // a click anywhere outside the panel closes it (the Search button at the top right opens / closes it itself)
    const rootRef = useRef<HTMLDivElement>(null);
    const closeRef = useRef(onClose);
    closeRef.current = onClose;
    useEffect(() => {
        const onDown = (e: PointerEvent) => {
            const t = e.target as Element | null;
            if (!t || rootRef.current?.contains(t) || t.closest('.rd-corner-top')) return;
            closeRef.current();
        };
        document.addEventListener('pointerdown', onDown, true);
        return () => document.removeEventListener('pointerdown', onDown, true);
    }, []);

    return (
        <div ref={rootRef} className="rd-search" role="search" aria-label="Search in book">
          <LiquidGlass width="100%" height="auto" radius={26} blur={6}>
           <div className="rd-search-body">
            <div className="rd-search-row">
                <input
                    ref={inputRef}
                    type="text"
                    name="text"
                    className="rd-search-input"
                    placeholder="Search in book"
                    autoComplete="off"
                    spellCheck={false}
                    enterKeyHint="search"
                    role="combobox"
                    aria-label="Search in book"
                    aria-expanded={result.hits.length > 0}
                    aria-controls="rd-results"
                    aria-activedescendant={result.hits.length ? `rd-hit-${sel}` : undefined}
                    value={query}
                    onChange={(e) => onQuery(e.target.value)}
                    onKeyDown={onKeyDown}
                />
                {query && (
                    <button
                        type="button"
                        className="rd-btn rd-wide"
                        onClick={() => {
                            onQuery('');
                            inputRef.current?.focus();
                        }}
                        aria-label="Clear search"
                    >
                        Clear
                    </button>
                )}
                {/* no close button here: Esc, or the Search button at the top right, closes it */}
            </div>

            <p className="rd-search-status" aria-live="polite">
                {status}
            </p>

            {result.hits.length > 0 && (
                <ul ref={listRef} id="rd-results" className="rd-results" role="listbox" aria-label="Search results">
                    {result.hits.map((hit, i) => (
                        <li
                            key={`${hit.page}-${hit.occurrence}-${i}`}
                            id={`rd-hit-${i}`}
                            role="option"
                            aria-selected={i === sel}
                            data-page={hit.page + 1}
                            data-occurrence={hit.occurrence}
                            className="rd-result"
                            onMouseMove={() => i !== sel && setSel(i)}
                            onClick={() => open(hit)}
                        >
                            <span className="rd-result-page">p. {hit.page + 1}</span>
                            <span className="rd-result-text">
                                {hit.headCut && '… '}
                                {hit.before}
                                <mark>{hit.match}</mark>
                                {hit.after}
                                {hit.tailCut && ' …'}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
           </div>
          </LiquidGlass>
        </div>
    );
}
