import { REGISTER_URL } from "../data";

export const partnerPageMeta = {
  title: "Partner Summit: Cloudflare Connect 2026 | Cloudflare",
  description:
    "Cloudflare Global Partner Summit 2026 — connect with leadership and accelerate your business.",
};

export const partnerHero = {
  eyebrow: "Oct 19, 2026 · Moscone West, San Francisco",
  title: "Cloudflare Global Partner Summit",
  body: "Your future is better with Cloudflare. Free for active partners.",
  primaryCta: { text: "Register for Partner Summit", href: REGISTER_URL },
  secondaryCta: { text: "See FAQs", href: "#faq" },
};

export const partnerWhy = {
  title: "Why attend?",
  body: "Gain valuable insights, exclusive networking opportunities, and exciting updates designed to help you grow your business.",
  items: [
    {
      iconName: "sparkle-hightlight" as const,
      title: "Cloudflare Leadership Insights",
      body: "Gain exclusive insights from Cloudflare executives on the future of security, networking, and AI-driven performance.",
    },
    {
      iconName: "globe-3" as const,
      title: "Delivering the Platform",
      body: "Cloudflare One is the unified platform that first-generation SASE providers promised but couldn’t build. We eliminate the friction of legacy security and networking with one control plane, data plane, and infrastructure layer.",
    },
    {
      iconName: "rocket" as const,
      title: "Elevated Sales Strategies",
      body: "Learn how to foster enduring customer relationships and position Cloudflare as the preferred vendor for both current and future needs.",
    },
    {
      iconName: "collaboration-pointer-left" as const,
      title: "Networking & Exclusive Access",
      body: "Connect with Cloudflare leadership and top-performing partners to exchange ideas, build strategic partnerships, and explore key strategies to fuel your success.",
    },
  ],
  featuredSpeaker: {
    label: "Featured speaker",
    name: "Paul Roetzer",
    role: "Founder and CEO, SmarterX and Marketing AI Institute",
  },
};

export const partnerAwards = {
  title: "Cloudflare Partner Awards",
  body: "Join us as we recognize and honor top-performing partners for their outstanding achievements, innovation, and impact over the past year.",
};

export const partnerExtend = {
  title: "Extend your stay for Cloudflare Connect",
  body: "Stick around from October 19 – 21 to learn alongside our customers, broaden your professional network, and cap off the week at our can’t-miss closing party at Oracle Park.",
};

export const partnerFaq = [
  {
    question: "When and where is the Global Partner Summit?",
    answer:
      "The Partner Summit is a half-day event taking place in the afternoon on Monday, October 19 at the Moscone West, 800 Howard St, San Francisco, CA 94103.",
  },
  {
    question: "Who can attend the Global Partner Summit?",
    answer:
      "Cloudflare Partner Summit is an exclusive event for Cloudflare partners in good standing who are actively engaged in our Partner Network. This includes partners who have met program requirements, maintain an active partnership status, and contribute to joint success with Cloudflare. If you're unsure about your eligibility, please get in touch with your Cloudflare Partner Manager.",
  },
  {
    question: "What does it cost to attend the Global Partner Summit?",
    answer:
      "There is no cost to attend the Global Partner Summit. Free access to Connect will only be granted to those participating in the Global Partner Summit, with the expectation that they attend both events.",
  },
  {
    question:
      "Why am I offered different registrant types? What is the difference?",
    answer: `Cloudflare Partner Summit Only is a no-cost pass for you to attend Partner Summit on Monday, October 19. This does not include admittance to Connect 2026.
Cloudflare Partner Summit + Connect is the pass to select if you would like to attend both Partner Summit and Connect.`,
  },
  {
    question:
      "Does my registration to Connect 2026 automatically get me access to Global Partner Summit?",
    answer:
      "No. These are separate programs that require different registrations.",
  },
  {
    question: "What should I expect during the Global Partner Summit?",
    answer:
      "The Cloudflare Partner Summit offers exclusive insights, key updates, and invaluable networking opportunities to help you grow your business. Plus, you will gain hands-on knowledge through in-depth sales and technical sessions.",
  },
];
