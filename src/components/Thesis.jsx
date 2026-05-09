export default function Thesis() {
  return (
    <section className="thesis" id="thesis">
      <div className="thesis__inner">
        <p className="thesis__overline">The premise</p>
        <p className="thesis__lead">
          The number on the listing isn't the number you pay. <em>The real
          monthly is the listing plus everything that follows it</em> — and
          everything that follows it moves with the price and the tax bill.
        </p>
        <div className="thesis__body">
          <p>
            Your lender quotes principal and interest. Your county quotes a
            tax rate. Your insurer quotes a percent of insured value. PMI shows
            up below 20% down. HOA shows up depending on the building. Each is
            a function of inputs you only half-control — and the sum is the
            thing you actually have to write a check for.
          </p>
          <p>
            So instead of running the calculator once and squinting at a single
            number, this draws the whole grid. Every plausible price across the
            x-axis. Every plausible tax bill up the y-axis. Color is the
            monthly. The boundary line below shows where buying beats your
            current rent. Click any cell to see what thirty years of that
            payment actually does.
          </p>
        </div>
      </div>
    </section>
  );
}
