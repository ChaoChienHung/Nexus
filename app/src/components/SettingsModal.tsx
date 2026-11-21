import { Moon, Sun, X } from 'lucide-react';
import { UI_COPY, type UiLang } from '../i18n';

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
  if (!open) return null;
  const t = UI_COPY[lang];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <div style={{ fontSize: 15, fontWeight: 650 }}>{t.settings}</div>
          <button className="icon-btn" onClick={onClose} title="Close">
            <X size={15} />
          </button>
        </div>

        <div className="settings-body">
          <div className="settings-row">
            <div>
              <div className="settings-label">{t.language}</div>
              <div className="settings-desc">{t.languageHint}</div>
            </div>
            <div className="graph-modes" style={{ flexShrink: 0 }}>
              <button
                className={`graph-mode-btn ${lang === 'zh-Hant' ? 'active' : ''}`}
                onClick={() => onChangeLang('zh-Hant')}
              >
                繁體中文
              </button>
              <button
                className={`graph-mode-btn ${lang === 'en' ? 'active' : ''}`}
                onClick={() => onChangeLang('en')}
              >
                English
              </button>
            </div>
          </div>

          <div className="settings-row">
            <div>
              <div className="settings-label">{t.appearance}</div>
            </div>
            <div className="graph-modes" style={{ flexShrink: 0 }}>
              <button
                className={`graph-mode-btn ${theme === 'light' ? 'active' : ''}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                onClick={() => onChangeTheme('light')}
              >
                <Sun size={12} />
                {t.light}
              </button>
              <button
                className={`graph-mode-btn ${theme === 'dark' ? 'active' : ''}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                onClick={() => onChangeTheme('dark')}
              >
                <Moon size={12} />
                {t.dark}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
