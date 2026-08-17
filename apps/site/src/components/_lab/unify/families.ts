import type { AstroComponentFactory } from "astro/runtime/server/index.js";
import Libraries from "@/components/_pages/products/browser-rendering/full-stack/libraries/Libraries.astro";
import Render from "@/components/_pages/products/browser-rendering/full-stack/Render.astro";
import Compute from "@/components/_pages/products/containers/full-stack/Compute.astro";
import Latency from "@/components/_pages/products/containers/full-stack/latency/Latency.astro";
import Sandbox from "@/components/_pages/products/containers/full-stack/Sandbox.astro";
import Secure from "@/components/_pages/products/containers/full-stack/Secure.astro";
import Enrich from "@/components/_pages/products/email-service/full-stack/enrich/Enrich.astro";
import Reply from "@/components/_pages/products/email-service/full-stack/reply/Reply.astro";
import Route from "@/components/_pages/products/email-service/full-stack/Route.astro";
import Send from "@/components/_pages/products/email-service/full-stack/Send.astro";
import GithubIntegration from "@/components/_pages/products/pages/use-cases/GithubIntegration.astro";
import ShareLink from "@/components/_pages/products/pages/use-cases/share-link/ShareLink.astro";
import SdkControl from "@/components/_pages/products/sandboxes/full-stack/sdk-control/SdkControl.astro";
import Automation from "@/components/_pages/products/workers-for-platforms/full-stack/automation/Automation.astro";
import UseCasesApi from "@/components/_pages/products/workers/use-cases/api/UseCasesApi.astro";
import UseCasesDeploy from "@/components/_pages/products/workers/use-cases/deploy/UseCasesDeploy.astro";
import UseCasesRun from "@/components/_pages/products/workers/use-cases/run/UseCasesRun.astro";
import UseCasesServerless from "@/components/_pages/products/workers/use-cases/serverless/UseCasesServerless.astro";

export interface Member {
  name: string;
  page: string;
  component?: AstroComponentFactory;
  tall?: boolean;
  /** What this member adds that its siblings do not — the prop that must exist. */
  delta: string;
  /** Where its choreography lives today. */
  source: string;
}

export interface Family {
  id: string;
  name: string;
  verdict: "merge" | "extract";
  core: string;
  members: Member[];
  props: { prop: string; type: string; why: string }[];
  duplication: string;
  blockers?: string;
  effort: "small" | "medium" | "large";
}

