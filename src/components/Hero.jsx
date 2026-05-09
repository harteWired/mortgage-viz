// Hand-rolled char-stagger entrance — splits the headline into
// per-character spans so CSS can stagger them. Avoids the GSAP
// SplitText paywall and works without GSAP at all.
function splitHeadline(text) {
  const words = text.split(" ");
  let charIndex = 0;
  return words.map((word, w) => (
    <span key={w} className="split-word">
      {Array.from(word).map((ch, c) => {
        const i = charIndex++;
        return (
          <span
            key={c}
            className="split-char"
            style={{ "--char-i": i }}
            aria-hidden="true"
          >
            {ch}
          </span>
        );
      })}
      {w < words.length - 1 && (
        <span
          className="split-char"
          style={{ "--char-i": charIndex++ }}
          aria-hidden="true"
        >
          {" "}
        </span>
      )}
    </span>
  ));
}

// Headline never changes — split it once at module load.
const HEADLINE_TEXT = "What does this house actually cost?";
const SPLIT_HEADLINE = splitHeadline(HEADLINE_TEXT);

export default function Hero({ onScrollToTool }) {

  // For screen readers — the split version is aria-hidden, so provide
  // a single accessible-name span.
  return (
    <section className="hero" aria-labelledby="hero-headline">
      <div className="hero__atmosphere" aria-hidden="true">
        <div className="hero__blob hero__blob--ember" />
        <div className="hero__blob hero__blob--iris" />
        <div className="hero__blob hero__blob--sage" />
      </div>

      <div className="hero__content">
        <span className="hero__overline">Mortgage Viz</span>

        <h1 className="hero__headline" id="hero-headline">
          <span className="sr-only">{HEADLINE_TEXT}</span>
          <span aria-hidden="true">{SPLIT_HEADLINE}</span>
        </h1>

        <p className="hero__subhead">
          Not the Zillow estimate. Not the lender's napkin math. A grid of every
          plausible price and tax — with P&amp;I, insurance, PMI, and HOA all
          baked in — so you can see the full landscape at once.
        </p>

        <button className="hero__scroll-cue" onClick={onScrollToTool} aria-label="Scroll to the tool">
          <span>Open the tool</span>
        </button>
      </div>
    </section>
  );
}
