export type PageState = 'user_fold' | 'fold_corner' | 'flipping' | 'read';
export type PageOrientation = 'portrait' | 'landscape';
export type LayoutMode = 'auto' | 'single' | 'double';
export type FlipEventName = 'flip' | 'changeOrientation' | 'changeState' | 'init' | 'update';

export interface IFlipSetting {
    /** Page number from which to start viewing */
    startPage: number;
    /** Whether the book will be stretched under the parent element or not */
    size: 'fixed' | 'stretch';

    width: number;
    height: number;

    minWidth: number;
    maxWidth: number;
    minHeight: number;
    maxHeight: number;

    /** Draw shadows or not when page flipping */
    drawShadow: boolean;
    /** Flipping animation time (ms) */
    flippingTime: number;

    /**
     * The scale (1 = none) the PARENT has applied with CSS (pinch zoom). Lets the book map input correctly
     * and turns off page dragging while zoomed in, so a one-finger drag can pan instead.
     */
    zoom: number;
    /**
     * Soft motion blur while a page is moving (0 = off, 1 = normal). The turning page blurs with its speed and the page
     * under it softens slightly, which takes the strobing edge off a fast flip and is easier on the eyes.
     */
    motionBlur: number;
    /** Colour of the paper (page background); use a dark colour for night mode */
    paperColor: string;
    /** Enable switching to portrait mode (only used when layoutMode is 'auto') */
    usePortrait: boolean;
    /**
     * 'auto': two pages, or one page on narrow screens.
     * 'single': always one page. 'double': always two pages (a spread).
     */
    layoutMode: LayoutMode;
    /**
     * How many degrees (multiple of 90) the PARENT has rotated the book with CSS.
     * The book does not rotate itself; this only lets it map mouse/touch input correctly.
     */
    rotation: number;
    /** Initial value to z-index */
    startZIndex: number;
    /** If true, the root element is sized to the book */
    autoSize: boolean;
    /** Shadow intensity (1: max intensity, 0: hidden shadows) */
    maxShadowOpacity: number;

    /** If true, the first and last pages are shown alone, like a hardcover */
    showCover: boolean;
    /** Allow vertical page scrolling when touching the book on mobile */
    mobileScrollSupport: boolean;

    /** Don't flip when the click lands on a link/button/input inside a page */
    clickEventForward: boolean;

    /** Use mouse / touch input to flip pages */
    useMouseEvents: boolean;

    /** Minimum swipe distance (px) for a quick flick to flip the page */
    swipeDistance: number;

    /** Peek (fold) the corner of a page when the pointer hovers over it */
    showPageCorners: boolean;

    /** If true, only the page corners (not the whole page) react to clicks/drags */
    disableFlipByClick: boolean;
}

export const DEFAULT_SETTINGS: IFlipSetting = {
    startPage: 0,
    size: 'fixed',
    width: 400,
    height: 600,
    minWidth: 315,
    maxWidth: 1533,
    minHeight: 420,
    maxHeight: 1350,
    drawShadow: true,
    flippingTime: 1000,
    usePortrait: true,
    layoutMode: 'auto',
    paperColor: '#fbf8f2',
    motionBlur: 1,
    rotation: 0,
    zoom: 1,
    startZIndex: 0,
    autoSize: true,
    maxShadowOpacity: 1,
    showCover: false,
    mobileScrollSupport: true,
    clickEventForward: true,
    useMouseEvents: true,
    swipeDistance: 30,
    showPageCorners: true,
    disableFlipByClick: false,
};

export interface IBookState {
    page: number;
    mode: PageOrientation;
}

export interface IFlipEvent<T = unknown> {
    data: T;
    object: FlipBookApi;
}

export interface FlipOptions {
    /** Duration of this flip in ms (default: the book's flippingTime) */
    duration?: number;
}

export interface TapData {
    /** 1 = the right (forward) side was tapped, -1 = the left (backward) side */
    dir: 1 | -1;
    pointerType: string;
}

export interface HoldData {
    dir: 1 | -1;
    phase: 'start' | 'end';
}

export interface IEventProps {
    /**
     * A tap (press and release without moving) on the left or right side of the book.
     * Return true to handle it yourself; otherwise the book flips one page.
     */
    onTap?: (e: IFlipEvent<TapData>) => boolean | void;
    /** A press held for a moment (phase 'start'), and its release or cancellation (phase 'end'). */
    onHold?: (e: IFlipEvent<HoldData>) => void;
    onFlip?: (e: IFlipEvent<number>) => void;
    onChangeOrientation?: (e: IFlipEvent<PageOrientation>) => void;
    onChangeState?: (e: IFlipEvent<PageState>) => void;
    onInit?: (e: IFlipEvent<IBookState>) => void;
    onUpdate?: (e: IFlipEvent<IBookState>) => void;
}

/** What `ref.current.pageFlip()` returns. */
export interface FlipBookApi {
    /** Returns false when the flip was refused (busy, dragging, or at the end) */
    flipNext(opts?: FlipOptions): boolean;
    flipPrev(opts?: FlipOptions): boolean;
    /**
     * Animated flip to a page index. Only the last sheet is animated, so far jumps are cheap.
     * If a flip is already running, the request waits for it (the latest request wins).
     */
    flip(page: number, opts?: FlipOptions): void;
    /** Instant jump to a page index */
    turnToPage(page: number): void;
    turnToNextPage(): void;
    turnToPrevPage(): void;
    getCurrentPageIndex(): number;
    /** Page indexes currently on screen (1 or 2 pages) */
    getVisiblePages(): number[];
    getPageCount(): number;
    getOrientation(): PageOrientation;
    getState(): PageState;
    on(event: FlipEventName, cb: (e: IFlipEvent<any>) => void): FlipBookApi;
    off(event: FlipEventName, cb?: (e: IFlipEvent<any>) => void): FlipBookApi;
}

export interface FlipBookHandle {
    pageFlip: () => FlipBookApi;
}
