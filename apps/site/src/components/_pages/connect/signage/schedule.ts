/** The Hub copy supplied by the event team. Happy Hour is Tuesday only. */
export const HUB_HOURS = [
  { day: "Monday - Welcome Reception", hours: "5 PM – 7 PM" },
  { day: "Tuesday", hours: "9 AM – 5 PM", happyHour: true },
  { day: "Wednesday", hours: "9 AM – 5 PM" },
] as const;

export const HAPPY_HOUR_LABEL = "Happy Hour";
export const HAPPY_HOUR_TIME = "5 PM in the Hub";
