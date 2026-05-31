import { colors } from '../constants/colors';

export function getRiskColor(status: string | null | undefined): string {
  if (status === "Safe") return colors.brandTeal;
  if (status === "Warning") return colors.brandYellow;
  if (status === "Danger") return colors.brandCoral;
  return colors.slate;
}

export function getDriftColor(drift: number): string {
  if (drift <= 5) return colors.success;
  if (drift <= 15) return colors.warning;
  return colors.error;
}

export function calculateDrift(target: number, current: number): number {
  return Math.abs(target - current);
}

export function getRiskStatusClass(status: string): string {
  const map: Record<string, string> = {
    Safe: 'bg-teal-100 text-teal-800',
    Warning: 'bg-yellow-100 text-yellow-800',
    Danger: 'bg-red-100 text-red-800',
  };
  return map[status] || 'bg-gray-100 text-gray-800';
}
