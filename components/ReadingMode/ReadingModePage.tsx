"use client";
import { readingPresence } from "@/lib/readingPresence";
import { SpeedWheel } from "@/components/ReadingMode/SpeedWheel";
import { BRAND_BLUE, BRAND_NAME } from "@/lib/brand";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock3, Minus, Plus, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollRail } from "@/components/ReadingMode/ScrollRail";
import { useInertiaScroll } from "@/components/ReadingMode/useInertiaScroll";
import { useStoryHtml } from "@/components/Reader/useStoryHtml";
import { useReadingDispatch, useReadingState } from "@/contexts/ReadingContext";
import { articleProgress, wpmFromElapsed } from "@/lib/readingMode/progress";
import { effectiveWpm, wpmReductionPercent } from "@/lib/wpmCalculator";
import { storage } from "@/lib/storage";
import { storyWordCount } from "@/lib/wpmCalculator";
import { devDataStore } from "@/lib/devData/store";
import { getContentAuthorId } from "@/lib/devData/contentMeta";
import { cn } from "@/lib/utils";
import { StoryData, FontSettings } from "@/types";

const familyClass: Record<FontSettings["family"], string> = { serif: "font-serif", sans: "font-sans", mono: "font-mono" };

/**
 * Reading mode: the whole story as a normal article the reader scrolls at
 * their own pace (inertial wheel/keys, no auto-scroll, no speedometer). The
 * navbar shows the time left at the chosen WPM and a progress bar on its
 * bottom edge; both are driven by `state.progress`, updated from scroll.
 */
const SCALE_KEY = "speed-reader.story-font-scale";
const SCALE_MIN = 0.8;
const SCALE_MAX = 1.8;

