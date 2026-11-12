'use client';

import React, { memo } from 'react';

import { useFlipPageSize } from '@/components/FlipReader/flip-book';
import { CoverDesign, hexToRgba } from '@/lib/flipreader/cover';

const SERIF = 'Georgia, "Times New Roman", serif';
const VIRTUAL_W = 600;

/** Lays content out on a 600px wide virtual cover and scales it to the real page size. */
function Scaled({ background, children }: { background: string; children: React.ReactNode }) {
    const { W, H } = useFlipPageSize();
    const scale = W / VIRTUAL_W;
    return (
        <div style={{ width: '100%', height: '100%', overflow: 'hidden', background }}>
            <div
                style={{
                    width: VIRTUAL_W,
                    height: H / scale,
                    transform: `scale(${scale})`,
                    transformOrigin: '0 0',
                    position: 'relative',
                    fontFamily: SERIF,
                }}
            >
                {children}
            </div>
        </div>
    );
}

function FullImage({ src, alt }: { src: string; alt: string }) {
    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={src}
            alt={alt}
            draggable={false}
            style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
        />
    );
}

const frame = (color: string): React.CSSProperties => ({
    position: 'absolute',
    top: 24,
    left: 24,
    right: 24,
    bottom: 24,
    border: `2px solid ${hexToRgba(color, 0.45)}`,
    pointerEvents: 'none',
});

const titleSize = (len: number) => (len > 60 ? 38 : len > 36 ? 46 : len > 20 ? 56 : 68);

/** The outside of the front cover: title, subtitle and author (or a replacement image). */
export const CoverFront = memo(function CoverFront({ design }: { design: CoverDesign }) {
    if (design.frontImage) return <FullImage src={design.frontImage} alt="Front cover" />;

    const { color, textColor, title, subtitle, author } = design;
    return (
        <Scaled background={color}>
            <div style={frame(textColor)} />
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    padding: '110px 70px 90px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    color: textColor,
                }}
            >
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: 0 }}>
                    <h1
                        style={{
                            margin: 0,
                            fontWeight: 600,
                            lineHeight: 1.12,
                            fontSize: titleSize(title.length),
                            overflowWrap: 'anywhere',
                        }}
                    >
                        {title || 'Untitled'}
                    </h1>
                    {subtitle && (
                        <p style={{ margin: '26px 0 0', fontSize: 26, lineHeight: 1.3, fontStyle: 'italic', opacity: 0.85, overflowWrap: 'anywhere' }}>
                            {subtitle}
                        </p>
                    )}
                    <div style={{ width: 90, height: 2, margin: '40px 0 0', background: hexToRgba(textColor, 0.55) }} />
                </div>
                {author && (
                    <p style={{ margin: 0, fontSize: 28, letterSpacing: '0.12em', textTransform: 'uppercase', overflowWrap: 'anywhere' }}>
                        {author}
                    </p>
                )}
            </div>
        </Scaled>
    );
});

/** The outside of the back cover: a short description (or a replacement image). */
export const CoverBack = memo(function CoverBack({ design }: { design: CoverDesign }) {
    if (design.backImage) return <FullImage src={design.backImage} alt="Back cover" />;

    const { backColor, textColor, backText, title, author } = design;
    return (
        <Scaled background={backColor}>
            <div style={frame(textColor)} />
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    padding: '100px 70px 80px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    color: textColor,
                }}
            >
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', minHeight: 0 }}>
                    {backText ? (
                        <p style={{ margin: 0, fontSize: 24, lineHeight: 1.6, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{backText}</p>
                    ) : (
                        <p style={{ margin: 0, fontSize: 30, fontStyle: 'italic', opacity: 0.85 }}>The End</p>
                    )}
                </div>
                <div style={{ width: 90, height: 2, margin: '0 0 28px', background: hexToRgba(textColor, 0.55) }} />
                <p style={{ margin: 0, fontSize: 20, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.8, overflowWrap: 'anywhere' }}>
                    {[title, author].filter(Boolean).join(' · ')}
                </p>
            </div>
        </Scaled>
    );
});

/** The inside of a cover (endpaper): intentionally blank. */
export const BlankPage = memo(function BlankPage() {
    return <div style={{ width: '100%', height: '100%' }} aria-hidden="true" />;
});
