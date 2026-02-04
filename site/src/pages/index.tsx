import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import useBaseUrl from '@docusaurus/useBaseUrl';
import '../css/bs-landing.css';

// Ícones de Features (Inline SVG)
const FeatIcons = {
  Shield: () => <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  Chart: () => <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>,
  Zap: () => <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
};

export default function Home() {
  const { siteConfig } = useDocusaurusContext();
  
  // Assets
  const phoneMock = useBaseUrl('/img/phone-mock.png');
  const solanaIcon = useBaseUrl('/img/solana.svg');
  const jupiterIcon = useBaseUrl('/img/jupiter.svg');
  const heliusIcon = useBaseUrl('/img/helius.svg');

  return (
    <Layout title="Home" description="Solana Intelligence Layer">
      <div className="bs-landing">
        
        {/* HERO SECTION */}
        <div className="bs-hero">
          <div className="bs-container">
            <div className="bs-hero-grid">
              
              <div className="hero-left">
                <div className="status-pill">
                  <span className="status-dot"></span>
                  <span>All Systems Operational</span>
                </div>
                
                <h1 className="hero-title">
                  The Intelligence Layer <br/>
                  <span className="txt-gradient">for Solana DeFi.</span>
                </h1>
                
                <p className="hero-desc">
                  Real-time risk analysis, secure swaps, and deep analytics. 
                  Institutional-grade security infrastructure for every trader.
                </p>
                
                <div className="hero-cta-group">
                  <Link to="https://app.bagsshield.org" className="btn-primary">
                    Launch App
                  </Link>
                  <Link to="/docs/intro" className="btn-secondary">
                    Documentation
                  </Link>
                </div>

                <div className="partners-section">
                  <div className="partners-label">TRUSTED BY BUILDERS</div>
                  <div className="partners-grid">
                    <Link to="#"><img src={solanaIcon} alt="Solana" /></Link>
                    <Link to="#"><img src={jupiterIcon} alt="Jupiter" /></Link>
                    <Link to="#"><img src={heliusIcon} alt="Helius" /></Link>
                  </div>
                </div>
              </div>

              <div className="mock-col">
                <div className="phone-wrap">
                  <img className="phone-mock" src={phoneMock} alt="Bags Shield App Mock" loading="eager" />
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* FEATURES SECTION (3 Cards) */}
        <section className="bs-features">
          <div className="bs-container">
            <div className="feat-grid">
              
              <div className="feat-card">
                <div className="feat-icon"><FeatIcons.Shield /></div>
                <h3>Scan Risk</h3>
                <p>Instant contract analysis detecting rugpulls, honeypots, and mutable metadata.</p>
              </div>

              <div className="feat-card">
                <div className="feat-icon"><FeatIcons.Chart /></div>
                <h3>Secure Analytics</h3>
                <p>Deep dive into holder distribution and liquidity signals with clear risk explanations.</p>
              </div>

              <div className="feat-card">
                <div className="feat-icon"><FeatIcons.Zap /></div>
                <h3>Swift Swaps</h3>
                <p>Integrated routing (Jupiter) for the best prices with safety checks before execution.</p>
              </div>

            </div>
          </div>
        </section>

        {/* --- DEEP DIVE SECTION (INFRASTRUCTURE & PHILOSOPHY) --- */}
        <section className="bs-deep-dive">
          <div className="bs-container">
            
            <div className="section-head">
              <h2>Infrastructure & Philosophy</h2>
              <p>Why we are building the new standard for DeFi safety.</p>
            </div>

            <div className="deep-grid">
              
              {/* CARD 1: MODEL */}
              <div className="deep-card">
                <div className="deep-head">
                  <span className="deep-tag">MODEL</span>
                  <h3>Jupiter Executes. Bags Shield Protects.</h3>
                </div>
                <div className="deep-body">
                  <p>
                    While Jupiter acts as the powerhouse engine finding the best routes, 
                    Bags Shield operates as the <strong>Intelligence Layer</strong>. 
                    We run deep pre-swap scans, calculate real-time ShieldScores™, 
                    and apply strict guardrails to filter out traps.
                  </p>
                  <ul className="deep-list">
                    <li><strong>🛡️ Sustainable Fees:</strong> Small, transparent fees keeping infrastructure robust.</li>
                    <li><strong>💸 User Cashback:</strong> Users earn rebates just for using the secure route.</li>
                    <li><strong>🤝 Partner Rewards:</strong> Integrators earn revenue share for directing traffic.</li>
                  </ul>
                </div>
              </div>

              {/* CARD 2: TRUST */}
              <div className="deep-card">
                <div className="deep-head">
                  <span className="deep-tag">TRUST</span>
                  <h3>The Bags Shield Difference</h3>
                </div>
                <div className="deep-body">
                  <p>
                    Most scanners just dump data. We transform risk into binary decisions. 
                    <strong>Scan → Explain → Secure Action</strong>. No guessing games.
                  </p>
                  <ul className="deep-list">
                    <li><strong>Pre-Action Trust Layer:</strong> Risk analysis before you sign.</li>
                    <li><strong>ShieldScore™:</strong> Frozen A-F grading system for immediate clarity.</li>
                    <li><strong>True Explainability:</strong> We tell you <em>why</em> (Mint Auth, Mutability, Liquidity).</li>
                  </ul>
                </div>
              </div>

              {/* CARD 3: ENGINE */}
              <div className="deep-card">
                <div className="deep-head">
                  <span className="deep-tag">ENGINE</span>
                  <h3>Built for Scale & Speed</h3>
                </div>
                <div className="deep-body">
                  <p>
                    A technology stack designed for aggressive iteration, absolute type safety, and mobile-first security.
                  </p>
                  <ul className="deep-list">
                    <li><strong>Serverless Velocity:</strong> Vercel + TS for rapid, safe deployments.</li>
                    <li><strong>Strict Contracts:</strong> Zod/AJV schemas prevent runtime crashes.</li>
                    <li><strong>Institutional Observability:</strong> Traceable Request IDs for auditability.</li>
                    <li><strong>Solana Mobile Native:</strong> Ready for Seeker/Saga Seed Vault integration.</li>
                  </ul>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="bs-footer">
          <div className="bs-container">
            <p>© {new Date().getFullYear()} Bags Shield. Built for the Solana Ecosystem.</p>
          </div>
        </footer>

      </div>
    </Layout>
  );
}