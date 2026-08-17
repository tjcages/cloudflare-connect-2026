import type { Dispatch, RefObject, SetStateAction } from "react";
import { commitNames, initialData } from "./constants";
import type { ListType, ReleaseType, Version } from "./types";
import { nanoid } from "nanoid";

export const nextVersion = (version: Version) => {
  const random = Math.random();

  if (random < 0.1) {
    return {
      type: "major" as const,
      version: {
        major: version.major + 1,
        minor: 0,
        patch: 0,
      },
    };
  }

  if (random < 0.2) {
    return {
      type: "minor" as const,
      version: {
        major: version.major,
        minor: version.minor + 1,
        patch: 0,
      },
    };
  }

  return {
    type: "patch" as const,
    version: {
      major: version.major,
      minor: version.minor,
      patch: version.patch + 1,
    },
  };
};

export const formatVersion = (version: Version) => {
  return `v${version.major}.${version.minor}.${version.patch}`;
};

export const formatDuration = (seconds: number) => {
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}m ${remainingSeconds}s`;
};

const commitCounters = { major: 0, minor: 0, patch: 0 };

export const getRandomCommit = (type: ReleaseType) => {
  const commits = commitNames[type];

  commitCounters[type] = (commitCounters[type] + 1) % commits.length;
  return commits[commitCounters[type]];
};

export const openDropdownOnRandomItem = (
  items: ListType[],

  setOpenDropdownId: Dispatch<SetStateAction<string | null>>
) => {
  const random = Math.random();

  const deployedItems = items
    .filter((item) => item.status === "Deployed")
    .slice(0, -1);

  if (random < 0.9 && deployedItems.length) {
    const randomItem =
      deployedItems[Math.floor(Math.random() * deployedItems.length)];

    setOpenDropdownId(randomItem.id);
  } else {
    setOpenDropdownId(null);
  }
};

export const addQueuedItem = (
  setList: Dispatch<SetStateAction<ListType[]>>,
  versionRef: RefObject<Version>
) => {
  setList((prev) => {
    if (prev.some((item) => item.status === "Queued")) {
      return prev;
    }

    const newVersion = nextVersion(versionRef.current);
    versionRef.current = newVersion.version;

    return [
      {
        version: newVersion.version,
        title:
          initialData[Math.floor(Math.random() * initialData.length)].title,
        status: "Queued" as const,
        duration: 0,
        environment: Math.random() > 0.5 ? "Production" : "Preview",
        commitName: getRandomCommit(newVersion.type),
        id: nanoid(),
      },
      ...prev,
    ].slice(0, 5);
  });
};
