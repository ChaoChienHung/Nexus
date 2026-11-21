import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Moon, Sun, X } from 'lucide-react';
import { SUPPORTED_LANGUAGES, UI_COPY, type UiLang } from '../i18n';

interface SettingsModalProps {
  open: boolean;
  theme: 'light' | 'dark';
  lang: UiLang;
  onChangeTheme: (theme: 'light' | 'dark') => void;
  onChangeLang: (lang: UiLang) => void;
  onClose: () => void;
}

export function SettingsModal({
  open,
  theme,
  lang,
  onChangeTheme,
  onChangeLang,
  onClose,
}: SettingsModalProps) {
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
        </div>
      </div>
    </div>
  );
}
