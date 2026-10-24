"use client";

import React from "react";
import { StoryCarousel } from "@/components/Landing/StoryCarousel";

/**
 * The strip of stories right under the landing hero: up to seven cards in a
 * horizontal carousel (see components/Landing/StoryCarousel.tsx). The generic
 * paged grid is still available as `components/Feed/PersonalizedFeed.tsx` for
 * any screen that wants a full list.
 */
export function ContentFeed() {
  return <StoryCarousel />;
}
