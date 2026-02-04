import React, {useEffect, useMemo, useState} from "react";
import Layout from "@theme/Layout";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import useBaseUrl from "@docusaurus/useBaseUrl";
import Link from "@docusaurus/Link";

type ApiStatus = "checking" | "online" | "offline";

function HealthBadge() {
  const {siteConfig} = useDocusaurusContext();
  const apiUrl = (siteConfig.customFields?.apiHealthUrl as string) || "https://bags-shield-api.vercel.app/api/health";
  const [status, setStatus] = useState<ApiStatus>("checking");

  useEffect(() => {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 2000);

    // Cache buster para garantir status real
    const targetUrl = apiUrl.includes('?') ? `${apiUrl}&t=${Date.now()}` : `${apiUrl}?t=${Date.now()}`;

    fetch(targetUrl, {signal: c.signal, cache: "no-store"})
      .then((r) => setStatus(r.ok ? "online" : "offline"))
      .catch(() => setStatus("offline"))
      .finally(() => clearTimeout(t));

    return () => { clearTimeout(t); c.abort(); };
  }, [apiUrl]);

  const label = status === "checking" ? "SYSTEMS CHECKING" : status === "online" ? "SYSTEMS ONLINE" : "API UNREACHABLE";
  return <span className={"status-badge status-" + status}>{label}</span>;
}

export default function Home(): JSX.Element {
  const {siteConfig} = useDocusaurusContext();

  const phoneImg = useBaseUrl("/img/phone-mock.png");
  // Opcional: Se tiver video, ele toca. Se nao, mostra imagem.
  const demoMp4 = useBaseUrl("/video/app-demo.mp4"); 
  const demoWebm = useBaseUrl("/video/app-demo.webm"); 

  const [videoOk, setVideoOk] = useState(true);

  const appUrl = useMemo(
    () => (siteConfig.customFields?.appUrl as string) || "https://app.bagsshield.org",
    [siteConfig.customFields]
  );

  return (
    <Layout
      title="Bags Shield"
      description="Security-first intelligence layer for Solana. Real-time risk analysis, secure swaps and advanced analytics."
    >
      <main className="bs-main">
        <section className="bs-hero">
          
          {/* LADO ESQUERDO: TEXTO */}
          <div className="bs-left">
            <div className="bs-topline">
              <HealthBadge />
            </div>

            <h1 className="hero-title">
              Bags Shield: The <span className="text-gradient">Ultimate Solana</span> Intelligence Layer.
            </h1>

            <p className="hero-description">
              Real-time risk analysis, secure swaps, and advanced analytics for the Solana ecosystem.
              Protect your assets with institutional-grade security.
            </p>

            <div className="hero-actions">
              <Link className="bs-btn bs-btn-primary" to={appUrl}>
                Launch Web App
              </Link>
              <Link className="bs-btn bs-btn-secondary" to="/docs/intro">
                Documentation
              </Link>
            </div>

            <div className="hero-footnote">
              <span className="dot" /> Wallet-safe UX • No secrets • No-store • RequestId everywhere
            </div>
          </div>

          {/* LADO DIREITO: MOCKUP 3D */}
          <div className="bs-right">
            <div className="phone-wrapper">
              <div className="phone-glow phone-glow-top" />
              <div className="phone-glow phone-glow-bottom" />

              <div className="phone-device">
                <div className="phone-screen">
                  {videoOk ? (
                    <video
                      className="phone-media"
                      autoPlay loop muted playsInline
                      preload="metadata"
                      poster={phoneImg}
                      onError={() => setVideoOk(false)}
                    >
                      <source src={demoWebm} type="video/webm" />
                      <source src={demoMp4} type="video/mp4" />
                    </video>
                  ) : (
                    <img className="phone-media" src={phoneImg} alt="App preview" />
                  )}
                </div>
              </div>

              {/* Cards Flutuantes Animados */}
              <div className="float-card float-card-top">
                <div className="fc-pill pill-green">RISK LEVEL</div>
                <div className="fc-title">Safe (98%)</div>
              </div>

              <div className="float-card float-card-bottom">
                <div className="fc-pill pill-cyan">SWAP ROUTE</div>
                <div className="fc-title">Jupiter Aggregator</div>
              </div>
            </div>
          </div>

        </section>
      </main>
    </Layout>
  );
}
