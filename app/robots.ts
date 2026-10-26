import type { MetadataRoute } from "next";

/** Only the public landing page is meant to be indexed; account and reading pages are not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/dashboard", "/profile/", "/history", "/reading-history", "/analytics", "/settings", "/results", "/questions", "/reader", "/read"] }],
  };
}
