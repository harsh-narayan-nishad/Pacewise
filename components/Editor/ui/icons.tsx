import * as React from "react";

const P: Record<string, string> = {
  undo: "M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3",
  redo: "m15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3",
  bold: "M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z",
  italic: "M19 4h-9M14 20H5M15 4 9 20",
  underline: "M7 4v7a5 5 0 0 0 10 0V4M5 21h14",
  strike: "M16 6a4 3 0 0 0-8 1c0 4 8 3 8 8a4 3 0 0 1-8 1M4 12h16",
  sub: "m4 5 8 9M12 5l-8 9M20 21h-4c0-2 4-2 4-4.5a2 2 0 0 0-4 0",
  sup: "m4 9 8 9M12 9l-8 9M20 8h-4c0-2 4-2 4-4.5a2 2 0 0 0-4 0",
  alignL: "M4 6h16M4 10h10M4 14h16M4 18h10",
  alignC: "M4 6h16M7 10h10M4 14h16M7 18h10",
  alignR: "M4 6h16M10 10h10M4 14h16M10 18h10",
  alignJ: "M4 6h16M4 10h16M4 14h16M4 18h16",
  ul: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01",
  ol: "M10 6h10M10 12h10M10 18h10M4 5l1-1v4M3.5 13.5c.5-1.5 2.5-1 2.5.3 0 1-2.5 1.7-2.5 2.7h2.5",
  check: "m4 7 2 2 3-3M4 17l2 2 3-3M12 7h8M12 17h8",
  indent: "M4 6h16M12 10h8M12 14h8M4 18h16m-16-8 4 2-4 2z",
  outdent: "M4 6h16M12 10h8M12 14h8M4 18h16m4-8-4 2 4 2z",
  clear: "m6 4 12 16M4 20h6M13 4h7M10 4l-2 7",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  image: "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9h.01",
  table: "M4 5h16v14H4zM4 11h16M4 15h16M10 5v14",
  code: "m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14",
  hr: "M4 12h16",
  pagebreak: "M4 12h3M10 12h4M17 12h3M8 4v4M16 4v4M8 16v4M16 16v4",
  symbol: "M6 18c0-6 3-6 3-12M10 18h8M14 6a3 3 0 1 1 3 3",
  math: "M5 7h8M9 3v8M5 19h8M15 15l5 5M20 15l-5 5",
  footnote: "M5 20V6h9M5 12h7M18 6v6M18 20h.01",
  find: "m21 21-4.3-4.3M17 11a6 6 0 1 1-12 0 6 6 0 0 1 12 0",
  full: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  exitfull: "M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5",
  folder: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  save: "M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6",
  download: "M12 4v11m0 0-4-4m4 4 4-4M5 20h14",
  upload: "M12 16V5m0 0-4 4m4-4 4 4M5 20h14",
  outline: "M4 6h16M8 10h12M8 14h12M4 18h16",
  color: "M6 20 12 4l6 16M8 14h8",
  highlight: "m9 11 6 6M4 20l5-1 9-9-4-4-9 9zM14 6l4 4",
  plus: "M12 5v14M5 12h14",
  close: "M6 6l12 12M18 6 6 18",
  copy: "M8 8h11v12H8zM5 16V4h11",
  trash: "M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-2-4-2 .5-1-1 .5-2-4-1-1 2h-2L8 3 4 4l.5 2-1 1L1.5 6.5l-1 4 2 1v2l-2 1 1 4 2-.5 1 1-.5 2 4 1 1-2h2l1 2 4-1-.5-2 1-1 2 .5z",
  print: "M7 9V4h10v5M7 17H5v-6h14v6h-2M7 14h10v6H7z",
  page: "M6 3h9l4 4v14H6zM15 3v4h4",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
};

export type IconName = keyof typeof P;

export function Icon({ name }: { name: IconName }): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={P[name]} />
    </svg>
  );
}
