import { useEffect, useState } from "react";

const ICONS = {
  sun: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M3.5 12.5l1.4-1.4M11.1 4.9l1.4-1.4" />
    </svg>
  ),
  moon: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13.5 8.5a5.5 5.5 0 0 1-6-6 5.5 5.5 0 1 0 6 6z" />
    </svg>
  ),
  share: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8l5-5v3c5 0 5 5 5 5-1.5-1.5-3-2-5-2v3l-5-4z" />
    </svg>
  ),
  github: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
    </svg>
  ),
};

export default function Nav({ theme, onToggleTheme, onShare, repoUrl, compact = false, slot = null }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (compact) return; // Tool-mode nav doesn't react to scroll — main is the scroll container.
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [compact]);

  return (
    <header
      className={
        "app-nav" +
        (compact ? " app-nav--compact" : "") +
        (!compact && scrolled ? " app-nav--scrolled" : "")
      }
    >
      <div className="app-nav__inner">
        <a className="app-nav__lab-link" href="https://github.com/harteWired">
          harteWired
        </a>

        <span className="app-nav__wordmark">
          Mortgage <em>Viz</em>
        </span>

        <div className="app-nav__actions">
          {slot}
          <button
            className="icon-btn"
            onClick={onShare}
            aria-label="Copy shareable link"
            title="Copy shareable link"
          >
            {ICONS.share}
          </button>
          <a
            className="icon-btn"
            href={repoUrl}
            target="_blank"
            rel="noopener"
            aria-label="View on GitHub"
            title="View on GitHub"
          >
            {ICONS.github}
          </a>
          <button
            className="icon-btn"
            onClick={onToggleTheme}
            aria-label="Toggle theme"
            title="Toggle theme"
          >
            {theme === "dark" ? ICONS.sun : ICONS.moon}
          </button>
        </div>
      </div>
    </header>
  );
}
