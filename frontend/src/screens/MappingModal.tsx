import { useEffect, useState, type CSSProperties, type FC } from 'react';
import { api } from '../lib/api';
import type {
  MappingTemplate,
  PortfolioConnection,
} from '../lib/api';
import ModalShell from './components/ModalShell';
import { MODAL_CARD, MODAL_HEADER, MODAL_BODY, MODAL_FOOTER } from './components/modalLayout';
import { Field, SelectInput } from './components/Field';
import {
  CONTROL_BUTTON_PRIMARY,
  CONTROL_BUTTON_SECONDARY,
  CONTROL_HELPER,
  CONTROL_INPUT,
  CONTROL_LABEL,
  CONTROL_TITLE,
} from './components/controlStyles';
import {
  MAPPING_JSON_INVALID,
  formatDiagnostics,
  parseMappingConfig,
} from '../utils/mapping';

/** One sentence for a portfolio without any mapping config. */
const MAPPING_REQUIRED = 'Choose a mapping template or paste a mapping config.';

const modalPanelStyle = {
  padding: 'var(--space-md)',
  borderRadius: 'var(--rounded-xl)',
} as const;

const readonlyValue = {
  ...CONTROL_INPUT,
  background: 'var(--color-surface)',
  fontWeight: 600,
  borderColor: 'transparent',
} as const;

const jsonInput: CSSProperties = {
  ...CONTROL_INPUT,
  minHeight: 240,
  resize: 'vertical',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  lineHeight: 1.45,
  whiteSpace: 'pre',
  overflow: 'auto',
};

interface MappingModalProps {
  portfolioId: number;
  portfolioName: string;
  /** Template selected on the portfolio row; shown, never auto-applied. */
  currentTemplate?: string | null;
  showModal: boolean;
  onClose: () => void;
  onSaved: () => void;
}

