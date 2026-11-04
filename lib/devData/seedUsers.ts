import { DevUser } from "@/lib/devData/types";

/**
 * ============================================================================
 * DEVELOPMENT-ONLY DEMO ACCOUNTS — NOT REAL CREDENTIALS
 * ============================================================================
 * These 100 users and passwords exist purely so this development build has
 * something to log in as while there is no real backend/auth provider.
 *
 *   - Every password below is a synthetic, randomly-shaped development
 *     string (never a real password belonging to anyone, never reused from
 *     any other system) and is shown in full in README.md's "Development
 *     demo accounts" section so anyone running this build locally can log
 *     in immediately.
 *   - `isDemoUser: true` is set on every record and is checked by the
 *     (equally temporary) login screen — see lib/devData/store.ts's
 *     `login()` — so there is no code path that treats one of these as a
 *     real account.
 *   - In production this entire file is deleted, not hardened: real
 *     accounts come from a real identity provider / backend with hashed,
 *     salted, individually-chosen credentials. Nothing here should ever
 *     reach a production build.
 * ============================================================================
 */

interface SeedUser {
  id: string;
  name: string;
  username: string;
  password: string;
  interests: string[];
}

// Interest tags deliberately overlap the content library's own tags/level
// strings (see lib/devData/contentMeta.ts) so the interest-based feed in
// Phase 4 has real matches to rank by, not just a fallback "no matches"
// list for a library this small.
const INTEREST_POOL = [
  "fiction",
  "nature",
  "mystery",
  "adventure",
  "technology",
  "science",
  "history",
  "coastal",
  "short-story",
  "biology",
  "drama",
  "art",
];

function interestsFor(seedIndex: number, extra: string[]): string[] {
  const rotating = [
    INTEREST_POOL[seedIndex % INTEREST_POOL.length],
    INTEREST_POOL[(seedIndex + 3) % INTEREST_POOL.length],
  ];
  return Array.from(new Set([...extra, ...rotating]));
}

const NAMED_USERS: Omit<SeedUser, "password">[] = [
  { id: "user-001", name: "Dinesh Kushwaha", username: "dinesh.kushwaha", interests: interestsFor(0, ["technology", "fiction"]) },
  { id: "user-002", name: "Harsh Narayan Nishad", username: "harsh.nishad", interests: interestsFor(1, ["fiction", "technology"]) },
  { id: "user-003", name: "Aashwi", username: "aashwi", interests: interestsFor(2, ["nature", "art"]) },
  { id: "user-004", name: "Sushama", username: "sushama", interests: interestsFor(3, ["mystery", "drama"]) },
  { id: "user-005", name: "Samriddhi", username: "samriddhi", interests: interestsFor(4, ["adventure", "nature"]) },
  { id: "user-006", name: "Akhilesh Saini", username: "akhilesh.saini", interests: interestsFor(5, ["coastal", "nature"]) },
  { id: "user-007", name: "Akash Nishad", username: "akash.nishad", interests: interestsFor(6, ["fiction", "biology"]) },
  { id: "user-008", name: "Janhavi", username: "janhavi", interests: interestsFor(7, ["drama", "short-story"]) },
  { id: "user-009", name: "Hariom Nathani", username: "hariom.nathani", interests: interestsFor(9, []) },
];

const GENERIC_USERS: Omit<SeedUser, "password">[] = Array.from({ length: 11 }, (_, i) => {
  const n = i + 10; // User 10..User 20
  return {
    id: `user-${String(n).padStart(3, "0")}`,
    name: `User ${n}`,
    username: `user${n}`,
    interests: interestsFor(n, []),
  };
});

/** Demo passwords for accounts 001–020. Every password in this file is
 *  deliberately easy to type AND different in shape from every other one
 *  (word, number and symbol placement, casing and separators all vary), so no
 *  two accounts follow the same pattern. Full list: docs/DEMO_ACCOUNTS.csv. */
