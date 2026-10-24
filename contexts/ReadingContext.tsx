"use client";

import React, { createContext, useContext, useMemo, useReducer } from "react";
import {
  BreakStats,
  FontSettings,
  QuestionAnswer,
  ReadingPhase,
  StoryData,
} from "@/types";

/**
 * Finite-state-machine (Context + Reducer) pattern.
 *
 * Why: the reading flow (dashboard -> reading -> completed -> questions ->
 * results) has many interdependent fields (phase, speed, font settings,
 * answers) that several unrelated components need to read and mutate
 * (Speedometer, Controls, ProgressBar, QuestionCard...). Prop-drilling all
 * of that through the App Router page tree would be brittle. A reducer
 * keeps every transition explicit and centrally auditable, and the
 * Context split (state vs dispatch) below avoids re-rendering consumers
 * that only dispatch actions.
 *
 * Tradeoff: for an app this size a full library (Zustand/Redux) is
 * unnecessary weight; useReducer + Context is enough and ships zero extra
 * dependencies. If the state graph grows much larger (e.g. multi-story
 * library, server sync), migrating to Zustand is the natural next step —
 * the action shape below maps almost 1:1 onto a Zustand store.
 */

export interface ReadingState {
  phase: ReadingPhase;
  story: StoryData | null;
  selectedWpm: number;
  isPlaying: boolean;
  progress: number; // 0..1
  currentParagraphIndex: number;
  startedAt: number | null;
  finishedAt: number | null;
  actualWpmSamples: number[];
  fonts: FontSettings;
  answers: QuestionAnswer[];
  quizQuestionCount: number;
  settingsPanelOpen: boolean;
  breakStats: BreakStats | null;
  /** Chosen BEFORE a session starts: Start opens the free-scroll article view (/read) instead of the auto-scroll reader. */
  readingMode: boolean;
  /** Reading-mode stopwatch (ms of real reading time on /read); independent of scroll position. */
  readingElapsedMs: number;
}

type Action =
  | { type: "LOAD_STORY"; story: StoryData }
  | { type: "SET_READING_MODE"; on: boolean }
  | { type: "SET_READING_ELAPSED"; ms: number }
  | { type: "SET_WPM"; wpm: number }
  | { type: "PLAY" }
  | { type: "PAUSE" }
  | { type: "RESTART" }
  | { type: "SET_PROGRESS"; progress: number; paragraphIndex: number }
  | { type: "SAMPLE_WPM"; wpm: number }
  | { type: "COMPLETE" }
  | { type: "GO_TO_QUESTIONS"; quizQuestionCount: number }
  | { type: "ANSWER_QUESTION"; answer: QuestionAnswer }
  | { type: "GO_TO_RESULTS" }
  | { type: "UPDATE_FONTS"; fonts: Partial<FontSettings> }
  | { type: "RESET_FONTS_TO_DEFAULT" }
  | { type: "TOGGLE_SETTINGS_PANEL"; open?: boolean }
  | { type: "SET_BREAK_STATS"; stats: BreakStats }
  | { type: "RESET_TO_DASHBOARD" }
  | { type: "CLEAR_STORY" };

const defaultFonts: FontSettings = {
  family: "serif",
  size: 48,
  lineHeight: 1.8,
  letterSpacing: 0,
  contentWidth: 65,
  brightness: "dark",
  focusMode: false,
  guideLine: false,
};

const initialState: ReadingState = {
  phase: "dashboard",
  story: null,
  selectedWpm: 250,
  isPlaying: false,
  progress: 0,
  currentParagraphIndex: 0,
  startedAt: null,
  finishedAt: null,
  actualWpmSamples: [],
  fonts: defaultFonts,
  answers: [],
  quizQuestionCount: 5,
  settingsPanelOpen: false,
  breakStats: null,
  readingMode: false,
  readingElapsedMs: 0,
};

