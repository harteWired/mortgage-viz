export default function Footer({ repoUrl }) {
  return (
    <footer className="app-footer">
      <div className="app-footer__inner">
        <span>© Matt Harte · Mortgage Viz</span>
        <nav className="app-footer__links">
          <a href="https://lab.mattharte.com/">harteWired</a>
          <a href={repoUrl} target="_blank" rel="noopener">GitHub</a>
          <a href="#methodology">Methodology</a>
        </nav>
      </div>
    </footer>
  );
}
