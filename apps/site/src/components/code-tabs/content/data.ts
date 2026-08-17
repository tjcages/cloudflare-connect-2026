export type DataProps = {
  tabTitle: string;
  title: string;
  description: string;
  docsHref?: string;
  code: string;
  language: string;
  terminalLabel?: string;
  fileName?: string;
};

const TERMINAL_LANGUAGES = new Set(["bash", "sh", "shell", "zsh"]);

export function isTerminalLanguage(language: string) {
  return TERMINAL_LANGUAGES.has(language);
}
