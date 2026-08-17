import type { ComponentType } from "react";

import AgentRun from "./previews/AgentRun";
import Analysis from "./previews/Analysis";
import Dashboard from "./previews/Dashboard";
import Landing from "./previews/Landing";

type LineKind =
  "command" | "step" | "add" | "check" | "log" | "trace" | "note" | "link";

export type Stage = {
  doing: string;
  done?: string;
};

export type Line = {
  kind: LineKind;
  text: string;
  stage?: Stage | "live";
};

export type Act = {
  id: string;
  host: string;
  opening: Stage;
  blocks: Line[][];
  preview: ComponentType;
};

export const PROGRESS = [0, 0.15, 0.4, 0.58, 0.77, 1];

export const ACTS: Act[] = [
  {
    id: "hono-api",
    host: "bright-lake",
    opening: { doing: "Preparing sandbox..." },
    preview: Dashboard,
    blocks: [
      [
        {
          kind: "check",
          text: "Creating sandbox...",
          stage: {
            doing: "Preparing sandbox...",
            done: "Secure environment",
          },
        },
        { kind: "step", text: "Allocating isolated workerd runtime" },
        { kind: "step", text: "Region: Europe (auto)" },
        { kind: "step", text: "1 vCPU • 256 MB memory • 2 GB disk" },
      ],
      [
        {
          kind: "check",
          text: "Sandbox ready",
          stage: { doing: "Creating project...", done: "Sandbox ready" },
        },
      ],
      [
        { kind: "command", text: "npm create hono@latest api" },
        { kind: "add", text: "create api/package.json" },
        { kind: "add", text: "create api/tsconfig.json" },
        { kind: "add", text: "create api/src/index.ts" },
        { kind: "add", text: "create api/.gitignore" },
      ],
      [
        {
          kind: "check",
          text: "Project created",
          stage: {
            doing: "Installing dependencies...",
            done: "Project created",
          },
        },
      ],
      [
        { kind: "command", text: "npm install" },
        { kind: "add", text: "hono@4.9.1" },
        { kind: "add", text: "@hono/node-server@1.18.0" },
        { kind: "add", text: "typescript@5.9.2" },
      ],
      [
        { kind: "note", text: "added 96 packages in 1.8s" },
        { kind: "note", text: "18 packages are looking for funding" },
        { kind: "log", text: "found 0 vulnerabilities" },
      ],
      [
        {
          kind: "check",
          text: "Dependencies installed",
          stage: {
            doing: "Starting server...",
            done: "Dependencies installed",
          },
        },
      ],
      [
        { kind: "command", text: "npm run dev" },
        { kind: "step", text: "api@0.0.1 dev" },
        { kind: "step", text: "vite --host 0.0.0.0" },
        { kind: "log", text: "Hono v4.9.1" },
        { kind: "step", text: "Local: http://localhost:8787" },
        { kind: "step", text: "Network: http://192.168.1.24:8787" },
        { kind: "trace", text: "Watching for file changes..." },
        { kind: "log", text: "Server running..." },
      ],
      [{ kind: "check", text: "Preview ready", stage: "live" }],
      [{ kind: "link", text: "https://bright-lake.trycloudflare.app" }],
    ],
  },
  {
    id: "agent-code",
    host: "calm-fog",
    opening: { doing: "Preparing sandbox..." },
    preview: AgentRun,
    blocks: [
      [
        {
          kind: "check",
          text: "Creating sandbox...",
          stage: {
            doing: "Preparing sandbox...",
            done: "Secure environment",
          },
        },
        { kind: "step", text: "Allocating isolated workerd runtime" },
        { kind: "step", text: "Region: North America (auto)" },
        { kind: "step", text: "Network egress: deny by default" },
      ],
      [
        {
          kind: "check",
          text: "Sandbox ready",
          stage: { doing: "Writing agent files...", done: "Sandbox ready" },
        },
      ],
      [
        { kind: "command", text: "agent apply plan.md" },
        { kind: "add", text: "write app/main.py" },
        { kind: "add", text: "write app/tools.py" },
        { kind: "add", text: "write requirements.txt" },
      ],
      [
        {
          kind: "check",
          text: "Files written",
          stage: {
            doing: "Installing dependencies...",
            done: "Files written",
          },
        },
      ],
      [
        { kind: "command", text: "pip install -r requirements.txt" },
        { kind: "add", text: "fastapi==0.118.0" },
        { kind: "add", text: "anthropic==0.69.0" },
        { kind: "add", text: "uvicorn==0.37.0" },
      ],
      [
        { kind: "note", text: "installed 24 packages in 3.1s" },
        { kind: "note", text: "no code left the sandbox" },
      ],
      [
        {
          kind: "check",
          text: "Dependencies installed",
          stage: {
            doing: "Starting server...",
            done: "Dependencies installed",
          },
        },
      ],
      [
        { kind: "command", text: "uvicorn app.main:app" },
        { kind: "step", text: "Loading agent tools" },
        { kind: "step", text: "Sandboxed exec: enabled" },
        { kind: "log", text: "Agent runtime v1.4.0" },
        { kind: "step", text: "Local: http://localhost:8000" },
        { kind: "trace", text: "Waiting for the first task..." },
        { kind: "log", text: "Agent online..." },
      ],
      [{ kind: "check", text: "Preview ready", stage: "live" }],
      [{ kind: "link", text: "https://calm-fog.trycloudflare.app" }],
    ],
  },
  {
    id: "interpreter",
    host: "quiet-harbor",
    opening: { doing: "Preparing sandbox..." },
    preview: Analysis,
    blocks: [
      [
        {
          kind: "check",
          text: "Creating sandbox...",
          stage: {
            doing: "Preparing sandbox...",
            done: "Secure environment",
          },
        },
        { kind: "step", text: "Allocating isolated workerd runtime" },
        { kind: "step", text: "Region: Europe (auto)" },
        { kind: "step", text: "2 vCPU • 512 MB memory • 4 GB disk" },
      ],
      [
        {
          kind: "check",
          text: "Sandbox ready",
          stage: { doing: "Uploading sales.csv...", done: "Sandbox ready" },
        },
      ],
      [
        { kind: "command", text: "sandbox upload sales.csv" },
        { kind: "add", text: "write data/sales.csv" },
        { kind: "note", text: "4,182 rows • 1.2 MB" },
      ],
      [
        {
          kind: "check",
          text: "Data uploaded",
          stage: { doing: "Installing packages...", done: "Data uploaded" },
        },
      ],
      [
        { kind: "command", text: "pip install pandas matplotlib" },
        { kind: "add", text: "pandas==2.3.3" },
        { kind: "add", text: "matplotlib==3.10.6" },
        { kind: "add", text: "numpy==2.3.3" },
      ],
      [
        {
          kind: "check",
          text: "Dependencies installed",
          stage: {
            doing: "Running the analysis...",
            done: "Dependencies installed",
          },
        },
      ],
      [
        { kind: "command", text: "python analyze.py" },
        { kind: "trace", text: "Reading data/sales.csv" },
        { kind: "log", text: "Revenue up 18.4% quarter over quarter" },
        { kind: "log", text: "Best month: September" },
        { kind: "step", text: "Wrote out/report.html" },
        { kind: "step", text: "Local: http://localhost:5000" },
        { kind: "log", text: "Report served..." },
      ],
      [{ kind: "check", text: "Preview ready", stage: "live" }],
      [{ kind: "link", text: "https://quiet-harbor.trycloudflare.app" }],
    ],
  },
  {
    id: "generated-app",
    host: "soft-meadow",
    opening: { doing: "Preparing sandbox..." },
    preview: Landing,
    blocks: [
      [
        {
          kind: "check",
          text: "Creating sandbox...",
          stage: {
            doing: "Preparing sandbox...",
            done: "Secure environment",
          },
        },
        { kind: "step", text: "Allocating isolated workerd runtime" },
        { kind: "step", text: "Region: Asia Pacific (auto)" },
        { kind: "step", text: "1 vCPU • 256 MB memory • 2 GB disk" },
      ],
      [
        {
          kind: "check",
          text: "Sandbox ready",
          stage: { doing: "Scaffolding the app...", done: "Sandbox ready" },
        },
      ],
      [
        { kind: "command", text: "npm create vite@latest site" },
        { kind: "add", text: "create site/index.html" },
        { kind: "add", text: "create site/src/App.tsx" },
        { kind: "add", text: "create site/src/main.tsx" },
      ],
      [
        {
          kind: "check",
          text: "Project created",
          stage: {
            doing: "Installing dependencies...",
            done: "Project created",
          },
        },
      ],
      [
        { kind: "command", text: "npm install" },
        { kind: "add", text: "react@19.2.0" },
        { kind: "add", text: "react-dom@19.2.0" },
        { kind: "add", text: "vite@8.0.2" },
      ],
      [
        { kind: "note", text: "added 148 packages in 2.6s" },
        { kind: "log", text: "found 0 vulnerabilities" },
      ],
      [
        {
          kind: "check",
          text: "Dependencies installed",
          stage: {
            doing: "Starting the dev server...",
            done: "Dependencies installed",
          },
        },
      ],
      [
        { kind: "command", text: "npm run dev" },
        { kind: "step", text: "site@0.0.0 dev" },
        { kind: "step", text: "vite --host 0.0.0.0" },
        { kind: "log", text: "VITE v8.0.2 ready in 214 ms" },
        { kind: "step", text: "Local: http://localhost:5173" },
        { kind: "trace", text: "Watching for file changes..." },
        { kind: "log", text: "Server running..." },
      ],
      [{ kind: "check", text: "Preview ready", stage: "live" }],
      [{ kind: "link", text: "https://soft-meadow.trycloudflare.app" }],
    ],
  },
];