const ORIGINAL_PASSWORDS: Readonly<Record<string, string>> = {
  "user-001": "4walnut.zebra",
  "user-002": "@7141spider",
  "user-003": ".Ribbon_Lemon",
  "user-004": "Eagle8522*",
  "user-005": "29sunnyGinger&",
  "user-006": "ZEBRA_58_MOVIE&",
  "user-007": "summer76marble_",
  "user-008": "&Flower879",
  "user-009": "Lantern.46Cedar",
  "user-010": "Apple39",
  "user-011": "Jersey39#",
  "user-012": "%8Yellow.Ladder",
  "user-013": "#jersey68",
  "user-014": "FEATHER_YELLOW",
  "user-015": "Movie-Nickel7?",
  "user-016": "!8bottle",
  "user-017": "@river.cherry4",
  "user-018": "&6quartzlemon",
  "user-019": "@2989schoolSunny",
  "user-020": "$ginger472"
};

const ORIGINAL_USERS: SeedUser[] = [...NAMED_USERS, ...GENERIC_USERS].map((u) => ({
  ...u,
  password: ORIGINAL_PASSWORDS[u.id],
}));

/** Accounts 021–100. Unlike 001–020 (pattern passwords documented in the
 *  README) these passwords are deliberately easy (and unique in format) because they exist only for quick testing. They are plaintext
 *  DEV-ONLY demo data that ships inside the client bundle — see the banner at
 *  the top of this file — so they protect nothing; real accounts need a
 *  backend with hashed credentials. The full list is in docs/DEMO_ACCOUNTS.csv. */
