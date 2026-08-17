import { REGISTER_URL } from "../data";

export const universityPageMeta = {
  title: "Cloudflare University - Cloudflare Connect 2026 | Cloudflare",
  description:
    "Cloudflare University — training and certification exams for Application Security and Zero Trust at Connect 2026.",
};

export const universityHero = {
  eyebrow: "University",
  title: "Cloudflare University",
  body: "Deepen your Connect experience with technical training and certification built to level you up and prove your expertise.",
  primaryCta: { text: "Add University", href: REGISTER_URL },
  secondaryCta: { text: "See FAQs", href: "#faq" },
};

export const universityWhy = {
  title: "Practical training for real challenges",
  body: "A full-day program for engineers who want practical skills, not theory. Learn in a live, collaborative environment built around real Cloudflare architecture decisions. Focus on application security and zero trust, then validate your skills with on-site certification opportunities during Connect week.",
  features: [
    {
      iconName: "organisation" as const,
      title: "Expert guidance",
      body: "Learn directly from Cloudflare team members through guided interactions and practical setups.",
    },
    {
      iconName: "window-square-security" as const,
      title: "Validated skills",
      body: "Opportunity to take the Application Security Associate and Zero Trust Associate certification exams on-site and earn credentials.",
    },
  ],
};

export const universitySchedule = {
  title: "The schedule",
  body: "A focused Monday training day, followed by exam windows that fit around your Connect agenda.",
  days: [
    {
      date: "Oct 19",
      label: "Monday",
      title: "Full day of training",
      body: "Instructor-led classes and certification exams.",
    },
    {
      date: "Oct 20–22",
      label: "Tuesday & Wednesday",
      title: "Certification only",
      body: "Sit for certification exams on-site.",
    },
  ],
};

export const universityIncluded = {
  title: "What is included with your University pass?",
  intro:
    "Your $495 University Pass (Early Bird pricing available until June 30) includes:",
  items: [
    {
      iconName: "console" as const,
      title: "Live technical training",
      body: "Access to all sessions on Application Security and Cloudflare One / Zero Trust Solutions.",
    },
    {
      iconName: "sparkle-hightlight" as const,
      title: "Dual certification opportunity",
      body: "One attempt at both the Application Security Associate and Zero Trust Associate exams.",
    },
    {
      iconName: "server" as const,
      title: "In-person proctoring",
      body: "A private, quiet environment to sit for your exams with live support.",
    },
    {
      iconName: "collaboration-pointer-left" as const,
      title: "Expert access",
      body: "Direct Q&A with Cloudflare’s technical instructors.",
    },
  ],
  note: "Laptops are required for all sessions and certification exams.",
};

export const universityFaq = [
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
    question: "Will the training prepare me to pass the certification exam?",
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
];