export const FAMILIES: Family[] = [
  {
    id: "hub-relay",
    name: "HubRelayCard — source reel crosses the hub",
    verdict: "merge",
    core: "A pill reel supplies the trigger, a bullet crosses to the hub, the hub bounces and boosts its ring, and a second leg carries the result to a target reel that hops, swaps its face and advances. Two cards, one beat sentence, no branch between them.",
    members: [
      {
        name: "Event-driven automation",
        page: "workers-for-platforms",
        component: Automation,
        delta:
          "One reel does both jobs: the trigger leaves it and the result returns to it, so the hub role is retC. A steps(8) loader rides the trigger face.",
        source: "automation/visual.ts — timer queue + own leg builder",
      },
      {
        name: "Route inbound email",
        page: "email-service",
        component: Route,
        delta:
          "Two reels instead of one, so the route is open (mail → hub → status) with no return. Narrower 124px pills, and the mail face reveals by CSS rather than a swap.",
        source: "pill-hub-pill/ — sealed, callback chain over timer-queue",
      },
    ],
    props: [
      {
        prop: "columns",
        type: "[ColumnSpec] | [ColumnSpec, ColumnSpec]",
        why: "One reel (Automation) or two (Route). Carries width, pill height and pitch, so the hop scales itself.",
      },
      {
        prop: "route",
        type: "{ from: string; to: string }[]",
        why: "R→C→R for Automation, L→C→R for Route. The hop list as data is the whole merge.",
      },
      {
        prop: "faceMode",
        type: '"swap" | "reveal"',
        why: "Route's mail plate reveals with CSS; every other face swaps through SwapPill.",
      },
      {
        prop: "holds",
        type: "{ trigger?: number; hub?: number; result?: number; rest?: number }",
        why: "The numbers you retune by feel stay in the card file, visible and local.",
      },
      {
        prop: "items",
        type: "{ icon: IconName; label: string; result?: string }[]",
        why: "The content contract — all a new page fills in.",
      },
    ],
    duplication:
      "Two copies of the leg builder and two sequencing idioms for one identical cycle. Ring deceleration is decided by hand in both instead of derived from leg length.",
    effort: "medium",
  },
  {
    id: "hub-resolve",
    name: "HubResolveReelCard — hub delivers, the reel resolves",
    verdict: "merge",
    core: "The hub sends, the landed pill holds a working state, then resolves one or more answers with a hop each, and the reel advances. Reply is Enrich with the step count set to one — the two files are otherwise the same shape, pixel for pixel.",
    members: [
      {
        name: "Enrich and orchestrate",
        page: "email-service",
        component: Enrich,
        delta:
          "Four answer steps drawn from seven classification dimensions, then a return leg that boosts the ring. Ring r=56.",
        source: "enrich/sequencer.ts — own phase machine + own leg builder",
      },
      {
        name: "Reply or escalate",
        page: "email-service",
        component: Reply,
        delta:
          "One answer step and no return leg, so its hub never receives anything and its ring must never boost. Ring r=60.",
        source:
          "reply/sequencer.ts — near-identical phase machine, third leg builder",
      },
    ],
    props: [
      {
        prop: "steps",
        type: "number",
        why: "Four for Enrich, one for Reply. A count, not a branch — this is the entire behavioural difference.",
      },
      {
        prop: "returnLeg",
        type: "boolean",
        why: "Enrich returns to the hub; Reply does not. Whether the ring boosts follows from this, so it is never asked of the caller.",
      },
      {
        prop: "draw",
        type: "(index: number) => Detail",
        why: "Enrich's random 4-of-7 pass with its adjacent-repeat guard stays a callback; Reply passes a sequential reader.",
      },
      {
        prop: "holds",
        type: "{ working?: number; step?: number; resolved?: number; rest?: number }",
        why: "THINKING 2 / STEP 1.1 versus WORKING 1.4 / RESOLVED 1.2 — values only.",
      },
    ],
    duplication:
      "Two hand-written phase machines with the same states, two leg builders, and a shovePill/hopPill pair copied verbatim between the two files.",
    effort: "small",
  },
  {
    id: "browser-reel",
    name: "BrowserReelRelayCard — relay into a window filmstrip",
    verdict: "merge",
    core: "A source throws at a browser window, optionally through a ringed hub. The window nudges, activates and runs an arrival program, then the filmstrip advances one pitch, wraps, and resets the hidden slot. Secure and Sandbox already prove it: one module, two visibly different cards, page files that are pure content.",
    members: [
      {
        name: "Containers · Secure",
        page: "containers",
        component: Secure,
        delta:
          "Cross rules, 192×128 window, and a report chip whose loader swaps to a checkmark after the crest.",
        source: "container-stream/ — the shared module, driven by props",
      },
      {
        name: "Containers · Sandbox",
        page: "containers",
        component: Sandbox,
        delta:
          "Horizontal rules, 208×136 window, no report. Nothing of its own — its page file is fifteen lines of content.",
        source: "container-stream/ — same module, different props",
      },
      {
        name: "SDK-driven control",
        page: "sandboxes",
        component: SdkControl,
        delta:
          "A chip and a ringed hub in front of the window, and four tiles that light at fixed crest-progress stops.",
        source: "sdk-control/visual.ts — the same machine, phases renamed",
      },
      {
        name: "Real-time streaming",
        page: "sandboxes (worktree)",
        delta:
          "The hub is the source and its ring never boosts; token rows stream in and a loader tail outlives the last token.",
        source: "worktree — copies the machine with sdk-control's numbers",
      },
      {
        name: "Code interpreter",
        page: "sandboxes (worktree)",
        delta:
          "The arrival program is a declarative CSS panel reveal rather than a per-frame crest, so the hook must allow fire-and-forget.",
        source: "worktree — a third hand-rolled filmstrip",
      },
    ],
    props: [
      {
        prop: "source / hub",
        type: "ChipSpec | false",
        why: "Chip only, chip through hub, or hub as the source — every combination already ships.",
      },
      {
        prop: "program",
        type: '"code-crest" | "token-crest" | "panel-reveal"',
        why: "The settled arrival treatments. A new page picks a finished one instead of designing a reveal.",
      },
      {
        prop: "window",
        type: "{ variant: BrowserVariant; width: number; height: number; slots?: number }",
        why: "192×128 or 208×136, three slots or four, four Browser variants. Pitch derives from height + gap.",
      },
      {
        prop: "report",
        type: "{ color: IconColor } | false",
        why: "Presence adds the tail leg and switches the hold schedule — already proven by Secure against Sandbox.",
      },
      {
        prop: "holds",
        type: "{ idle?: number; lead?: number; gap?: number; hold?: number; loaderTail?: number }",
        why: "Streaming copied sdk-control's numbers by hand; as props that becomes a decision, not a copy.",
      },
    ],
    duplication:
      "Three hand-rolled copies of one phase machine, three filmstrip implementations, three copies of the crest, and code-crest/code-shuffle living under container-stream while another page already imports them across the boundary.",
    blockers:
      "Verified as five members, not six: GitHub integration was cut because its browser never retires or advances. The two worktree members must land first, and the Browser variant union currently conflicts three ways.",
    effort: "large",
  },
  {
    id: "hub-satellites",
    name: "HubSatelliteCard — one closed exchange around a hub",
    verdict: "merge",
    core: "Chips flank a hub and one bullet at a time runs the closed exchange left → hub → right → hub → left. Send and Compute already share the sealed SideHubSide; Serverless runs the identical exchange with its own hand-rolled copy.",
    members: [
      {
        name: "Send from Workers",
        page: "email-service",
        component: Send,
        delta:
          "Both sides are reels, and a count badge gates the visits before they advance.",
        source: "side-hub-side/ — already sealed",
      },
      {
        name: "Containers · Compute",
        page: "containers",
        component: Compute,
        delta: "Three-item left reel, single right chip, no badge, no labels.",
        source: "side-hub-side/ — same component, different props",
      },
      {
        name: "Serverless",
        page: "workers",
        component: UseCasesServerless,
        tall: true,
        delta:
          "One static chip per side, legs that morph orange→purple, a backdrop grid, and a category that swaps during rest.",
        source: "workers/use-cases — own config, own swap wrappers",
      },
    ],
    props: [
      {
        prop: "sides",
        type: '{ items: ChipItem[]; mode: "static" | "reel"; badge?: number }[]',
        why: "Reels, static chips, ghosts and labels in one shape.",
      },
      {
        prop: "grid",
        type: "1 | 2 | false",
        why: "Serverless draws a backdrop grid; the other two draw plain hairlines.",
      },
      {
        prop: "snakeColors",
        type: "(from: string, to: string) => [IconColor, IconColor]",
        why: "Serverless is the only member with a per-leg colour morph, and the engine already supports it.",
      },
      {
        prop: "contentAdvance",
        type: "{ atMs: number; channel: string } | false",
        why: "Send advances its reels 120ms after the cycle; Serverless swaps its category at 200ms. One hook replaces two raw timeouts.",
      },
    ],
    duplication:
      "Serverless re-draws the topology and hand-rolls IconSwap, WordFade and AnimatedWidth equivalents with identical values.",
    blockers:
      "Verified as three members, not five. API was cut: it overlaps two chains 0.09s apart, and one-bullet-at-a-time is the family's core. Libraries was cut: it starts at the hub and picks a side at random. Both need engine work before they could join.",
    effort: "medium",
  },
  {
    id: "vertical-reel",
    name: "One reel primitive",
    verdict: "extract",
    core: "Six independent implementations of one idea: a strip of cells that advances one pitch, wraps, settles, and hands off its centre cell. This is the smallest change with the widest reach — it blocks three of the four merges above.",
    members: [
      {
        name: "shared/pill-reel",
        page: "px rows",
        delta: "The canonical one — Enrich, Reply, Route, Automation.",
        source: "shared/pill-reel/create-pill-reel.ts",
      },
      {
        name: "side-hub-side/reel.ts",
        page: "percent rows",
        delta: "Chip reel with its own row maths and chip-id handoff.",
        source: "side-hub-side/ — Send, Compute",
      },
      {
        name: "container-stream filmstrip",
        page: "pitch 164 / 172",
        delta: "Window strip with its own advance, wrap and reset.",
        source: "container-stream/visual.ts",
      },
      {
        name: "interpreter + streaming + Render",
        page: "worktrees, and one horizontal",
        delta:
          "Two more window strips, plus Render's conveyor — the same mechanism rotated 90°.",
        source: "three more hand-rolled copies",
      },
    ],
    props: [
      {
        prop: "axis / unit",
        type: '"x" | "y" / "px" | "percent"',
        why: "Render runs horizontally; the chip reels measure in percentages. Two props absorb all six.",
      },
      {
        prop: "pitch / slide",
        type: "number / number",
        why: "60, 64, 164, 172 — and slides of 0.3, 0.3375 and 0.45 that nobody chose. Settle one default.",
      },
      {
        prop: "onWrap",
        type: "(cell: HTMLElement, index: number) => void",
        why: "Reset the hidden cell before it comes round — hand-rolled against three different attribute contracts today.",
      },
    ],
    duplication:
      "Six implementations of step / commit / advance / settle / wrap. A fix in one has never reached the other five.",
    effort: "small",
  },
  {
    id: "traffic-engine",
    name: "One lattice traffic engine",
    verdict: "extract",
    core: "Not a card merge — the verification killed that. The two globe cards do not share a beat graph: Latency replaces its chips in batches tied to the content swap, while the sandboxes card free-runs each chip on its own clock. What they do share, line for line, is the traffic engine underneath.",
    members: [
      {
        name: "Containers · Latency",
        page: "containers",
        component: Latency,
        delta:
          "Batch lifecycle: four chips arrive together, serve one 9s content cycle, and leave together.",
        source: "latency/user-traffic.ts — the original, with the law comments",
      },
      {
        name: "Built on containers",
        page: "sandboxes (worktree)",
        delta:
          "Free-running lifecycle: each chip lives 8–14s on its own clock and respawns independently.",
        source:
          "worktree chip-traffic.ts — a copy of user-traffic.ts with the law comments stripped",
      },
    ],
    props: [
      {
        prop: "lifecycle",
        type: "supplied scheduler",
        why: "Batch versus free-running is a real difference in kind, so it ships as a scheduler the card supplies — never a boolean that forks the engine.",
      },
      {
        prop: "exclude",
        type: "(rect: DOMRect) => boolean",
        why: "Latency excludes the browser's column; the sandboxes card excludes a fixed guide box.",
      },
      {
        prop: "band / lanes",
        type: "[number, number] / number",
        why: "The lattice spawn law and how many meridian lanes run at once.",
      },
    ],
    duplication:
      "Candidate selection, meridian tracing, orphan-snake handling, pooling, fades and every constant — copied. A third copy of the meridian maths already exists in shared/globe for the canvas dots.",
    blockers:
      "Main's user-traffic.ts is now the only record of why the lattice constants are what they are. Unify before either file drifts further.",
    effort: "medium",
  },
];

