// HourSnap identity: a photobooth for your school group.
// Every snap is a printed photo with a film-camera date stamp, laid on a sky-blue table.
import { createContext, useContext, useMemo } from 'react';
import { TextStyle } from 'react-native';

export type Appearance = 'auto' | 'light' | 'dark';
export type AccentKey = 'storm' | 'ocean' | 'mint' | 'berry' | 'ember';

// The colour used for buttons and the shutter. Storm violet is the house colour.
export const ACCENTS: Record<AccentKey, { name: string; light: string; dark: string; soft: string; softDark: string }> = {
  storm: { name: 'Storm', light: '#4A3AFF', dark: '#8F86FF', soft: '#E3E0FF', softDark: '#2A2560' },
  ocean: { name: 'Ocean', light: '#0B6BCB', dark: '#6FB3F5', soft: '#D9EBFB', softDark: '#173452' },
  mint: { name: 'Mint', light: '#0F8A5F', dark: '#5ED3A5', soft: '#D5F2E6', softDark: '#123A2C' },
  berry: { name: 'Berry', light: '#C2185B', dark: '#F48FB1', soft: '#FBDDE8', softDark: '#4A1A2C' },
  ember: { name: 'Ember', light: '#D9480F', dark: '#FF9F6B', soft: '#FFE3D3', softDark: '#4A2412' },
};
export const ACCENT_ORDER: AccentKey[] = ['storm', 'ocean', 'mint', 'berry', 'ember'];

export type Theme = {
  dark: boolean;
  appearance: Appearance;
  accentKey: AccentKey;
  // Role names kept compatible with every screen.
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  surface: string; // the table
  surfaceContainerLowest: string;
  surfaceContainerLow: string; // a print
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
  onSurface: string;
  onSurfaceVariant: string;
  outline: string;
  outlineVariant: string;
  error: string;
  errorContainer: string;
  onErrorContainer: string;
  // Photobooth extras.
  print: string;
  printShadow: string;
  stamp: string;
  tape: string;
  fire: string;
  fireContainer: string;
  onFireContainer: string;
  shield: string;
};

export function makeTheme(appearance: Appearance, accentKey: AccentKey, systemDark: boolean): Theme {
  const dark = appearance === 'auto' ? systemDark : appearance === 'dark';
  const a = ACCENTS[accentKey] ?? ACCENTS.storm;
  const primary = dark ? a.dark : a.light;
  if (dark)
    return {
      dark,
      appearance,
      accentKey,
      primary,
      onPrimary: '#0E1322',
      primaryContainer: primary,
      onPrimaryContainer: '#0E1322',
      secondaryContainer: a.softDark,
      onSecondaryContainer: '#EEF1F8',
      tertiaryContainer: '#4A3A0E',
      onTertiaryContainer: '#FFE7A8',
      surface: '#0E1322',
      surfaceContainerLowest: '#0A0E1A',
      surfaceContainerLow: '#172036',
      surfaceContainer: '#1B2540',
      surfaceContainerHigh: '#212C4A',
      surfaceContainerHighest: '#2A3657',
      onSurface: '#EEF1F8',
      onSurfaceVariant: '#9BA6C2',
      outline: '#5D6889',
      outlineVariant: '#2B3654',
      error: '#FF8A80',
      errorContainer: '#5C1A17',
      onErrorContainer: '#FFDAD6',
      print: '#F3F1EC',
      printShadow: '#000000',
      stamp: '#FF7A2E',
      tape: 'rgba(255,240,190,0.55)',
      fire: '#FFB020',
      fireContainer: '#3D2A06',
      onFireContainer: '#FFD98A',
      shield: '#7FB6FF',
    };
  return {
    dark,
    appearance,
    accentKey,
    primary,
    onPrimary: '#FFFFFF',
    primaryContainer: primary,
    onPrimaryContainer: '#FFFFFF',
    secondaryContainer: a.soft,
    onSecondaryContainer: '#121A2E',
    tertiaryContainer: '#FFEDB8',
    onTertiaryContainer: '#4A3500',
    surface: '#E4ECF7',
    surfaceContainerLowest: '#FFFFFF',
    surfaceContainerLow: '#FFFFFF',
    surfaceContainer: '#F2F6FC',
    surfaceContainerHigh: '#D7E1EF',
    surfaceContainerHighest: '#CAD6E7',
    onSurface: '#121A2E',
    onSurfaceVariant: '#55607A',
    outline: '#8A95AE',
    outlineVariant: '#C9D4E5',
    error: '#C62828',
    errorContainer: '#FFDAD6',
    onErrorContainer: '#5C0A0A',
    print: '#FFFFFF',
    printShadow: '#3A4E7A',
    stamp: '#FF6A1A',
    tape: 'rgba(255,236,170,0.75)',
    fire: '#FF9F0A',
    fireContainer: '#FFE7B3',
    onFireContainer: '#5A3700',
    shield: '#2F6FE4',
  };
}

