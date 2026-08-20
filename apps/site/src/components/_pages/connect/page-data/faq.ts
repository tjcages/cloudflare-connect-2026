import { REGISTER_URL } from "../data";

export type ConnectFaqItem = { question: string; answer: string };
export type ConnectFaqGroup = { title: string; items: ConnectFaqItem[] };

export const faqPageMeta = {
  title: "FAQ - Cloudflare Connect 2026 | Cloudflare",
  description:
    "Cloudflare Connect 2026 FAQ — Frequently Asked Questions about the event.",
};

export const faqHero = {
  eyebrow: "FAQ",
  title: "Frequently asked questions",
  body: "Registration, venue, University, and what to expect at Connect 2026.",
  primaryCta: { text: "Register Now", href: REGISTER_URL },
  secondaryCta: {
    text: "Convince your boss",
    href: "/connect/convince-your-boss",
  },
};

export const faqGroups: ConnectFaqGroup[] = [
  {
    title: "General",
    items: [
      {
        question: "When and where is Cloudflare Connect 2026?",
        answer:
          "Cloudflare Connect 2026 is in San Francisco from October 19 \u2013 21, 2026.",
      },
      {
        question: "Who can attend Connect?",
        answer:
          "Cloudflare Connect 2026 is designed for the architects of the modern Internet. Whether you are a security practitioner defending against the latest threats, a developer building the next generation of AI-native apps, or a technology leader transforming your organization with the connectivity cloud, there is a place for you at Cloudflare Connect. Attendees must be 21+ years old to attend.",
      },
      {
        question: "Is there a digital component?",
        answer:
          "Cloudflare Connect 2026 is a premium, in-person experience designed for high-bandwidth networking. The full breakout sessions and certification tracks are exclusive to on-site attendees. Select keynote highlights will be available post-event.",
      },
    ],
  },
  {
    title: "Registration and pricing",
    items: [
      {
        question: "What is the investment for Connect 2026?",
        answer: `Conference Pass: $595
Public Sector Pass: $100 off (requires a valid .gov, .mil, .org, or .edu email)
Cloudflare University: additional $495`,
      },
      {
        question: "What does my pass unlock?",
        answer:
          "Full access to all keynotes, technical breakouts, the Expo Hall, conference meals, exclusive 2026 swag, and our legendary Cloudflare after Dark @ Connect.",
      },
      {
        question: "How do I secure the public sector rate?",
        answer:
          "If you are a builder in government or education, use your official .gov, .mil, .org, or .edu email during registration to automatically apply the $100 discount.",
      },
      {
        question: "How do I justify my trip?",
        answer:
          "Need help getting the green light to join us in San Francisco? Use the Convince your boss templates to show your leadership team how Cloudflare Connect 2026 will help your organization build a faster, more secure future.",
      },
      {
        question: "Can I transfer my ticket to someone else?",
        answer:
          "Yes. If you are no longer able to attend, you can transfer your registration to a colleague. Please email our events team at connect-sf@cloudflare.com with your registration confirmation number and the name/email of the person taking your place.",
      },
      {
        question: "Who do I contact for registration support?",
        answer:
          "Still have questions? Our Events team is on standby. Email connect-sf@cloudflare.com.",
      },
    ],
  },
  {
    title: "Cloudflare University (certification and training)",
    items: [
      {
        question: "How do I get Cloudflare Certified?",
        answer:
          "Level up your credentials by adding a University Pass to your registration. This grants you access to full-day, expert-led intensive training and the official certification exams.",
      },
      {
        question: "What is the University Pass pricing?",
        answer: "University Pass: $495 (added to your conference pass pricing)",
      },
      {
        question: "Can I add the University Pass later?",
        answer:
          "Seats for Cloudflare University are limited to ensure a high-touch learning environment. We recommend bundling during your initial registration to secure your spot before they sell out. However, you can still add the workshop to your pass later if seats are still available.",
      },
      {
        question: "What will the training cover, and how is it structured?",
        answer:
          "Training sessions will focus on Cloudflare Application Security and Cloudflare One / Zero Trust Solutions. A full schedule will be released ahead of the event.",
      },
      {
        question:
          "Will the training prepare me to pass the certification exam?",
        answer:
          "Training sessions provide valuable insight, but each exam is designed to assess your hands-on knowledge. We recommend prior experience with the Cloudflare products covered by your chosen exam. We'll share preparation resources for both exams before the event.",
      },
      {
        question: "What is the value of getting Cloudflare certified?",
        answer:
          "Getting a Cloudflare Certification demonstrates your knowledge and skills, as well as showing that you're committed to self-development. You can show off this recognition to your employer, on your resume, and on LinkedIn.",
      },
      {
        question: "Can I buy a University Pass just to take the exam?",
        answer:
          "Yes. The University Pass includes both training and one exam attempt. If you're only interested in certification, we recommend you wait to take the standalone exam after Connect.",
      },
      {
        question:
          "Can I attend training or take the exam without a University Pass?",
        answer:
          "No. The University Pass is required for access to both training sessions and the on-site certification exam.",
      },
      {
        question: "What do I need to bring for the certification exam?",
        answer:
          "You'll need to bring your own laptop, power adapter, and personal identification such as a driver's license or passport.",
      },
      {
        question: "What if I don't pass the certification exam at Connect?",
        answer:
          "You can retake the exam at a later date by scheduling a separate exam session. Retake fees are not included in the University Pass.",
      },
    ],
  },
  {
    title: "Experience and logistics",
    items: [
      {
        question:
          "When should I plan to arrive and depart for Cloudflare Connect?",
        answer: `If you are attending Cloudflare University or Partner Summit, please plan to arrive on Sunday, October 18.

If you are attending only Cloudflare Connect, please plan to arrive by 3:00 PM on Monday, October 19 so you can join the Welcome Reception, which begins at 5:00 PM.

The event concludes with Func(tion), our closing party at Oracle Park, on Wednesday evening, October 21. Please plan to depart on Thursday, October 22.`,
      },
      {
        question: "What's the vibe (and the dress code)?",
        answer:
          'Think "San Francisco tech professional." Comfortable shoes are a must for the Expo Hall, and layers are recommended for Bay Area micro-climates.',
      },
      {
        question: "Will there be space for 1:1s with experts?",
        answer:
          'Yes. Beyond the sessions, we have dedicated "Expert Zones" in the Expo Hall, where you can whiteboard your toughest architectural challenges with Cloudflare engineers.',
      },
      {
        question: "May I request accessibility accommodations?",
        answer:
          "Absolutely. Cloudflare is committed to providing an inclusive and accessible experience for all attendees. If you require specific accommodations\u2014such as ASL interpretation, assistive listening devices, or dietary requirements\u2014please reach out to us at connect-sf@cloudflare.com.",
      },
    ],
  },
  {
    title: "Venue and location",
    items: [
      {
        question: "Are there negotiated rates at any local hotels?",
        answer: `Yes, you can secure discounted rates by booking your accommodations directly during the registration process. We have partnered with several premier hotel brands in San Francisco to provide a variety of options for our attendees, with prices in our hotel block ranging from $279 to $325 per night.

Our official hotel partners include:
Marriott
IHG Hotels
Hilton
World of Hyatt`,
      },
      {
        question: "How do I book my room?",
        answer:
          "Once you begin your registration, you will be prompted to select your preferred hotel from our curated list. Booking through the official portal ensures you receive the pre-negotiated event rate.",
      },
      {
        question: "How can I manage my hotel reservation?",
        answer:
          "You can make updates to your hotel reservation via your registration profile or through your hotel confirmation email by our cutoff date, September 28, 2026. After September 28, 2026, when our group's reservations are turned over to the hotels, you will contact the hotel directly for any reservation changes.",
      },
      {
        question: "What is the deadline for the discounted rate?",
        answer:
          "Discounted room blocks for our conference attendees are available until September 28, 2026, or until the group block is sold out. While rates are secured for our group, they are available on a first-come, first-served basis. We recommend booking as soon as possible, as rooms in the downtown San Francisco area fill up quickly.",
      },
      {
        question: "Can I book a room directly with the hotel?",
        answer:
          "To receive the Connect SF discounted rates, you must book through the official registration link, and please do not contact the hotel. Rates offered directly on hotel websites or through third-party travel sites may be higher and do not count toward our event room block.",
      },
      {
        question: "Are the hotels near the venue?",
        answer:
          "Yes, all our partner hotels are located within a short distance of the main event site, with many accessible via a brief walk or a quick ride on public transit (BART/Muni). You will be able to view the hotel distance to the Moscone West during the booking process.",
      },
    ],
  },
];

export const faqContactEmail = "connect-sf@cloudflare.com";
