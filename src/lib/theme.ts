import type { GameTheme } from '../types/data'

interface CSSVarMap {
  [k: string]: string
}

const DEFAULTS: Required<Pick<GameTheme,
  | 'primary' | 'secondary' | 'background' | 'surface' | 'text' | 'accentMuted'>> = {
  primary: '#6c7a8a',
  secondary: '#4a5462',
  background: '#0f1115',
  surface: '#181b22',
  text: '#e8eaee',
  accentMuted: '#2a2f39',
}

export function themeToCssVars(theme: GameTheme | null): CSSVarMap {
  const merged = { ...DEFAULTS, ...(theme ?? {}) }
  const vars: CSSVarMap = {
    '--theme-primary': merged.primary,
    '--theme-secondary': merged.secondary,
    '--theme-background': merged.background,
    '--theme-surface': merged.surface,
    '--theme-text': merged.text,
    '--theme-border': merged.accentMuted,
  }
  return vars
}

export function cssVarStyle(theme: GameTheme | null): React.CSSProperties {
  return themeToCssVars(theme) as unknown as React.CSSProperties
}
