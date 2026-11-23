import type { MappingDiagnostics } from '../lib/api';

/** One sentence for a mapping JSON the browser cannot parse. */
export const MAPPING_JSON_INVALID = 'Mapping config must be valid JSON.';

export type ParsedMappingConfig =
  | { ok: true; value: unknown | null }
  | { ok: false };

/**
 * Parses the mapping textarea. An empty field means "no mapping" (legacy
 * custom tables), not invalid JSON.
 */
export function parseMappingConfig(raw: string): ParsedMappingConfig {
  const text = raw.trim();
  if (!text) return { ok: true, value: null };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

/** `Connection successful · orders 6 · history 4 · account 3`, or null. */
export function formatDiagnostics(diagnostics?: MappingDiagnostics | null): string | null {
  if (!diagnostics) return null;
  const parts: string[] = [];
  if (diagnostics.orders_rows != null) parts.push(`orders ${diagnostics.orders_rows}`);
  if (diagnostics.history_rows != null) parts.push(`history ${diagnostics.history_rows}`);
  if (diagnostics.account_rows != null) parts.push(`account ${diagnostics.account_rows}`);
  return parts.length > 0 ? `Connection successful · ${parts.join(' · ')}` : null;
}
