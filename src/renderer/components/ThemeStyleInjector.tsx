import { useSignalEffect } from '@preact/signals';
import type { ThemeDefinition } from '@shared/ipc-types';
import { activeTheme } from '../state/theme-store';

const CSS_VAR_MAP: Record<keyof ThemeDefinition['chromeTokens'], string> = {
  bgTerminal: '--bg-terminal',
  bgChrome: '--bg-chrome',
  fgPrimary: '--fg-primary',
  fgDimmed: '--fg-dimmed',
  accent: '--accent',
  border: '--border',
};

export function applyChromeCssVars(tokens: ThemeDefinition['chromeTokens']): void {
  const rootStyle = document.documentElement.style;

  for (const [tokenKey, cssVar] of Object.entries(CSS_VAR_MAP) as Array<
    [keyof ThemeDefinition['chromeTokens'], string]
  >) {
    rootStyle.setProperty(cssVar, tokens[tokenKey]);
  }
}

export default function ThemeStyleInjector() {
  useSignalEffect(() => {
    const theme = activeTheme.value;
    if (!theme) {
      return;
    }

    applyChromeCssVars(theme.chromeTokens);
  });

  return null;
}