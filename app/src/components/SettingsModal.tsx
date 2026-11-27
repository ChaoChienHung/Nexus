import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, FolderOpen, Lock, Moon, RefreshCw, Sun, X } from 'lucide-react';
import { SUPPORTED_LANGUAGES, UI_COPY, type UiLang } from '../i18n';
import type { MentorionCapability, VaultOption } from '../../server/types';

interface SettingsModalProps {
  open: boolean;
  theme: 'light' | 'dark';
  lang: UiLang;
  mentorion: MentorionCapability;
  vaults: VaultOption[];
  activeVaultPath: string;
  onChangeTheme: (theme: 'light' | 'dark') => void;
  onChangeLang: (lang: UiLang) => void;
  onSwitchVault: (vaultPath: string, label?: string) => Promise<void>;
  onRefreshCapabilities: () => Promise<void>;
  onClose: () => void;
}

export function SettingsModal({
  open,
  theme,
  lang,
  mentorion,
  vaults,
  activeVaultPath,
  onChangeTheme,
  onChangeLang,
  onSwitchVault,
  onRefreshCapabilities,
  onClose,
}: SettingsModalProps) {
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [customVaultPath, setCustomVaultPath] = useState('');
  const [switchingVault, setSwitchingVault] = useState(false);
  const [vaultError, setVaultError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  async function handleSelectVault(pathStr: string, label?: string) {
    if (!pathStr.trim() || switchingVault) return;
    setSwitchingVault(true);
    setVaultError(null);
    try {
      await onSwitchVault(pathStr.trim(), label);
      setCustomVaultPath('');
    } catch (err) {
      setVaultError(err instanceof Error ? err.message : String(err));
    } finally {
      setSwitchingVault(false);
    }
  }

  useEffect(() => {
    if (!open) setLangMenuOpen(false);
  }, [open]);

  useEffect(() => {
    if (!langMenuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setLangMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLangMenuOpen(false);
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [langMenuOpen]);

  if (!open) return null;
  const t = UI_COPY[lang];
  const currentLangLabel =
    SUPPORTED_LANGUAGES.find((o) => o.value === lang)?.label ?? lang;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <div style={{ fontSize: 17, fontWeight: 600 }}>{t.settings}</div>
          <button className="icon-btn" onClick={onClose} title="Close">
            <X size={17} />
          </button>
        </div>

        <div className="settings-body">
          <div className="settings-row">
            <div>
              <div className="settings-label">{t.language}</div>
              <div className="settings-desc">{t.languageHint}</div>
            </div>

            <div className="custom-dropdown" ref={dropdownRef}>
              <button
                type="button"
                className={`custom-dropdown-trigger ${langMenuOpen ? 'open' : ''}`}
                aria-haspopup="listbox"
                aria-expanded={langMenuOpen}
                onClick={() => setLangMenuOpen((o) => !o)}
              >
                <span>{currentLangLabel}</span>
                <ChevronDown
                  size={15}
                  className={`custom-dropdown-chevron ${langMenuOpen ? 'rotated' : ''}`}
                />
              </button>

              {langMenuOpen && (
                <div className="custom-dropdown-menu" role="listbox">
                  {SUPPORTED_LANGUAGES.map((opt) => {
                    const selected = opt.value === lang;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        className={`custom-dropdown-option ${selected ? 'selected' : ''}`}
                        onClick={() => {
                          onChangeLang(opt.value);
                          setLangMenuOpen(false);
                        }}
                      >
                        <span>{opt.label}</span>
                        {selected && <Check size={14} style={{ color: 'var(--accent)' }} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="settings-row">
            <div>
              <div className="settings-label">{t.appearance}</div>
            </div>
            <div className="graph-modes" style={{ flexShrink: 0, gap: 18 }}>
              <button
                className={`graph-mode-btn ${theme === 'light' ? 'active' : ''}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 15 }}
                onClick={() => onChangeTheme('light')}
              >
                <Sun size={14} />
                {t.light}
              </button>
              <button
                className={`graph-mode-btn ${theme === 'dark' ? 'active' : ''}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 15 }}
                onClick={() => onChangeTheme('dark')}
              >
                <Moon size={14} />
                {t.dark}
              </button>
            </div>
          </div>

          <div className="settings-row">
            <div>
              <div className="settings-label">{t.integrations} · Mentorion</div>
              <div className="settings-desc">
                {mentorion.configured && mentorion.apiUrl
                  ? mentorion.apiUrl
                  : t.integrationsHint}
              </div>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <span
                className={`integration-badge ${
                  !mentorion.configured
                    ? 'unconfigured'
                    : mentorion.online
                      ? 'online'
                      : 'locked'
                }`}
              >
                {mentorion.configured && !mentorion.online && <Lock size={11} />}
                <span>
                  {!mentorion.configured
                    ? t.statusUnconfigured
                    : mentorion.online
                      ? t.statusOnline
                      : t.statusOfflineLocked}
                </span>
              </span>
              {mentorion.configured && (
                <button
                  type="button"
                  className="icon-btn"
                  title={t.retryProbe}
                  onClick={() => void onRefreshCapabilities()}
                >
                  <RefreshCw size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="settings-row settings-row-col">
            <div>
              <div className="settings-label">{t.vaultSection}</div>
              <div className="settings-desc">{t.vaultHint}</div>
            </div>

            {vaults.length > 0 && (
              <div className="vault-list">
                {vaults.map((v) => {
                  const isActive = v.path === activeVaultPath;
                  return (
                    <button
                      key={v.path}
                      type="button"
                      className={`vault-row ${isActive ? 'active' : ''}`}
                      disabled={switchingVault || !v.exists || isActive}
                      onClick={() => void handleSelectVault(v.path, v.label)}
                    >
                      <FolderOpen size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      <div className="vault-row-text">
                        <span className="vault-row-label">{v.label}</span>
                        <span className="vault-row-path" title={v.path}>
                          {v.path}
                        </span>
                      </div>
                      {isActive && <Check size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="vault-add-row">
              <input
                type="text"
                className="ask-config-input"
                placeholder={t.vaultAddPlaceholder}
                value={customVaultPath}
                onChange={(e) => setCustomVaultPath(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleSelectVault(customVaultPath);
                  }
                }}
              />
              <button
                type="button"
                className="btn"
                disabled={!customVaultPath.trim() || switchingVault}
                onClick={() => void handleSelectVault(customVaultPath)}
              >
                {t.vaultSwitchBtn}
              </button>
            </div>
            {vaultError && <div className="vault-error">{vaultError}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