export const STANDALONE: {
  name: string;
  page: string;
  component?: AstroComponentFactory;
  tall?: boolean;
  why: string;
}[] = [
  {
    name: "GitHub integration",
    page: "pages",
    component: GithubIntegration,
    why: "Cut from the browser family by both verifiers. Its browser starts active, floats, and never retires or advances — the next panel wipes in under a radial mask. Folding it in would make every filmstrip card carry a second lifecycle. Share its relay legs and lift the wave painter instead.",
  },
  {
    name: "API request",
    page: "workers",
    component: UseCasesApi,
    tall: true,
    why: "Cut from the satellite family. It overlaps two chains 0.09s apart, and one-bullet-at-a-time is that family's whole core. It can join once the choreography engine supports concurrent chains.",
  },
  {
    name: "Libraries",
    page: "browser-rendering",
    component: Libraries,
    tall: false,
    why: "Cut from the satellite family. Its cycle starts at the hub and picks a side at random, with no ring and no reel — a different sequence, not a different look.",
  },
  {
    name: "Render",
    page: "browser-rendering",
    component: Render,
    why: "The only horizontal conveyor: the track carries the targets while the source stays put. Fold its conveyor into the shared reel, but keep the card.",
  },
  {
    name: "Run",
    page: "workers",
    component: UseCasesRun,
    tall: true,
    why: "A three-row state pipeline with no hub, ring or reel. It is the seed of a future StepPipeline the day a second one exists — merging now would be speculative.",
  },
  {
    name: "Deploy",
    page: "workers",
    component: UseCasesDeploy,
    tall: true,
    why: "A linear 3.5s orbit loop. Genuinely its own thing.",
  },
  {
    name: "Share link",
    page: "pages",
    component: ShareLink,
    why: "A URL pill that swaps width and state in place, with no connector at all.",
  },
];