export function ReadingModePage({ story, embedded = false }: { story: StoryData; embedded?: boolean }) {
  const state = useReadingState();
  const dispatch = useReadingDispatch();
  const router = useRouter();
  const articleRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const elapsed = useRef(0); // ms of real, visible reading time
  // Embedded on the story page: progress bar at the bottom of the screen, section rail on the
  // right, and a font-size control. They appear once the article scrolls into view.
  const [inArticle, setInArticle] = useState(!embedded);
  const [progress, setProgress] = useState(0);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    try { const v = Number(window.localStorage.getItem(SCALE_KEY)); if (v >= SCALE_MIN && v <= SCALE_MAX) setScale(v); } catch { /* ignore */ }
  }, []);
  // The clock only runs while the controls are showing (i.e. while the article is being read).
  // Tell the presence heartbeat whether the article is what the person is looking at.
  useEffect(() => {
    readingPresence.setSurface("article", inArticle);
    return () => readingPresence.setSurface("article", false);
  }, [inArticle]);
  const clockOn = useRef(!embedded);
  clockOn.current = inArticle;
  function changeScale(delta: number) {
    const next = Math.round(Math.min(SCALE_MAX, Math.max(SCALE_MIN, scale + delta)) * 10) / 10;
    setScale(next);
    try { window.localStorage.setItem(SCALE_KEY, String(next)); } catch { /* ignore */ }
  }
  const html = useStoryHtml(story);
  const words = storyWordCount(story);
  const author = devDataStore.findUserById(getContentAuthorId(story.id ?? story.title));

  useInertiaScroll(true);

  // Native scrollbar off + progress from scroll position.
  useEffect(() => {
    document.documentElement.classList.add("sr-reading-mode");
    if (!embedded) window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    dispatch({ type: "SET_PROGRESS", progress: 0, paragraphIndex: 0 });
    let raf = 0;
    let last = -1;
    const update = () => {
      raf = 0;
      const el = articleRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const p = articleProgress(window.scrollY, window.innerHeight, top, el.offsetHeight);
      // Controls show once the hero has scrolled away and hide again as it comes back from the top.
      if (embedded) setInArticle(top - window.scrollY < 64);
      if (Math.abs(p - last) > 0.0015) {
        last = p;
        setProgress(p);
        dispatch({ type: "SET_PROGRESS", progress: p, paragraphIndex: 0 });
      }
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    const ro = new ResizeObserver(onScroll);
    if (articleRef.current) ro.observe(articleRef.current);
    return () => {
      document.documentElement.classList.remove("sr-reading-mode");
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [dispatch, embedded]);

  // Stopwatch: real time on this page (paused while the tab is hidden), never tied to scroll.
  useEffect(() => {
    elapsed.current = 0;
    dispatch({ type: "SET_READING_ELAPSED", ms: 0 });
    let last = performance.now();
    let lastSecond = 0;
    const id = window.setInterval(() => {
      const now = performance.now();
      if (document.visibilityState === "visible" && clockOn.current) elapsed.current += now - last;
      last = now;
      const sec = Math.floor(elapsed.current / 1000);
      if (sec !== lastSecond) {
        lastSecond = sec;
        dispatch({ type: "SET_READING_ELAPSED", ms: elapsed.current });
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [dispatch]);

  function finish() {
    // Submitting early (or late) recalculates the speed from the time actually spent.
    const elapsedMs = Math.max(1000, elapsed.current);
    const actualWpm = wpmFromElapsed(words, elapsedMs);
    const eff = effectiveWpm(words, elapsedMs);
    storage.bumpStreak();
    storage.recordSession({
      minutes: Math.max(1, Math.round(elapsedMs / 60_000)),
      wpm: actualWpm,
      completed: true,
      breakMs: 0,
      breakCount: 0,
      effectiveWpm: eff,
      reductionPercent: wpmReductionPercent(state.selectedWpm, eff),
    });
    storage.addHistoryEntry({ id: crypto.randomUUID(), title: story.title, date: new Date().toISOString(), wpm: actualWpm, accuracy: 0, wordCount: words });
    const count = story.questions.length;
    dispatch({ type: "GO_TO_QUESTIONS", quizQuestionCount: Math.min(5, count) });
    if (count === 0) { dispatch({ type: "GO_TO_RESULTS" }); router.push("/results"); }
    else router.push("/questions");
  }

  const level = story.difficulty ?? story.level;

  return (
    <>
      {(!embedded || inArticle) && <ScrollRail bodyRef={bodyRef} deps={html} side={embedded ? "right" : "left"} accent={embedded ? BRAND_BLUE : undefined} alwaysOpen={embedded} />}
      {embedded && inArticle && <SpeedWheel />}
      {embedded && inArticle && (
        <>
          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 h-[3px] bg-overlay/10" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} aria-label="Reading progress">
            <div className="h-full transition-[width] duration-300 ease-out" style={{ width: `${progress * 100}%`, backgroundColor: BRAND_BLUE }} />
          </div>
          {inArticle && !story.media && (
            <div className="fixed bottom-5 right-4 z-40 flex items-center gap-1 rounded-full border border-overlay/10 bg-canvas-raised/90 p-1 shadow-themed backdrop-blur-xl sm:right-8" role="group" aria-label="Text size">
              <button type="button" onClick={() => changeScale(-0.1)} disabled={scale <= SCALE_MIN} aria-label="Decrease text size" className="flex h-9 w-9 items-center justify-center rounded-full text-ink transition-colors hover:bg-overlay/10 disabled:opacity-30">
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-[3.25rem] text-center text-sm tabular-nums text-ink-muted">{Math.round(scale * 100)}%</span>
              <button type="button" onClick={() => changeScale(0.1)} disabled={scale >= SCALE_MAX} aria-label="Increase text size" className="flex h-9 w-9 items-center justify-center rounded-full text-ink transition-colors hover:bg-overlay/10 disabled:opacity-30">
                <Plus className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}
      <article
        ref={articleRef}
        id={embedded ? "story-article" : undefined}
        style={embedded ? ({ "--sr-scale": scale } as React.CSSProperties) : undefined}
        className={cn("sr-article mx-auto w-full px-6 pb-40", embedded ? "sr-embedded pt-16 sm:pt-24" : "pt-14 sm:pt-20", story.media ? "max-w-[960px]" : "max-w-[760px]")}
      >
        <header className="mb-10">
          {!embedded && <h1 className="sr-article-title text-[2.1rem] leading-[1.12] text-ink sm:text-[2.9rem]">{story.title}</h1>}
          {story.description && <p className={cn("font-serif text-xl leading-snug text-ink-muted", embedded ? "" : "mt-4")}>{story.description}</p>}
          <div className={cn("mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs uppercase tracking-wide text-ink-faint", embedded && "hidden")}>
            <span className="flex items-center gap-1"><User className="h-3 w-3" /> {author?.name ?? story.author ?? BRAND_NAME}</span>
            {level && <span>· {level}</span>}
            <span className="flex items-center gap-1">· <Clock3 className="h-3 w-3" /> {Math.max(1, Math.round(words / state.selectedWpm))} min at {state.selectedWpm} wpm</span>
          </div>
        </header>

        <div ref={bodyRef} className={cn("text-ink", familyClass[state.fonts.family])}>
          {story.media ? (
            <div className="space-y-8">
              {story.media.pages.map((page, i) => (
                <figure key={i} data-rail-title={`Page ${i + 1}`} className="m-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={page.src}
                    alt={`${story.title}, page ${i + 1} of ${story.media!.pages.length}`}
                    width={page.width}
                    height={page.height}
                    draggable={false}
                    loading={i < 2 ? "eager" : "lazy"}
                    className="h-auto w-full select-none rounded-lg shadow-themed"
                  />
                </figure>
              ))}
            </div>
          ) : html !== null ? (
            <div className="sr-rich" dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <div className="sr-rich">
              {story.story.map((p, i) => <p key={i}>{p.paragraph}</p>)}
            </div>
          )}
        </div>

        <div className="mt-16 flex justify-center">
          <Button size="lg" onClick={finish}>{story.questions.length > 0 ? "Finished — take the quiz" : "Finished reading"}</Button>
        </div>
      </article>
    </>
  );
}
