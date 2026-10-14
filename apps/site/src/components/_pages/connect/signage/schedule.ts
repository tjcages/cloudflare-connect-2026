/** Copy supplied by the event team. Wednesday has no card: just the logo and title. */
export const HUB_HOURS: readonly {
  day: string;
  lines: readonly string[];
  sponsor?: { name: string; logo: string; aspect: number };
}[] = [
  { day: "Monday", lines: ["Welcome Reception", "5 PM – 7 PM"] },
  {
    day: "Tuesday",
    lines: ["Happy Hour", "5 PM in the Hub"],
    sponsor: {
      name: "MiTAC Computing",
      logo: "/connect/signage-sponsor-mitac.png",
      aspect: 1140 / 320,
    },
  },
  { day: "Wednesday", lines: [] },
];
