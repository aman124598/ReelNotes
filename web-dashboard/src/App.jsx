const metrics = [
  { value: '3x', label: 'Faster content recall' },
  { value: '24/7', label: 'Async extraction pipeline' },
  { value: '100%', label: 'Searchable note library' },
];

const proofCards = [
  {
    title: 'Capture from viral reels instantly',
    text: 'Drop in the reel, let ReelNotes queue the job, and turn fast-moving content into structured notes before the algorithm buries it.',
  },
  {
    title: 'Organize chaos into reusable knowledge',
    text: 'AI-assisted formatting turns rambling videos into clear headlines, action points, and searchable takeaways for creators and teams.',
  },
  {
    title: 'Keep your ideas even when you go offline',
    text: 'Local-first storage means your notes stay available, editable, and ready to use whether your network is strong or not.',
  },
];

const workflow = [
  'Paste an Instagram reel link',
  'Queue extraction through Supabase + worker automation',
  'Receive a polished, searchable note in seconds',
  'Reuse the insight for content, strategy, and execution',
];

const notes = [
  {
    tag: 'CREATOR OPS',
    title: '7 hooks from a growth reel',
    text: 'Saved as action items, not screenshots. ReelNotes separates hooks, CTA ideas, and script structure so you can ship faster.',
  },
  {
    tag: 'TEAM KNOWLEDGE',
    title: 'Sales lesson from a founder clip',
    text: 'One reel becomes a searchable asset your whole team can reuse in meetings, pitches, and content planning.',
  },
  {
    tag: 'PERSONAL SYSTEM',
    title: 'No more lost inspiration',
    text: 'Stop hunting through likes, saves, and DMs. Your best reel insights live in one clean library.',
  },
];

function LogoMark() {
  return (
    <div className="logo-mark" aria-hidden="true">
      <div className="logo-shell">
        <div className="logo-reel" />
        <div className="logo-play" />
      </div>
    </div>
  );
}

function App() {
  return (
    <div className="page-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="topbar">
        <div className="brand">
          <LogoMark />
          <div>
            <p className="eyebrow">REELNOTES</p>
            <p className="brand-subtitle">Turn reels into revenue-ready notes</p>
          </div>
        </div>

        <nav className="topnav">
          <a href="#features">Features</a>
          <a href="#workflow">Workflow</a>
          <a href="#pricing">Pricing</a>
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="section-kicker">Built to sell clarity</p>
            <h1>Stop losing winning ideas inside Instagram reels.</h1>
            <p className="hero-text">
              ReelNotes transforms fast-moving video content into structured, searchable notes your
              team can actually act on. Capture insights faster, repurpose them smarter, and build
              a knowledge system that compounds.
            </p>

            <div className="hero-actions">
              <a className="button button-primary" href="#pricing">
                Start Saving Reels
              </a>
              <a className="button button-secondary" href="#features">
                See Why It Converts
              </a>
            </div>

            <div className="metric-row">
              {metrics.map((metric) => (
                <article className="metric-card" key={metric.label}>
                  <strong>{metric.value}</strong>
                  <span>{metric.label}</span>
                </article>
              ))}
            </div>
          </div>

          <div className="hero-panel">
            <div className="dashboard-card">
              <div className="dashboard-topline">
                <span className="status-dot" />
                <p>Live product preview</p>
              </div>

              <div className="dashboard-grid">
                <section className="signal-card signal-primary">
                  <p className="mini-label">Newly captured</p>
                  <h2>Founder pricing framework</h2>
                  <ul>
                    <li>Hook and authority angle extracted</li>
                    <li>3 offer ideas broken into bullets</li>
                    <li>CTA language ready to reuse</li>
                  </ul>
                </section>

                <section className="signal-card">
                  <p className="mini-label">Search query</p>
                  <div className="search-pill">growth hooks for product launch</div>
                  <div className="result-stack">
                    <span>12 matching notes</span>
                    <span>4 creator playbooks</span>
                    <span>2 saved scripts</span>
                  </div>
                </section>

                <section className="signal-card">
                  <p className="mini-label">Processing queue</p>
                  <div className="progress-line">
                    <span style={{ width: '78%' }} />
                  </div>
                  <p className="queue-copy">Async pipeline extracts, formats, and delivers notes without slowing you down.</p>
                </section>
              </div>
            </div>
          </div>
        </section>

        <section className="proof-strip" aria-label="social proof">
          <p>For creators</p>
          <p>For marketers</p>
          <p>For research-heavy teams</p>
          <p>For anyone tired of screenshot chaos</p>
        </section>

        <section className="section-grid" id="features">
          <div className="section-heading">
            <p className="section-kicker">Why it sells</p>
            <h2>Every reel becomes a usable business asset.</h2>
          </div>

          <div className="card-grid">
            {proofCards.map((card) => (
              <article className="content-card" key={card.title}>
                <div className="card-index" />
                <h3>{card.title}</h3>
                <p>{card.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="split-section" id="workflow">
          <div className="workflow-panel">
            <p className="section-kicker">Simple workflow</p>
            <h2>Built for speed when inspiration hits.</h2>
            <div className="workflow-list">
              {workflow.map((step, index) => (
                <div className="workflow-item" key={step}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <p>{step}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="note-stack">
            {notes.map((note) => (
              <article className="note-card" key={note.title}>
                <p className="note-tag">{note.tag}</p>
                <h3>{note.title}</h3>
                <p>{note.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="pricing-section" id="pricing">
          <div className="pricing-copy">
            <p className="section-kicker">Ready to push harder</p>
            <h2>Sell the insight. Keep the system.</h2>
            <p>
              ReelNotes is for people who consume high-volume content but need high-quality output.
              If reels shape your strategy, this is the layer that turns passive watching into
              repeatable execution.
            </p>
          </div>

          <div className="pricing-card">
            <p className="pricing-tag">Launch Offer</p>
            <h3>$19<span>/month</span></h3>
            <ul>
              <li>Unlimited saved reel notes</li>
              <li>Searchable dashboard experience</li>
              <li>Local-first reliability</li>
              <li>AI-assisted note formatting</li>
            </ul>
            <a className="button button-primary button-block" href="mailto:sales@reelnotes.app">
              Claim Early Access
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
