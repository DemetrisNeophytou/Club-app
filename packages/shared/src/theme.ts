// PORTAL design system — locked palette (spec §5). Dark only. Never neon green.
export const palette = {
  abyss: "#080C16",
  deep: "#0E1524",
  card: "#141D31",
  line: "#233049",
  copper: "#D98A52",
  copperHi: "#F2A868",
  seaglass: "#5AC8BE",
  bone: "#F1ECE1",
  dim: "#8A94AB",
} as const;

// Tailwind/NativeWind color map — shared by apps/mobile and apps/venues.
export const tailwindColors = {
  abyss: palette.abyss,
  deep: palette.deep,
  card: palette.card,
  line: palette.line,
  copper: { DEFAULT: palette.copper, hi: palette.copperHi },
  seaglass: palette.seaglass,
  bone: palette.bone,
  dim: palette.dim,
} as const;