function reducer(state: ReadingState, action: Action): ReadingState {
  switch (action.type) {
    case "LOAD_STORY":
      return { ...initialState, fonts: state.fonts, readingMode: state.readingMode, story: action.story, phase: "dashboard" };
    case "SET_READING_ELAPSED":
      return { ...state, readingElapsedMs: action.ms };
    case "SET_READING_MODE":
      // Locked once a practice session has started: the toggle is not offered then (see TopNav).
      return state.phase === "reading" || state.phase === "completed" ? state : { ...state, readingMode: action.on };
    case "SET_WPM":
      return { ...state, selectedWpm: Math.min(1000, Math.max(50, action.wpm)) };
    case "PLAY":
      return {
        ...state,
        isPlaying: true,
        phase: "reading",
        startedAt: state.startedAt ?? Date.now(),
      };
    case "PAUSE":
      return { ...state, isPlaying: false };
    case "RESTART":
      // Bug fix: this used to set phase back to "dashboard", but the reader
      // route only renders the Reader/Controls tree when phase === "reading"
      // (and the completion overlay when phase === "completed"). Restarting
      // therefore matched neither branch and produced a blank screen. The
      // fix is to stay in "reading" and resume playback immediately, which
      // is also the behavior the brief asks for ("restart auto-scroll from
      // the beginning ... display the story immediately").
      return {
        ...state,
        progress: 0,
        currentParagraphIndex: 0,
        startedAt: Date.now(),
        finishedAt: null,
        isPlaying: true,
        actualWpmSamples: [],
        phase: "reading",
      };
    case "SET_PROGRESS":
      return { ...state, progress: action.progress, currentParagraphIndex: action.paragraphIndex };
    case "SAMPLE_WPM":
      return { ...state, actualWpmSamples: [...state.actualWpmSamples, action.wpm].slice(-30) };
    case "COMPLETE":
      return { ...state, isPlaying: false, phase: "completed", finishedAt: Date.now(), progress: 1 };
    case "GO_TO_QUESTIONS":
      return { ...state, phase: "questions", quizQuestionCount: action.quizQuestionCount, answers: [] };
    case "ANSWER_QUESTION": {
      const others = state.answers.filter((a) => a.questionIndex !== action.answer.questionIndex);
      return { ...state, answers: [...others, action.answer] };
    }
    case "GO_TO_RESULTS":
      return { ...state, phase: "results" };
    case "UPDATE_FONTS":
      return { ...state, fonts: { ...state.fonts, ...action.fonts } };
    case "RESET_FONTS_TO_DEFAULT":
      // Speed is deliberately left untouched — the brief marks it optional,
      // and resetting it mid-session would be a surprising side effect of
      // what's presented as a "reading customization" reset.
      return { ...state, fonts: defaultFonts };
    case "TOGGLE_SETTINGS_PANEL":
      return { ...state, settingsPanelOpen: action.open ?? !state.settingsPanelOpen };
    case "SET_BREAK_STATS":
      return { ...state, breakStats: action.stats };
    case "RESET_TO_DASHBOARD":
      return { ...initialState, story: state.story, fonts: state.fonts, readingMode: state.readingMode };
    // Clears the loaded story entirely, returning to the search landing
    // page (see SearchLanding.tsx) — added so there's an actual way back
    // to "/" with no story loaded (the navbar logo, see TopNav.tsx) now
    // that the social-features phase's test flow expects to navigate away
    // from and back to the landing page within one session, not just on a
    // fresh load.
    case "CLEAR_STORY":
      return { ...initialState, fonts: state.fonts, readingMode: state.readingMode };
    default:
      return state;
  }
}

const StateContext = createContext<ReadingState | null>(null);
const DispatchContext = createContext<React.Dispatch<Action> | null>(null);

export function ReadingProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const memoState = useMemo(() => state, [state]);
  return (
    <StateContext.Provider value={memoState}>
      <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
    </StateContext.Provider>
  );
}

export function useReadingState() {
  const ctx = useContext(StateContext);
  if (!ctx) throw new Error("useReadingState must be used within ReadingProvider");
  return ctx;
}

export function useReadingDispatch() {
  const ctx = useContext(DispatchContext);
  if (!ctx) throw new Error("useReadingDispatch must be used within ReadingProvider");
  return ctx;
}