export interface Mechanism {
  name: string;
  copies: string;
  evidence: string;
  fix: string;
}

export const MECHANISMS: Mechanism[] = [
  {
    name: "The reel",
    copies: "6 implementations",
    evidence:
      "shared/pill-reel, side-hub-side/reel, container-stream, sdk-control, interpreter/reel, streaming's offsets loop — plus Render's horizontal conveyor. Same step, commit, advance, settle, wrap.",
    fix: "One reel with axis, unit, pitch and an onWrap hook. It blocks three of the four merges, so it goes first.",
  },
  {
    name: "The leg builder",
    copies: "9 files declare DEEP, 2 declare BURY",
    evidence:
      "measureChips → sideAnchors → buildConnector → createBullet, retyped per card with the same constants. The rationale comment survives in exactly one copy.",
    fix: "One connect(from, to, opts). The values become defaults instead of copies, and no page can hand-roll a connector.",
  },
  {
    name: "The cycle runner",
    copies: "12 of 17 sequencers hand-roll it",
    evidence:
      "clock + phaseUntil + a switch over a Phase union, written again per card. sdk-control's is a line-for-line sibling of container-stream's with the phases renamed.",
    fix: "One runner owning the loop, rebuild, and the deactivate-before-advance beat. Cards declare beats; the numbers stay in the card file.",
  },
  {
    name: "The wiring",
    copies: "7 islands, 7 namespaces, 3 schemes",
    evidence:
      "data-fullstack-visual, data-email-fullstack-visual, data-wfp-fullstack-visual, data-usecases-visual, data-pages-visual — and pages mismatches its own pair. Four shipped cards (bot, latency, deploy, share) are in no lab row, so the align audit never measured them.",
    fix: 'One data-card-grid + data-card="name" and one registry. The lab and the audit generate from it, so coverage stops being opt-in.',
  },
];