const EXTRA_ROWS: ReadonlyArray<readonly [string, string, string, string]> = [
  ["user-021", "Ankit Sahani", "ankit.sahani", "PENCIL5-"],
  ["user-022", "User 22", "user22", "#252bridge"],
  ["user-023", "User 23", "user23", "&POCKET.FALCON1"],
  ["user-024", "User 24", "user24", "*kitten"],
  ["user-025", "User 25", "user25", "3ANCHOR"],
  ["user-026", "User 26", "user26", "%Magnet9142"],
  ["user-027", "User 27", "user27", "#44peanut-saddle"],
  ["user-028", "User 28", "user28", "985PIZZA#"],
  ["user-029", "User 29", "user29", "mirror#"],
  ["user-030", "User 30", "user30", "PURPLE6%"],
  ["user-031", "User 31", "user31", "Parrot4?"],
  ["user-032", "User 32", "user32", "#tiger_rainbow7"],
  ["user-033", "User 33", "user33", "?apple-coffee"],
  ["user-034", "User 34", "user34", ".breeze"],
  ["user-035", "User 35", "user35", "Walnut-Panda"],
  ["user-036", "User 36", "user36", "94garden$"],
  ["user-037", "User 37", "user37", "@wizard"],
  ["user-038", "User 38", "user38", "&igloo-Orange15"],
  ["user-039", "User 39", "user39", "Laptop.Velvet2$"],
  ["user-040", "User 40", "user40", "%8Desert-Cloud"],
  ["user-041", "User 41", "user41", "427ZIPPERCANDY"],
  ["user-042", "User 42", "user42", "4zipper%"],
  ["user-043", "User 43", "user43", "4Tunnel!"],
  ["user-044", "User 44", "user44", "$SUNNY"],
  ["user-045", "User 45", "user45", "-MANGO6763"],
  ["user-046", "User 46", "user46", "2PARROTGUITAR?"],
  ["user-047", "User 47", "user47", "3MONKEY.LADDER$"],
  ["user-048", "User 48", "user48", "Garden8957Rabbit"],
  ["user-049", "User 49", "user49", "movie8%"],
  ["user-050", "User 50", "user50", "9whistlenickel."],
  ["user-051", "User 51", "user51", "$VIOLET_TUNNEL"],
  ["user-052", "User 52", "user52", "&Window14"],
  ["user-053", "User 53", "user53", "VELVET*"],
  ["user-054", "User 54", "user54", "?9Mango"],
  ["user-055", "User 55", "user55", "952YouthSilver*"],
  ["user-056", "User 56", "user56", "yellowneedle?"],
  ["user-057", "User 57", "user57", "@rocket-cloud"],
  ["user-058", "User 58", "user58", "?Blanket"],
  ["user-059", "User 59", "user59", ".YOGURT164"],
  ["user-060", "User 60", "user60", "PEANUTCRICKET3@"],
  ["user-061", "User 61", "user61", "89Office.Breeze_"],
  ["user-062", "User 62", "user62", "73Insect-Cherry#"],
  ["user-063", "User 63", "user63", "&136office"],
  ["user-064", "User 64", "user64", "89eagle-"],
  ["user-065", "User 65", "user65", "TOMATO9791"],
  ["user-066", "User 66", "user66", "WIZARD@"],
  ["user-067", "User 67", "user67", ".Peanut25"],
  ["user-068", "User 68", "user68", "_helmet7"],
  ["user-069", "User 69", "user69", "tomato93_"],
  ["user-070", "User 70", "user70", "PANDA1"],
  ["user-071", "User 71", "user71", "8123KITTEN"],
  ["user-072", "User 72", "user72", ".ladder6658"],
  ["user-073", "User 73", "user73", "%dolphin76"],
  ["user-074", "User 74", "user74", "CandyEngine*"],
  ["user-075", "User 75", "user75", "Violet-Spider!"],
  ["user-076", "User 76", "user76", "99island-Purple@"],
  ["user-077", "User 77", "user77", "JUNGLE-PUZZLE%"],
  ["user-078", "User 78", "user78", "magnet_Quartz76$"],
  ["user-079", "User 79", "user79", "engineyouth!"],
  ["user-080", "User 80", "user80", "!jungle5315"],
  ["user-081", "User 81", "user81", "?basket144"],
  ["user-082", "User 82", "user82", "$5758donkey"],
  ["user-083", "User 83", "user83", "_COFFEE.SADDLE2"],
  ["user-084", "User 84", "user84", "$2fridge"],
  ["user-085", "User 85", "user85", "silver?"],
  ["user-086", "User 86", "user86", "@LEMON55"],
  ["user-087", "User 87", "user87", "candy?"],
  ["user-088", "User 88", "user88", "!NICKEL5673"],
  ["user-089", "User 89", "user89", "CHERRY_DRAGON1!"],
  ["user-090", "User 90", "user90", "winter1!"],
  ["user-091", "User 91", "user91", ".Island5"],
  ["user-092", "User 92", "user92", "$4mango-kernel"],
  ["user-093", "User 93", "user93", "RIBBON2"],
  ["user-094", "User 94", "user94", "$HAMMER-JACKET"],
  ["user-095", "User 95", "user95", "feather_"],
  ["user-096", "User 96", "user96", ".17forest"],
  ["user-097", "User 97", "user97", "SILVER171_"],
  ["user-098", "User 98", "user98", "QUARTZ-SCHOOL#"],
  ["user-099", "User 99", "user99", "63MUSIC*"],
  ["user-100", "User 100", "user100", "Puzzle.Bottle3_"]
];

const EXTRA_USERS: SeedUser[] = EXTRA_ROWS.map(([id, name, username, password], i) => ({
  id,
  name,
  username,
  password,
  interests: interestsFor(20 + i, i === 0 ? ["technology", "fiction"] : []),
}));

const ALL_SEED_USERS: SeedUser[] = [...ORIGINAL_USERS, ...EXTRA_USERS];

export const SEED_USERS: DevUser[] = ALL_SEED_USERS.map((u) => ({
  id: u.id,
  name: u.name,
  username: u.username,
  password: u.password,
  interests: u.interests,
  isDemoUser: true as const,
}));

/** Lookup convenience — same stable-id-keyed convention as every other
 *  accessor in lib/devData (never iterate-and-index). */
export function getSeedUserById(id: string): DevUser | undefined {
  return SEED_USERS.find((u) => u.id === id);
}
