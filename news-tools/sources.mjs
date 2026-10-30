// Source registry for the Cyber News aggregator.
// Only official RSS/Atom feeds are used. No website scraping. No invented URLs.
//
// "verified" notes (checked 29 Oct 2026 by fetching the feed from the development environment):
//   thn, bleeping, krebs, darkreading -> returned a valid RSS feed with current articles.
//   securityweek -> blocked the automated check there (bot protection). The URL is SecurityWeek's public feed,
//                   but it may also refuse your server. Run `npm run diagnose` to see the real result.
//   cisa         -> could not be fetched in the development environment. URL is CISA's published advisory feed.
//                   Run `npm run diagnose` to see the real result.
//
// CERT-In (India) is NOT listed: no official RSS/API feed from CERT-In could be confirmed, so no URL is guessed.
// When you find the official feed URL, add one entry below (copy the CISA one, kind: "official", region: "india").
export const SOURCES = [
  {
    id: "thn", name: "The Hacker News", publisher: "The Hacker News",
    url: "https://thehackernews.com/feeds/posts/default",
    kind: "media", region: "global", filter: null, verified: true,
  },
  {
    id: "bleeping", name: "BleepingComputer", publisher: "BleepingComputer",
    url: "https://www.bleepingcomputer.com/feed/",
    kind: "media", region: "global", filter: null, verified: true,
  },
  {
    id: "krebs", name: "Krebs on Security", publisher: "KrebsOnSecurity",
    url: "https://krebsonsecurity.com/feed/",
    kind: "media", region: "global", filter: null, verified: true,
  },
  {
    id: "securityweek", name: "SecurityWeek", publisher: "SecurityWeek",
    url: "https://www.securityweek.com/feed/",
    kind: "media", region: "global", filter: null, verified: false,
  },
  {
    id: "darkreading", name: "Dark Reading", publisher: "Dark Reading",
    url: "https://www.darkreading.com/rss.xml",
    kind: "media", region: "global", filter: null, verified: true,
  },
  {
    id: "cisa", name: "CISA Cybersecurity Advisories", publisher: "CISA (US government)",
    url: "https://www.cisa.gov/cybersecurity-advisories/all.xml",
    kind: "official", region: "global", filter: null, verified: false,
  },
];