export const ThemeContext = createContext<Theme>(makeTheme('auto', 'storm', false));
export const useTheme = () => useContext(ThemeContext);
export function useStyles<T>(make: (t: Theme) => T): T {
  const t = useTheme();
  return useMemo(() => make(t), [t, make]);
}

// Bricolage Grotesque for everything, Caveat for handwriting on prints, VT323 for the camera date stamp.
export const FONTS = {
  r: 'BricolageGrotesque_400Regular',
  m: 'BricolageGrotesque_500Medium',
  sb: 'BricolageGrotesque_600SemiBold',
  b: 'BricolageGrotesque_700Bold',
  xb: 'BricolageGrotesque_800ExtraBold',
  hand: 'Caveat_600SemiBold',
  stamp: 'VT323_400Regular',
};
const t = (size: number, line: number, family: string, spacing = 0): TextStyle => ({ fontFamily: family, fontSize: size, lineHeight: line, letterSpacing: spacing });

export const T = {
  displayLarge: t(56, 58, FONTS.xb, -1.5),
  displayLargeEmph: t(56, 58, FONTS.xb, -1.5),
  displayMedium: t(44, 46, FONTS.xb, -1),
  headlineLarge: t(32, 36, FONTS.xb, -0.6),
  headlineMedium: t(30, 34, FONTS.xb, -0.6),
  headlineMediumEmph: t(30, 34, FONTS.xb, -0.6),
  headlineSmall: t(24, 28, FONTS.b, -0.3),
  titleLarge: t(21, 26, FONTS.b, -0.2),
  titleLargeEmph: t(21, 26, FONTS.xb, -0.2),
  titleMedium: t(16, 21, FONTS.b, -0.1),
  titleSmall: t(14, 19, FONTS.b),
  bodyLarge: t(16, 23, FONTS.r),
  bodyMedium: t(14, 20, FONTS.r),
  bodySmall: t(12.5, 17, FONTS.r),
  labelLarge: t(14, 18, FONTS.sb),
  labelMedium: t(12, 16, FONTS.sb),
  labelSmall: t(11, 14, FONTS.sb),
  hero: { ...t(128, 120, FONTS.xb, -6), fontVariant: ['tabular-nums'] } as TextStyle,
  num: { fontVariant: ['tabular-nums'] } as TextStyle,
  hand: t(22, 24, FONTS.hand),
  stamp: t(20, 20, FONTS.stamp, 1),
};

export const S = { xs: 4, sm: 8, md: 12, lg: 16, lgInc: 20, xl: 24, xlInc: 28, xxl: 40, full: 999 };

const AVATAR = ['#FF6A1A', '#4A3AFF', '#0F8A5F', '#C2185B', '#0B6BCB', '#B7791F'];
export const colorFor = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR[h % AVATAR.length];
};
