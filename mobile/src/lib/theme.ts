import { Platform, useColorScheme } from 'react-native';

const light = {
  bg: '#faf9f5',
  bgElev: '#ffffff',
  surface: '#f3f1ea',
  surface2: '#e9e6dc',
  border: 'rgba(31,30,29,0.09)',
  borderStrong: 'rgba(31,30,29,0.16)',
  text: '#1f1e1d',
  text2: '#5e5d59',
  text3: '#8f8d86',
  accent: '#c96442',
  accentPress: '#b4553a',
  accentSoft: 'rgba(201,100,66,0.10)',
  onAccent: '#ffffff',
  green: '#2f9e5f',
  red: '#d64535',
  amber: '#c98a1a',
  amberSoft: 'rgba(201,138,26,0.12)',
  redSoft: 'rgba(214,69,53,0.10)',
  codeBg: '#f3f1ea',
  termBg: '#1d1c1a',
  termText: '#e8e4da',
  diffAdd: 'rgba(47,158,95,0.13)',
  diffDel: 'rgba(214,69,53,0.12)',
  scrim: 'rgba(20,20,19,0.4)',
  dark: false,
};

const dark: typeof light = {
  bg: '#141413',
  bgElev: '#1d1c1a',
  surface: '#242320',
  surface2: '#2e2c29',
  border: 'rgba(255,252,240,0.08)',
  borderStrong: 'rgba(255,252,240,0.15)',
  text: '#f2efe8',
  text2: '#b8b4aa',
  text3: '#807d76',
  accent: '#d97757',
  accentPress: '#c4673f',
  accentSoft: 'rgba(217,119,87,0.15)',
  onAccent: '#1a0f0a',
  green: '#6cc28c',
  red: '#ef7365',
  amber: '#e8b04b',
  amberSoft: 'rgba(232,176,75,0.13)',
  redSoft: 'rgba(239,115,101,0.12)',
  codeBg: '#1d1c1a',
  termBg: '#0d0d0c',
  termText: '#e8e4da',
  diffAdd: 'rgba(108,194,140,0.14)',
  diffDel: 'rgba(239,115,101,0.14)',
  scrim: 'rgba(0,0,0,0.6)',
  dark: true,
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

export const fonts = {
  serif: Platform.select({ ios: 'Georgia', default: 'serif' }),
  mono: Platform.select({ ios: 'Menlo', default: 'monospace' }),
};
