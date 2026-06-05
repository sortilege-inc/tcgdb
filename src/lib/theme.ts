import type { GameTheme } from '../types/data'

interface CSSVarMap {
  [k: string]: string
}

const DEFAULTS: Required<Pick<GameTheme,
  | 'primary' | 'secondary' | 'background' | 'surface' | 'surface2'
  | 'text' | 'textMuted' | 'accentMuted'>> = {
  primary: '#6c7a8a',
  secondary: '#4a5462',
  background: '#0f1115',
  surface: '#181b22',
  surface2: '#1f242d',
  text: '#e8eaee',
  textMuted: '#9aa1ad',
  accentMuted: '#2a2f39',
}

export function themeToCssVars(theme: GameTheme | null): CSSVarMap {
  const merged = { ...DEFAULTS, ...(theme ?? {}) }
  const vars: CSSVarMap = {
    '--theme-primary': merged.primary,
    '--theme-secondary': merged.secondary,
    '--theme-background': merged.background,
    '--theme-surface': merged.surface,
    '--theme-surface-2': merged.surface2,
    '--theme-text': merged.text,
    '--theme-text-muted': merged.textMuted,
    '--theme-border': merged.accentMuted,
  }
  return vars
}

export function cssVarStyle(theme: GameTheme | null): React.CSSProperties {
  return themeToCssVars(theme) as unknown as React.CSSProperties
}
