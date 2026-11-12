'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

import { COVER_LIMITS, CoverDesign, imageToDataUrl } from '@/lib/flipreader/cover';

interface Props {
    design: CoverDesign;
    onChange: (patch: Partial<CoverDesign>) => void;
    onReset: () => void;
    onClose: () => void;
}

function ImageField({
    label,
    value,
    onPick,
    onRemove,
}: {
    label: string;
    value: string | null;
    onPick: (file: File) => void;
    onRemove: () => void;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    return (
        <div className="rd-field">
            <span className="rd-label">{label}</span>
            <div className="rd-row">
                {value && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="rd-thumb" src={value} alt="" />
                )}
                <button type="button" className="rd-btn rd-wide" onClick={() => inputRef.current?.click()}>
                    {value ? 'Replace image' : 'Choose image'}
                </button>
                {value && (
                    <button type="button" className="rd-btn rd-wide" onClick={onRemove}>
                        Remove
                    </button>
                )}
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    hidden
                    onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        if (f) onPick(f);
                    }}
                />
            </div>
        </div>
    );
}

/** A side panel that edits the covers live, so changes are visible in the book while typing. */
export function CoverEditor({ design, onChange, onReset, onClose }: Props) {
    const [error, setError] = useState<string | null>(null);
    const firstRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        firstRef.current?.focus();
    }, []);

    const pickImage = async (field: 'frontImage' | 'backImage', file: File) => {
        setError(null);
        try {
            const url = await imageToDataUrl(file);
            onChange(field === 'frontImage' ? { frontImage: url } : { backImage: url });
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not use this image.');
        }
    };

    return (
        <div
            className="rd-editor"
            role="dialog"
            aria-label="Edit covers"
            onKeyDown={(e) => {
                if (e.key === 'Escape') onClose();
            }}
        >
            <div className="rd-row rd-between">
                <h2>Edit covers</h2>
                <button type="button" className="rd-btn" onClick={onClose} aria-label="Close editor" title="Close (Esc)">
                    <X size={18} strokeWidth={1.75} aria-hidden="true" />
                </button>
            </div>

            <label className="rd-check">
                <input type="checkbox" checked={design.covers} onChange={(e) => onChange({ covers: e.target.checked })} />
                <span>Show front and back covers</span>
            </label>

            <fieldset className="rd-group" disabled={!design.covers}>
                <legend>Front cover</legend>
                <label className="rd-field">
                    <span className="rd-label">Title</span>
                    <input
                        ref={firstRef}
                        className="rd-text"
                        value={design.title}
                        maxLength={COVER_LIMITS.title}
                        onChange={(e) => onChange({ title: e.target.value })}
                    />
                </label>
                <label className="rd-field">
                    <span className="rd-label">Subtitle</span>
                    <input
                        className="rd-text"
                        value={design.subtitle}
                        maxLength={COVER_LIMITS.subtitle}
                        onChange={(e) => onChange({ subtitle: e.target.value })}
                    />
                </label>
                <label className="rd-field">
                    <span className="rd-label">Author</span>
                    <input
                        className="rd-text"
                        value={design.author}
                        maxLength={COVER_LIMITS.author}
                        onChange={(e) => onChange({ author: e.target.value })}
                    />
                </label>
                <div className="rd-row">
                    <label className="rd-field rd-color">
                        <span className="rd-label">Cover colour</span>
                        <input type="color" value={design.color} onChange={(e) => onChange({ color: e.target.value })} />
                    </label>
                    <label className="rd-field rd-color">
                        <span className="rd-label">Text colour</span>
                        <input type="color" value={design.textColor} onChange={(e) => onChange({ textColor: e.target.value })} />
                    </label>
                </div>
                <ImageField
                    label="Front cover image (replaces the design)"
                    value={design.frontImage}
                    onPick={(f) => void pickImage('frontImage', f)}
                    onRemove={() => onChange({ frontImage: null })}
                />
            </fieldset>

            <fieldset className="rd-group" disabled={!design.covers}>
                <legend>Back cover</legend>
                <label className="rd-field">
                    <span className="rd-label">Text</span>
                    <textarea
                        className="rd-text"
                        rows={5}
                        value={design.backText}
                        maxLength={COVER_LIMITS.backText}
                        placeholder="A short description of the book"
                        onChange={(e) => onChange({ backText: e.target.value })}
                    />
                </label>
                <label className="rd-field rd-color">
                    <span className="rd-label">Back colour</span>
                    <input type="color" value={design.backColor} onChange={(e) => onChange({ backColor: e.target.value })} />
                </label>
                <ImageField
                    label="Back cover image (replaces the design)"
                    value={design.backImage}
                    onPick={(f) => void pickImage('backImage', f)}
                    onRemove={() => onChange({ backImage: null })}
                />
            </fieldset>

            {error && (
                <p className="rd-error" role="alert">
                    {error}
                </p>
            )}

            <div className="rd-row rd-between">
                <button type="button" className="rd-btn rd-wide" onClick={onReset}>
                    Reset
                </button>
                <button type="button" className="rd-primary" onClick={onClose}>
                    Done
                </button>
            </div>
            <p className="rd-hint">Covers are saved in this browser for this book. The inside of each cover stays blank.</p>
        </div>
    );
}
