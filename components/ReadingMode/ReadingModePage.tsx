"use client";
import { BRAND_NAME } from "@/lib/brand";

import React, { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Clock3, User } from "lucide-react";
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
export function ReadingModePage({ story }: { story: StoryData }) {
  const state = useReadingState();
  const dispatch = useReadingDispatch();
  const router = useRouter();
  const articleRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const elapsed = useRef(0); // ms of real, visible reading time
  const html = useStoryHtml(story);
  const words = storyWordCount(story);
  const author = devDataStore.findUserById(getContentAuthorId(story.id ?? story.title));

  useInertiaScroll(true);

  // Native scrollbar off + progress from scroll position.
  useEffect(() => {
    document.documentElement.classList.add("sr-reading-mode");
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    dispatch({ type: "SET_PROGRESS", progress: 0, paragraphIndex: 0 });
    let raf = 0;
    let last = -1;
    const update = () => {
      raf = 0;
      const el = articleRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const p = articleProgress(window.scrollY, window.innerHeight, top, el.offsetHeight);
      if (Math.abs(p - last) > 0.0015) {
        last = p;
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
  }, [dispatch]);

  // Stopwatch: real time on this page (paused while the tab is hidden), never tied to scroll.
  useEffect(() => {
    elapsed.current = 0;
    dispatch({ type: "SET_READING_ELAPSED", ms: 0 });
    let last = performance.now();
    let lastSecond = 0;
    const id = window.setInterval(() => {
      const now = performance.now();
      if (document.visibilityState === "visible") elapsed.current += now - last;
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
      <ScrollRail bodyRef={bodyRef} deps={html} />
      <article ref={articleRef} className={cn("sr-article mx-auto w-full px-6 pb-40 pt-14 sm:pt-20", story.media ? "max-w-[960px]" : "max-w-[760px]")}>
        <header className="mb-10">
          <h1 className="sr-article-title text-[2.1rem] leading-[1.12] text-ink sm:text-[2.9rem]">{story.title}</h1>
          {story.description && <p className="mt-4 font-serif text-xl leading-snug text-ink-muted">{story.description}</p>}
          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs uppercase tracking-wide text-ink-faint">
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