export interface ProposedRule {
  title: string;
  rule: string;
  target: "component-default" | "animation-skill" | "lab-tooling";
  sessions: number;
  quote: string;
}

export const RULES: ProposedRule[] = [
  {
    title: "A stage is a prop-only family",
    rule: "Build each repeated stage as one finished component. Motion, geometry, sequencing and defaults live inside it; only content, topology, colour and real visual nuances are props. A page must not be able to re-decide the choreography.",
    target: "component-default",
    sessions: 14,
    quote:
      "I thought that would be only a prop change, but i guess its not that componentized?",
  },
  {
    title: "First-draft pacing is always too fast",
    rule: "Ship generous holds by default — roughly 0.9s after an activation, 1s at a hub, 1.2s on a result — and anchor a new card's rhythm to a shipped sibling rather than inventing shorter values. Every card this week was corrected upward, never downward.",
    target: "component-default",
    sessions: 14,
    quote:
      "after badge appears, wait more before sending a snake pls. then also on hit left, wait there a as well.",
  },
  {
    title: "Choreography is a beat route, not a phase machine",
    rule: "Express a cycle as one ordered route of named beats — trigger, legs, holds, content events, advance, rest — all driven from one clock, always paying the connector dwell. Never hand-roll a second clock inside a card.",
    target: "component-default",
    sessions: 13,
    quote: "3) Do more waits between. So fast rn.",
  },
  {
    title: "Settled primitives are the only path",
    rule: "Render every settled visual from its shared implementation. Never copy its markup, transition or setup into a card. If a shared primitive cannot express what the mock needs, add a prop with the current behaviour as its default.",
    target: "component-default",
    sessions: 12,
    quote:
      "why this orbit stops? Why do you invent things? IT should always spin like others? Dont we have a shared structure for this?",
  },
  {
    title: "A hit is resolved from the leg, never chosen",
    rule: "Derive the hit from the connector and the target surface: round chip scales, pill or row hops, panel or window nudges, and the axis follows the path's final tangent. A call site never picks the hit or its amplitude.",
    target: "component-default",
    sessions: 7,
    quote:
      "one problem, first snake hit to rightside badge should rigger a x nudge, not y. same as others.",
  },
  {
    title: "Move a visual state as one unit",
    rule: "Wrap everything that represents one state in a single motion boundary so the plate, icon and label travel together, and animate every changed child in the same transition.",
    target: "component-default",
    sessions: 6,
    quote: "jump the text icon pair together with the bg pill pls.",
  },
  {
    title: "A stage opens settled",
    rule: "Choose the first frame deliberately. Nothing is mid-process on first paint — no spinner already turning, no row already running. Activity starts only after the entrance completes.",
    target: "component-default",
    sessions: 6,
    quote:
      "dont open running. Add that row after reveal. So nothing is running on initial load.",
  },
  {
    title: "Animate semantic state only",
    rule: "Animate states that exist in the content model or the design. Never invent a loading beat, a scramble, a shimmer or an active state as decoration — static identity stays static.",
    target: "component-default",
    sessions: 6,
    quote:
      "make it Sandbox pls its wrong typo, remoe the animation switch etc as well",
  },
  {
    title: "Desynchronize ambient lanes",
    rule: "Give every ambient element and every lane its own phase, rest and lifecycle, and run one causal exchange at a time unless the design needs concurrency. Never spawn, hide or move a group as one batch.",
    target: "component-default",
    sessions: 5,
    quote:
      "adjust delays better, i dont want them to start/end same time. Maybe add bigger delays so one is active at a time?",
  },
  {
    title: "The lab is the catalog, and the audit is exhaustive",
    rule: "Generate the lab grid and the alignment audit from the card registry. A card missing from coverage fails the audit rather than passing silently — four shipped cards are unmeasured today.",
    target: "lab-tooling",
    sessions: 6,
    quote:
      "we need to setup a skill or flow tho. Snakes are sometimes misaligned to border.",
  },
  {
    title: "A duplicate becomes a component and a rule",
    rule: "When two cards render the same animation: pick the better instance, componentize it, and write the rule down. All three steps, every time.",
    target: "animation-skill",
    sessions: 27,
    quote:
      "this is exactly same as this noe. Pls make sure this is the correct way of doing this, componentize, write rules etc",
  },
];
