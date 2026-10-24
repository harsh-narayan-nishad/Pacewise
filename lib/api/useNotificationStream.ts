"use client";

import { useEffect, useRef } from "react";
import { API_BASE_URL, isApiEnabled } from "@/lib/api/config";
import { tokenStore } from "@/lib/api/tokenStore";
import { notificationsApi } from "@/lib/api/endpoints";
import { ApiNotification } from "@/lib/api/types";

/**
 * Subscribes to the backend's live notification stream (SSE) for as long
 * as the calling component is mounted and the user is signed in with a
 * real backend account. The browser's native `EventSource` reconnects
 * automatically on a dropped connection, so there's no manual retry logic
 * here — this hook's only job is open-on-mount / close-on-unmount and
 * handing each parsed event to the caller.
 */
export function useNotificationStream(
  isAuthenticated: boolean,
  onNotification: (notification: ApiNotification) => void
): void {
  const callbackRef = useRef(onNotification);
  callbackRef.current = onNotification;

  useEffect(() => {
    if (!isApiEnabled() || !isAuthenticated) return;
    const accessToken = tokenStore.getAccessToken();
    if (!accessToken) return;

    const source = new EventSource(notificationsApi.streamUrl(API_BASE_URL, accessToken));
    // The backend sends a *named* SSE event ("event: notification", see
    // notifications.controller.ts's stream handler) rather than the
    // unnamed/default event type, so this must be addEventListener, not
    // EventSource's own `.onmessage` (which only fires for default events).
    const handleNotification = (event: MessageEvent<string>) => {
      try {
        const notification = JSON.parse(event.data) as ApiNotification;
        callbackRef.current(notification);
      } catch {
        // Malformed payload — ignore.
      }
    };
    source.addEventListener("notification", handleNotification);
    // Deliberately no onerror handler that closes the connection:
    // EventSource retries on its own, and closing here would fight that.

    return () => {
      source.removeEventListener("notification", handleNotification);
      source.close();
    };
  }, [isAuthenticated]);
}
