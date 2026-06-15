export const navItems = [
  { id: "sessions", label: "Sessions" },
  { id: "ask", label: "Ask" },
  { id: "automations", label: "Automations" },
  { id: "review", label: "Review" },
  { id: "wiki", label: "Wiki" },
] as const;

export type NavId = (typeof navItems)[number]["id"];

export const recentEmptyLabels: Record<NavId, string> = {
  sessions: "No sessions",
  ask: "No asks",
  automations: "No automations",
  review: "",
  wiki: "No wikis",
};
