export const colors = {
  primary: "#1c1c1e",
  onPrimary: "#ffffff",
  brandTeal: "#0fbcb0",
  tealLight: "#e0f7f6",
  brandYellow: "#ffd02f",
  brandCoral: "#ff9999",
  coralLight: "#fdeced",
  brandBlue: "#4262ff",
  canvas: "#ffffff",
  surface: "#f7f8fa",
  surfaceSoft: "#fafbfc",
  hairline: "#e0e2e8",
  ink: "#1c1c1e",
  slate: "#555a6a",
  success: "#00b473",
  warning: "#f4d03f",
  error: "#ba1a1a",
};

export const EXCHANGE_RATE = 35;

// === Theme color system for buttons and toggles ===
export const buttonTheme = {
  side: {
    LONG: { bg: 'bg-emerald-600', border: 'border-emerald-600', text: 'text-white', inactiveText: 'text-white/70 hover:text-white', inactiveBg: 'bg-white' },
    SHORT: { bg: 'bg-red-500', border: 'border-red-500', text: 'text-white', inactiveText: 'text-white/70 hover:text-white', inactiveBg: 'bg-white' },
  },
  optionType: {
    Call: { bg: 'bg-blue-600', border: 'border-blue-600', text: 'text-white', inactiveText: 'text-white/70 hover:text-white', inactiveBg: 'bg-white' },
    Put: { bg: 'bg-orange-500', border: 'border-orange-500', text: 'text-white', inactiveText: 'text-white/70 hover:text-white', inactiveBg: 'bg-white' },
  },
} as const;

export const allocationColors = [
  "#0fbcb0",  // teal
  "#4262ff",  // blue
  "#ffd02f",  // yellow
  "#ff9999",  // coral
  "#9b59b6",  // purple
  "#e67e22",  // orange
  "#2ecc71",  // green
  "#e74c3c",  // red
  "#1abc9c",  // turquoise
  "#f39c12",  // amber
  "#3498db",  // sky blue
  "#95a5a6",  // grey
];
