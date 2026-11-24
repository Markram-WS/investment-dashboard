import { useEffect, useState, type CSSProperties, type FC } from 'react';
import { api } from '../lib/api';
import type {
  ConnectionTestResult,
  ConnectionUpdatePayload,
  MappingTemplate,
  PortfolioConnection,
} from '../lib/api';
import ModalShell from './components/ModalShell';
import { MODAL_CARD, MODAL_HEADER, MODAL_BODY, MODAL_FOOTER } from './components/modalLayout';
import { Field, SelectInput, TextInput } from './components/Field';
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

/** One sentence for a port outside the valid TCP range. */
const PORT_INVALID = 'Port must be between 1 and 65535.';

/** One sentence for testing edited credentials without the password. */
const TEST_PASSWORD_REQUIRED = 'Enter the password to test the new connection.';

/** Parse the port field; null when it is not an integer in 1..65535. */
const parsePort = (value: string): number | null => {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const port = Number(trimmed);
  return port >= 1 && port <= 65535 ? port : null;
};

const modalPanelStyle = {
  padding: 'var(--space-md)',
  borderRadius: 'var(--rounded-xl)',
  background: 'var(--color-canvas)',
  border: '1px solid var(--color-hairline)',
} as const;

const jsonInput: CSSProperties = {
  ...CONTROL_INPUT,
  height: 'clamp(88px, 16vh, 128px)',
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
  const [host, setHost] = useState('');
  const [port, setPort] = useState('');
  const [dbName, setDbName] = useState('');
  const [dbUser, setDbUser] = useState('');
  const [password, setPassword] = useState('');
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
        setHost(row.db_host ?? '');
        setPort(row.db_port == null ? '' : String(row.db_port));
        setDbName(row.db_name ?? '');
        setDbUser(row.db_user ?? '');
        setPassword('');
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

  const connectionEdited = () => {
    if (!connection) return false;
    return (
      host !== (connection.db_host ?? '') ||
      port !== (connection.db_port == null ? '' : String(connection.db_port)) ||
      dbName !== (connection.db_name ?? '') ||
      dbUser !== (connection.db_user ?? '')
    );
  };

  const runConnectionTest = async (request: () => Promise<ConnectionTestResult>) => {
    setTesting(true);
    setTestStatus(null);
    try {
      const result = await request();
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

  const handleTest = async () => {
    const parsed = parseMappingConfig(mappingConfigStr);
    if (!parsed.ok) {
      setJsonError(MAPPING_JSON_INVALID);
      setTestStatus(null);
      return;
    }
    if (!connection) return;
    setJsonError('');

    if (!password) {
      if (connectionEdited()) {
        setTestStatus({ ok: false, message: TEST_PASSWORD_REQUIRED, mappingIssues: false });
        return;
      }
      await runConnectionTest(() => api.testStoredConnection(portfolioId, {
        mapping_config: parsed.value,
      }));
      return;
    }

    const portValue = parsePort(port);
    if (portValue === null) {
      setTestStatus({ ok: false, message: PORT_INVALID, mappingIssues: false });
      return;
    }

    // A typed password lets the edited credentials be tested before saving.
    await runConnectionTest(() => api.testConnection({
      db_host: host,
      db_port: portValue,
      db_name: dbName,
      db_user: dbUser,
      db_password: password,
      mapping_config: parsed.value,
    }));
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
    const portValue = parsePort(port);
    if (portValue === null) {
      setSaveError(PORT_INVALID);
      return;
    }
    setSaving(true);
    setSaveError('');
    const payload: ConnectionUpdatePayload = {
      db_host: host,
      db_port: portValue,
      db_name: dbName,
      db_user: dbUser,
      mapping_config: parsed.value,
    };
    if (password) payload.db_password = password;
    try {
      await api.updateConnection(portfolioId, payload);
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
      <div className={`${MODAL_CARD} w-full max-w-[560px] mx-4`} style={modalPanelStyle}>
        <div className={`${MODAL_HEADER} flex justify-between items-center`} style={{ marginBottom: 12 }}>
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
              <div>
                <div className="flex flex-col" style={{ gap: 10 }}>
                  <div
                    className="grid"
                    style={{ gridTemplateColumns: 'minmax(0, 1fr) 112px', gap: 10 }}
                  >
                    <Field label="Host" htmlFor="connection-host">
                      <TextInput
                        id="connection-host"
                        value={host}
                        onChange={(e) => setHost(e.target.value)}
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </Field>
                    <Field label="Port" htmlFor="connection-port">
                      <TextInput
                        id="connection-port"
                        value={port}
                        onChange={(e) => setPort(e.target.value)}
                        style={CONTROL_INPUT}
                        inputMode="numeric"
                        autoComplete="off"
                      />
                    </Field>
                  </div>

                  <div
                    className="grid"
                    style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 10 }}
                  >
                    <Field label="Database" htmlFor="connection-db-name">
                      <TextInput
                        id="connection-db-name"
                        value={dbName}
                        onChange={(e) => setDbName(e.target.value)}
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </Field>
                    <Field label="Username" htmlFor="connection-db-user">
                      <TextInput
                        id="connection-db-user"
                        value={dbUser}
                        onChange={(e) => setDbUser(e.target.value)}
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </Field>
                  </div>

                  <div
                    className="grid"
                    style={{ gridTemplateColumns: 'minmax(0, 1fr) 128px', gap: 10 }}
                  >
                    <Field label="Password" htmlFor="connection-password">
                      <TextInput
                        id="connection-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="leave blank to keep the current password"
                        autoComplete="new-password"
                        spellCheck={false}
                      />
                    </Field>
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                      <button
                        type="button"
                        onClick={handleTest}
                        disabled={testDisabled}
                        className={`transition-opacity ${testDisabled ? 'opacity-50' : 'hover:opacity-90'}`}
                        style={{
                          ...CONTROL_BUTTON_SECONDARY,
                          height: 'var(--control-h)',
                          width: '100%',
                          cursor: testDisabled ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {testing ? 'Testing...' : 'Test Connection'}
                      </button>
                    </div>
                  </div>
                </div>

                <div
                  role="status"
                  style={{
                    marginTop: 6,
                    minHeight: 18,
                    fontSize: 'var(--fs-label)',
                    lineHeight: '18px',
                    color: testStatus
                      ? (testStatus.ok ? 'var(--color-positive-text)' : 'var(--color-danger-text)')
                      : undefined,
                  }}
                >
                  {testStatus ? (
                    <>
                      {testStatus.ok ? '✓ ' : '✗ '}{testStatus.message}
                      {testStatus.mappingIssues
                        ? ' The mapping config has problems. Check the JSON and test again.'
                        : null}
                    </>
                  ) : null}
                </div>
              </div>

              <hr style={{ border: 0, borderTop: '1px solid var(--color-hairline)', margin: 0 }} />

              <div className="flex flex-col" style={{ gap: 8 }}>
                <Field
                  label="Mapping template"
                  htmlFor="mapping-template"
                  hint={`Current: ${currentTemplate || 'none'}. A template replaces the JSON below.`}
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
              </div>

              {saveError && (
                <p style={{ ...CONTROL_HELPER, color: 'var(--color-danger-text)', margin: 0 }}>{saveError}</p>
              )}
            </div>
          ) : null}
        </div>

        <div
          className={`${MODAL_FOOTER} flex justify-end gap-3`}
          style={{ marginTop: 12, borderTop: '1px solid var(--color-hairline)', paddingTop: 12 }}
        >
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
