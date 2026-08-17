import { REGISTER_URL } from "../data";

export const convincePageMeta = {
  title: "Convince Your Boss - Cloudflare Connect 2026 | Cloudflare",
  description:
    "Get approval to attend Cloudflare Connect 2026 with a ready-to-send email or Slack template.",
};

export const convinceHero = {
  eyebrow: "Convince your boss",
  title: "Convince your boss",
  body: "Get approval to attend Cloudflare Connect 2026 with this ready-to-send email or message template.",
  primaryCta: { text: "Register Now", href: REGISTER_URL },
  secondaryCta: { text: "Copy email", href: "#templates" },
};

export const convinceEmailTemplate = `Subject: Request to Attend Cloudflare Connect 2026 - Professional Development Opportunity

Hi [Manager's Name],

I'd like to request approval to attend Cloudflare Connect 2026, taking place October 19-21, 2026, at Moscone West in San Francisco. This conference presents a valuable professional development opportunity that directly aligns with our organization's technology goals and security priorities.

Why This Conference Matters:
• Deep, actionable insights from Cloudflare's leadership and top industry experts
• Early access to learnings about the latest innovations in cloud infrastructure, security, and AI
• Networking opportunities with Cloudflare's global customers and technology leaders
• Hands-on training sessions and workshops relevant to our current projects

Professional Development Value:
• Stay current with cutting-edge cloud security and performance technologies
• Learn best practices from industry leaders and successful implementations
• Gain insights that can be immediately applied to improve our infrastructure
• Understand emerging trends that could impact our technology strategy

Conference Details:
• Dates: October 19-21, 2026
• Location: Moscone West, San Francisco
• Format: Mix of keynotes, breakout sessions, hands-on workshops, and networking

Estimated Costs:
• Registration: $595 (Conference Pass)
• Flight: $400-$800 (depending on location)
• Hotel: $350/night x 3 nights = $1,050
• Meals: $100/day x 3 days = $300
• Total Estimated Cost: $2,345 - $2,745

Post-Conference Commitment:
I commit to sharing key learnings with the team through:
• A comprehensive summary presentation of key takeaways
• Documentation of relevant best practices and recommendations
• Knowledge transfer session with relevant team members
• Implementation recommendations for our current projects

I believe the insights gained will provide immediate value to our team and organization. I'm happy to discuss this opportunity further and answer any questions you may have.

Thank you for considering this request.

Best regards,
[Your Name]`;

export const convinceSlackTemplate = `Hi [Manager's Name] - I'd like to attend Cloudflare Connect 2026, Oct 19-21 at Moscone West in San Francisco.

I think it would be valuable for our team because the event focuses on cloud infrastructure, security, performance, AI, and hands-on workshops that map closely to our current work.

Why it matters:
• Direct access to Cloudflare product, engineering, and security experts
• Practical sessions we can translate into our roadmap and operations work
• A chance to compare approaches with other teams using Cloudflare at scale

Cost estimate: $595 registration, plus travel/hotel/meals for an estimated total of $2,345-$2,745.

If approved, I'll share a short team recap with key takeaways, relevant best practices, and recommendations we can act on. Would you be open to me attending?`;
