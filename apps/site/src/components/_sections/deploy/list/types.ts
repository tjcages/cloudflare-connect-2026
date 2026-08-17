export type Status = "Queued" | "Building" | "Deployed";

export type Version = {
  major: number;
  minor: number;
  patch: number;
};

export type ReleaseType = "patch" | "minor" | "major";

export type ListType = {
  title: string;
  status: Status;
  version: Version;
  environment: string;
  duration: number;
  commitName: string;
  id: string;
};
