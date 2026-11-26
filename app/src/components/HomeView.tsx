import { useEffect, useRef } from 'react';
import {
  BookOpen,
  ChevronDown,
  GraduationCap,
  Lock,
  Network,
  Search,
} from 'lucide-react';
import { UI_COPY, type UiLang } from '../i18n';
import type { IndexedDocument, MentorionCapability } from '../../server/types';
import type { MainView } from './Sidebar';

interface HomeViewProps {
  documents: IndexedDocument[];
  conceptCount: number;
  lang: UiLang;
  mentorion: MentorionCapability;
  onOpenSearch: () => void;
  onChangeView: (view: MainView) => void;
  onRetryMentorion: () => void;
}

export function HomeView({
  documents,
  conceptCount,
  lang,
  mentorion,
  onOpenSearch,
  onChangeView,
  onRetryMentorion,
}: HomeViewProps) {
  const t = UI_COPY[lang];
  const freshCount = documents.filter((d) => d.review === 'fresh').length;
  const showMentorion = mentorion.configured;
  const rootRef = useRef<HTMLElement>(null);
  const aboutRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const targets = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (targets.length === 0) return;

    if (typeof IntersectionObserver === 'undefined') {
      targets.forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        }
      },
      { root, threshold: 0.16, rootMargin: '0px 0px -40px 0px' },
    );

    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [showMentorion]);

  return (
    <main ref={rootRef} className="main-pane home-main">
      {/* SECTION 1: FULL-VIEWPORT HERO COVER */}
      <section className="home-hero-cover">
        <div className="home-hero-ambient" aria-hidden="true" />
        <div className="home-hero-inner">
          <div className="home-eyebrow">{t.homeEyebrow}</div>
          <h1 className="home-title">Nexus</h1>
          <p className="home-tagline">{t.homeTagline}</p>
          <div className="home-stats">
            <span>{t.docsCount(documents.length)}</span>
            <span className="meta-sep">·</span>
            <span>{t.termsCount(conceptCount)}</span>
            <span className="meta-sep">·</span>
            <span className={freshCount > 0 ? 'home-stat-fresh' : ''}>
              {t.homeFreshCount(freshCount)}
            </span>
          </div>
        </div>

        <button
          className="home-scroll-cue"
          onClick={() =>
            aboutRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
          aria-label="Scroll to About Nexus"
        >
          <ChevronDown size={20} />
        </button>
      </section>

      {/* SECTION 2: ABOUT NEXUS */}
      <section ref={aboutRef} className="home-section home-about-section">
        <div className="home-section-inner reveal-block" data-reveal>
          <div className="home-section-kicker">01 · PHILOSOPHY</div>
          <h2 className="home-section-heading">{t.homeAboutTitle}</h2>
          <p className="home-about-lead">{t.homeAboutLead}</p>

          <div className="home-pillars-grid">
            <div className="home-pillar-card reveal-block" data-reveal style={{ transitionDelay: '80ms' }}>
              <span className="home-pillar-num">01</span>
              <p>{t.homeAboutPoint1}</p>
            </div>
            <div className="home-pillar-card reveal-block" data-reveal style={{ transitionDelay: '160ms' }}>
              <span className="home-pillar-num">02</span>
              <p>{t.homeAboutPoint2}</p>
            </div>
            <div className="home-pillar-card reveal-block" data-reveal style={{ transitionDelay: '240ms' }}>
              <span className="home-pillar-num">03</span>
              <p>{t.homeAboutPoint3}</p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: 3 OR 4 QUICK ACTION OPTIONS */}
      <section className="home-section home-options-section">
        <div className="home-section-inner reveal-block" data-reveal>
          <div className="home-section-kicker">02 · WORKSPACE</div>
          <h2 className="home-section-heading">
            {lang === 'zh-Hant' ? '探索與工具' : 'Explore & Tools'}
          </h2>

          <div
            className={`home-options-grid ${showMentorion ? 'cols-4' : 'cols-3'}`}
          >
            <button
              className="home-option-card reveal-block"
              data-reveal
              style={{ transitionDelay: '60ms' }}
              onClick={onOpenSearch}
            >
              <span className="home-option-icon">
                <Search size={28} strokeWidth={1.6} />
              </span>
              <span className="home-option-label">{t.search}</span>
              <span className="home-option-hint">⌘K</span>
            </button>

            <button
              className="home-option-card reveal-block"
              data-reveal
              style={{ transitionDelay: '130ms' }}
              onClick={() => onChangeView('graph')}
            >
              <span className="home-option-icon">
                <Network size={28} strokeWidth={1.6} />
              </span>
              <span className="home-option-label">{t.knowledgeGraph}</span>
              <span className="home-option-hint">{t.homeOptionGraphHint}</span>
            </button>

            <button
              className="home-option-card reveal-block"
              data-reveal
              style={{ transitionDelay: '200ms' }}
              onClick={() => onChangeView('ontology')}
            >
              <span className="home-option-icon">
                <BookOpen size={28} strokeWidth={1.6} />
              </span>
              <span className="home-option-label">{t.terminology}</span>
              <span className="home-option-hint">{t.termsCount(conceptCount)}</span>
            </button>

            {showMentorion && (
              <button
                className={`home-option-card reveal-block ${
                  mentorion.online ? 'mentorion-online' : 'locked'
                }`}
                data-reveal
                style={{ transitionDelay: '270ms' }}
                title={mentorion.online ? t.mentorionNav : t.mentorionLockedHint}
                onClick={() => {
                  if (mentorion.online) {
                    onChangeView('mentorion');
                  } else {
                    onRetryMentorion();
                  }
                }}
              >
                <span className="home-option-icon">
                  <GraduationCap size={28} strokeWidth={1.6} />
                </span>
                <span className="home-option-label">{t.mentorionNav}</span>
                <span className="home-option-hint home-option-status">
                  {mentorion.online ? (
                    <>
                      <span className="nav-live-dot" />
                      <span>{t.statusOnline}</span>
                    </>
                  ) : (
                    <>
                      <Lock size={11} />
                      <span>{t.statusOfflineLocked}</span>
                    </>
                  )}
                </span>
              </button>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
