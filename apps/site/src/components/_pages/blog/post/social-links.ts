import type { IconName } from "@/components/icon/icons.gen";

export type SocialLink = {
  icon: IconName;
  label: string;
  href: string;
};

export function shareLinks(url: string, title: string): SocialLink[] {
  const link = encodeURIComponent(url);
  const headline = encodeURIComponent(title);
  const post = encodeURIComponent(`${title} ${url}`);

  return [
    {
      icon: "hacker-news",
      label: "Share on Hacker News",
      href: `https://news.ycombinator.com/submitlink?u=${link}&t=${headline}`,
    },
    {
      icon: "x",
      label: "Share on X",
      href: `https://x.com/intent/post?url=${link}&text=${headline}`,
    },
    {
      icon: "linkedin",
      label: "Share on LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${link}`,
    },
    {
      icon: "bluesky",
      label: "Share on Bluesky",
      href: `https://bsky.app/intent/compose?text=${post}`,
    },
    {
      icon: "mastodon",
      label: "Share on Mastodon",
      href: `https://mastodon.social/share?text=${post}`,
    },
    {
      icon: "threads",
      label: "Share on Threads",
      href: `https://www.threads.net/intent/post?text=${post}`,
    },
  ];
}

export const FOLLOW_LINKS: SocialLink[] = [
  { icon: "x", label: "Cloudflare on X", href: "https://x.com/cloudflare" },
  {
    icon: "linkedin",
    label: "Cloudflare on LinkedIn",
    href: "https://www.linkedin.com/company/cloudflare",
  },
  {
    icon: "youtube",
    label: "Cloudflare on YouTube",
    href: "https://www.youtube.com/cloudflare",
  },
  {
    icon: "instagram",
    label: "Cloudflare on Instagram",
    href: "https://www.instagram.com/cloudflare",
  },
  {
    icon: "github",
    label: "Cloudflare on GitHub",
    href: "https://github.com/cloudflare",
  },
  {
    icon: "bluesky",
    label: "Cloudflare on Bluesky",
    href: "https://bsky.app/profile/cloudflare.com",
  },
  {
    icon: "threads",
    label: "Cloudflare on Threads",
    href: "https://www.threads.net/@cloudflare",
  },
  {
    icon: "tiktok",
    label: "Cloudflare on TikTok",
    href: "https://www.tiktok.com/@cloudflare",
  },
];
