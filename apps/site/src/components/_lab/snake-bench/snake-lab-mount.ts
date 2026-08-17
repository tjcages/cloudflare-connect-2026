export {};

declare global {
  interface Window {
    $RefreshReg$: () => void;
    $RefreshSig$: () => (type: unknown) => unknown;
    __vite_plugin_react_preamble_installed__: boolean;
  }
}

const refreshUrl = "/@react-refresh";
const RefreshRuntime = await import(/* @vite-ignore */ refreshUrl);
RefreshRuntime.default.injectIntoGlobalHook(window);
window.$RefreshReg$ = () => {};
window.$RefreshSig$ = () => (type: unknown) => type;
window.__vite_plugin_react_preamble_installed__ = true;

const { createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
const { default: SnakeLab } = await import("./SnakeLab");

const host = document.querySelector("[data-snake-lab]");
if (host) createRoot(host).render(createElement(SnakeLab));
