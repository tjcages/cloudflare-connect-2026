import type { FC, SVGProps } from "react";
import AstroLogo from "./logos/astro.svg?react";
import NextjsLogo from "./logos/nextjs.svg?react";
import RemixLogo from "./logos/remix.svg?react";
import TanstackLogo from "./logos/tanstack.svg?react";

export const FRAMEWORKS: readonly {
  name: string;
  Logo: FC<SVGProps<SVGSVGElement>>;
  size: number;
}[] = [
  { name: "nextjs", Logo: NextjsLogo, size: 28 },
  { name: "astro", Logo: AstroLogo, size: 44 },
  { name: "remix", Logo: RemixLogo, size: 24 },
  { name: "tanstack", Logo: TanstackLogo, size: 28 },
];