/** Host / mapping admin for one custom portfolio; never renders the password. */
const MappingModal: FC<MappingModalProps> = ({
  portfolioId, portfolioName, currentTemplate, showModal, onClose, onSaved,
}) => {
  const [connection, setConnection] = useState<PortfolioConnection | null>(null);
  const [templates, setTemplates] = useState<MappingTemplate[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [mappingConfigStr, setMappingConfigStr] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [testStatus, setTestStatus] = useState<{
    ok: boolean;
    message: string;
    mappingIssues: boolean;
  } | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!showModal) return;
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    setJsonError('');
    setSaveError('');
    setTestStatus(null);
    setTemplateName('');

    api.getConnection(portfolioId)
      .then((row) => {
        if (cancelled) return;
        setConnection(row);
        setMappingConfigStr(row.mapping_config != null ? JSON.stringify(row.mapping_config, null, 2) : '');
      })
      .catch((err) => {
        console.error('Failed to load portfolio connection:', err);
        if (!cancelled) setLoadError("Couldn't load the connection. Try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    api.getMappingTemplates()
      .then((rows) => {
        if (!cancelled) setTemplates(rows);
      })
      .catch((err) => console.error('Failed to load mapping templates:', err));

    return () => { cancelled = true; };
  }, [showModal, portfolioId]);

  const handleTemplateChange = (name: string) => {
    setTemplateName(name);
    const template = templates.find((row) => row.name === name);
    if (!template) return;
    setMappingConfigStr(JSON.stringify(template.config, null, 2));
    setJsonError('');
    setTestStatus(null);
  };

  const handleTest = async () => {
    const parsed = parseMappingConfig(mappingConfigStr);
    if (!parsed.ok) {
      setJsonError(MAPPING_JSON_INVALID);
      setTestStatus(null);
      return;
    }
    if (!connection) return;
    setJsonError('');
    setTesting(true);
    setTestStatus(null);
    try {
      const result = await api.testStoredConnection(portfolioId, {
        mapping_config: parsed.value,
      });
      const mappingIssues = Boolean(result.diagnostics?.errors?.length);
      if (mappingIssues) console.error('Mapping diagnostics reported problems:', result.diagnostics?.errors);
      setTestStatus({
        ok: true,
        message: formatDiagnostics(result.diagnostics) ?? result.message ?? 'Connection successful',
        mappingIssues,
      });
    } catch (err) {
      console.error('Connection test failed:', err);
      setTestStatus({ ok: false, message: "Couldn't test the connection. Try again.", mappingIssues: false });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!mappingConfigStr.trim()) {
      setJsonError(MAPPING_REQUIRED);
      return;
    }
    const parsed = parseMappingConfig(mappingConfigStr);
    if (!parsed.ok) {
      setJsonError(MAPPING_JSON_INVALID);
      return;
    }
    setJsonError('');
    setSaving(true);
    setSaveError('');
    try {
      await api.updateConnection(portfolioId, { mapping_config: parsed.value });
      onSaved();
      onClose();
    } catch (err) {
      console.error('Failed to save portfolio connection:', err);
      setSaveError("Couldn't save the connection. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const testDisabled = testing || saving || !connection;
  const saveDisabled = saving || !connection;

  return (
    <ModalShell open={showModal} onClose={onClose} title="Database connection">
      <div className={`${MODAL_CARD} w-full max-w-2xl mx-4`} style={modalPanelStyle}>
        <div className={`${MODAL_HEADER} flex justify-between items-center`} style={{ marginBottom: 16 }}>
          <div>
            <h3 style={CONTROL_TITLE}>Database connection</h3>
            <p style={{ ...CONTROL_HELPER, margin: '3px 0 0' }}>{portfolioName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-surface-soft rounded-full transition-colors"
            aria-label="Close connection settings"
          >
            <svg className="w-5 h-5 text-slate" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={MODAL_BODY}>
          {loading ? (
            <p style={CONTROL_HELPER}>Loading connection…</p>
          ) : loadError ? (
            <p style={{ ...CONTROL_HELPER, color: 'var(--color-danger-text)' }}>{loadError}</p>
          ) : connection ? (
            <div className="flex flex-col" style={{ gap: 12 }}>
              <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 12 }}>
                <Field label="Host">
                  <div style={readonlyValue}>{connection.db_host || '—'}</div>
                </Field>
                <Field label="Port">
                  <div style={readonlyValue}>{connection.db_port ?? '—'}</div>
                </Field>
                <Field label="Database">
                  <div style={readonlyValue}>{connection.db_name || '—'}</div>
                </Field>
                <Field label="Username">
                  <div style={readonlyValue}>{connection.db_user || '—'}</div>
                </Field>
              </div>

              <Field
                label="Mapping template"
                htmlFor="mapping-template"
                hint={`Current template: ${currentTemplate || 'none'}. Choosing a template replaces the JSON below; editing the JSON keeps the chosen template selected.`}
              >
                <SelectInput
                  id="mapping-template"
                  value={templateName}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                >
                  <option value="">Keep current mapping</option>
                  {templates.map((template) => (
                    <option key={template.name} value={template.name}>{template.label}</option>
                  ))}
                </SelectInput>
              </Field>

              <div>
                <label style={CONTROL_LABEL} htmlFor="mapping-config">Mapping config (JSON)</label>
                <textarea
                  id="mapping-config"
                  value={mappingConfigStr}
                  onChange={(e) => {
                    setMappingConfigStr(e.target.value);
                    setJsonError('');
                  }}
                  style={jsonInput}
                  placeholder='{"version": 1, "template": "tfex-settrade-v1", "entities": {…}}'
                  spellCheck={false}
                />
                {jsonError ? (
                  <p style={{ ...CONTROL_HELPER, color: 'var(--color-danger-text)' }}>{jsonError}</p>
                ) : (
                  <p style={CONTROL_HELPER}>
                    Mapping identifiers are validated on the server.
                  </p>
                )}
              </div>

              <div className="flex items-start gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={testDisabled}
                  className={`transition-opacity ${testDisabled ? 'opacity-50' : 'hover:opacity-90'}`}
                  style={{
                    ...CONTROL_BUTTON_SECONDARY,
                    height: 'var(--control-h)',
                    cursor: testDisabled ? 'not-allowed' : 'pointer',
                  }}
                >
                  {testing ? 'Testing...' : 'Test Connection'}
                </button>
                {testStatus && (
                  <div
                    role="status"
                    style={{
                      flex: '1 1 260px',
                      padding: 'var(--space-xs) var(--space-sm)',
                      borderRadius: 'var(--rounded-md)',
                      fontSize: 'var(--fs-label)',
                      background: testStatus.ok ? 'var(--color-teal-light)' : 'var(--color-coral-light)',
                      color: testStatus.ok ? 'var(--color-positive-text)' : 'var(--color-danger-text)',
                    }}
                  >
                    <div>{testStatus.ok ? '✓ ' : '✗ '}{testStatus.message}</div>
                    {testStatus.mappingIssues && (
                      <div style={{ marginTop: 2 }}>The mapping config has problems. Check the JSON and test again.</div>
                    )}
                  </div>
                )}
              </div>

              {saveError && (
                <p style={{ ...CONTROL_HELPER, color: 'var(--color-danger-text)', margin: 0 }}>{saveError}</p>
              )}
            </div>
          ) : null}
        </div>

        <div className={`${MODAL_FOOTER} flex justify-end gap-3`} style={{ marginTop: 12 }}>
          <button
            type="button"
            onClick={onClose}
            style={CONTROL_BUTTON_SECONDARY}
            className="transition-colors hover:bg-surface-soft"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saveDisabled}
            className="transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={CONTROL_BUTTON_PRIMARY}
          >
            {saving ? 'Saving...' : 'Save connection'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
};

export default MappingModal;
