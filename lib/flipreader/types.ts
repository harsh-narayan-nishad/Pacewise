import type { PDFDocumentProxy } from 'pdfjs-dist';

/** A piece of text content before it is split into pages. */
export type Block =
    | { type: 'h' | 'p'; text: string; cont?: boolean }
    | { type: 'break' }; // forces a new page (chapter start)

export type PageBlock = { type: 'h' | 'p'; text: string; cont?: boolean };

export interface TextPageData {
    blocks: PageBlock[];
    words: number;
}

/* ------------------------- page sources and edits ------------------------- */

/** A PDF file whose pages can be used in the book. The File is kept so a merged PDF can copy its pages. */
export interface PdfSource {
    id: string;
    kind: 'pdf';
    name: string;
    key: string;
    file: File;
    pdf: PDFDocumentProxy;
    pageCount: number;
    /** height / width of the first page */
    ratio: number;
}

/** An image, already scaled down and stored as a compact JPEG. */
export interface ImageSource {
    id: string;
    kind: 'image';
    name: string;
    blob: Blob;
    width: number;
    height: number;
}

export type Source = PdfSource | ImageSource;

export interface Crop {
    /** fractions (0..1) of the image after rotating / flipping / straightening */
    x: number;
    y: number;
    w: number;
    h: number;
}

export type FilterName = 'none' | 'mono' | 'sepia' | 'vivid' | 'fade' | 'invert';

/** Non-destructive edits applied on top of the stored image. */
export interface ImageEdit {
    rotate: 0 | 90 | 180 | 270;
    flipH: boolean;
    flipV: boolean;
    /** fine rotation in degrees, -45..45 */
    straighten: number;
    crop: Crop | null;
    /** -100..100 */
    brightness: number;
    contrast: number;
    saturation: number;
    warmth: number;
    /** 0..100 */
    sharpen: number;
    filter: FilterName;
}

/* ------------------------- things placed on top of a page ------------------------- */

/** Positions are fractions of the page (0..1), measured from its top-left corner. */
interface OverlayBase {
    id: string;
    x: number;
    y: number;
    /** width as a fraction of the page width */
    w: number;
    /** clockwise degrees */
    rotation: number;
    /** a locked item cannot be moved by accident */
    locked?: boolean;
    /** a soft drop shadow behind the item */
    shadow?: boolean;
}

export interface ImageOverlay extends OverlayBase {
    type: 'image';
    src: ImageSource;
    /** height as a fraction of the page height */
    h: number;
    opacity: number;
    flipX?: boolean;
    flipY?: boolean;
    /** filters, in percent (100 = unchanged for brightness, contrast and saturation) */
    brightness?: number;
    contrast?: number;
    saturate?: number;
    grayscale?: number;
    sepia?: number;
    blur?: number;
    /** rounded corners, 0 to 0.5 of the shorter side */
    radius?: number;
    /** a frame around the picture; the width is a fraction of the page width */
    borderColor?: string | null;
    borderWidth?: number;
}

export type TextFont = 'sans' | 'serif' | 'mono';

export interface TextOverlay extends OverlayBase {
    type: 'text';
    text: string;
    /** font size as a fraction of the page height */
    size: number;
    color: string;
    bold: boolean;
    italic: boolean;
    align: 'left' | 'center' | 'right';
    font: TextFont;
    /** colour of a box behind the text (a highlight or a label), or null for none */
    background: string | null;
    underline?: boolean;
    opacity?: number;
}

export type ShapeKind = 'rect' | 'ellipse' | 'triangle' | 'diamond' | 'pentagon' | 'hexagon' | 'star' | 'heart' | 'line' | 'arrow';

export interface ShapeOverlay extends OverlayBase {
    type: 'shape';
    kind: ShapeKind;
    /** height as a fraction of the page height */
    h: number;
    fill: string | null;
    stroke: string | null;
    /** outline width as a fraction of the page width */
    strokeWidth: number;
    /** rounded corners of a rectangle, 0 to 0.5 */
    radius: number;
    opacity: number;
    /** true for a page-sized colour sheet added from the Background tab */
    isBackground?: boolean;
}

/** A free-hand line. The points are 0 to 1 inside the box of the item. */
export interface DrawOverlay extends OverlayBase {
    type: 'draw';
    h: number;
    points: [number, number][];
    color: string;
    /** pen width as a fraction of the page width */
    width: number;
    opacity: number;
}

/** Drawn in this order: the last one is on top. */
export type Overlay = ImageOverlay | TextOverlay | ShapeOverlay | DrawOverlay;

export type PdfItem = { id: string; type: 'pdf'; src: PdfSource; index: number; overlays: Overlay[] };
export type ImageItem = { id: string; type: 'image'; src: ImageSource; edit: ImageEdit; overlays: Overlay[] };
export type PageItem = PdfItem | ImageItem;

/* ------------------------- books ------------------------- */

export interface PagesDoc {
    id: number;
    key: string;
    kind: 'pages';
    title: string;
    pageCount: number;
    items: PageItem[];
    /** every source ever added (kept so they can be released together) */
    sources: Source[];
    /** height / width the book is laid out with (taken from the first page) */
    ratio: number;
    /** increases on every change to the page list */
    rev: number;
}

export interface TextDoc {
    id: number;
    key: string;
    kind: 'text';
    title: string;
    pageCount: number;
    pages: TextPageData[];
}

export type BookDoc = PagesDoc | TextDoc;

/** Virtual paper size used for text books. Pages are scaled to the real size with CSS. */
export const TEXT_PAGE = { w: 600, h: 800, padX: 54, padY: 60 } as const;
