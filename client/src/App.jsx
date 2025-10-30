import { useState } from "react";

export default function App() {
  const [age, setAge] = useState(49);
  const [fitz, setFitz] = useState(4);
  const [site, setSite] = useState("face");
  const [peptides, setPeptides] = useState(
    "palmitoyl-pentapeptide-4, ghk-cu, acetyl-hexapeptide-8"
  );
  const [imageFile, setImageFile] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const API_BASE = "http://127.0.0.1:8000";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setReport(null);
    if (!imageFile) return setErrorMsg("Please choose an image first.");

    const fd = new FormData();
    fd.append("image", imageFile);
    fd.append("age", String(age));
    fd.append("fitzpatrick", String(fitz));
    fd.append("site", site);
    fd.append("peptide_list", peptides);

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/analyze`, { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setReport(data);
    } catch (err) {
      setErrorMsg(String(err.message || err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <header className="hero">
        <div className="brand">🌸 Derm Peptide Analyzer</div>
        <div className="subtitle">
          Friendly, visual insights for aging skin—grounded in science.
        </div>
      </header>

      <main className="container">
        <section className="panel">
          <h2 className="panel-title">Upload & Analyze</h2>
          <form onSubmit={handleSubmit} className="grid">
            <div className="field">
              <label>Image</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                required
              />
            </div>

            <div className="field3">
              <div className="field">
                <label>Age</label>
                <input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(parseInt(e.target.value || "0", 10))}
                />
              </div>
<div className="field">
  <label>Fitzpatrick (1–6)</label>
  <FitzSelector value={fitz} onChange={setFitz} />
</div>

              <div className="field">
                <label>Site</label>
                <select value={site} onChange={(e) => setSite(e.target.value)}>
                  <option value="face">Face</option>
                  <option value="forearm">Forearm</option>
                  <option value="periorbital">Periorbital</option>
                </select>
              </div>
            </div>

            <div className="field">
              <label>Peptides (comma-separated)</label>
              <input
                value={peptides}
                onChange={(e) => setPeptides(e.target.value)}
              />
            </div>

            <button className="cta" disabled={loading}>
              {loading ? "Analyzing…" : "✨ Analyze Image"}
            </button>
          </form>

          {errorMsg && <div className="error">⚠️ {errorMsg}</div>}
        </section>

        {report && (
          <section className="report">
            <div className="summary">
              <div className="summary-left">
                <div className="chip">Age {report.user_profile?.age}</div>
                <div className="chip">
                  Fitz {report.user_profile?.fitzpatrick}
                </div>
                <div className="chip">
                  {(report.user_profile?.site || "").toUpperCase()}
                </div>
              </div>
              <div className="summary-right">
                <div className="mini">
                  Image • {report.image_info?.width} ×{" "}
                  {report.image_info?.height}px
                </div>
              </div>
            </div>

            <h3 className="section-title">Skin Metrics</h3>
            <div className="cards">
              <MetricCard name="Melanin Index" val={report.metrics?.melanin_index} max={100} help="Higher = more pigment; guides safer parameters." hue="280" />
              <MetricCard name="Erythema Index" val={report.metrics?.erythema_index} max={100} help="Redness proxy." hue="340" />
              <MetricCard name="Texture Roughness" val={report.metrics?.texture_roughness} max={100} help="Higher = more micro-relief." hue="210" />
              <MetricCard name="Brightness" val={report.metrics?.brightness_mean_0_255} max={255} help="Lighting / exposure proxy." hue="45" />
              <MetricCard name="PIH Risk" val={report.metrics?.pih_risk_proxy_0_100} max={100} help="Higher risk → gentler parameters + SPF." hue="5" />
            </div>

            <h3 className="section-title">Peptide Profile</h3>
            <div className="flag-grid">
              {Object.entries(report.peptide_feature_flags || {}).map(
                ([name, flags]) => (
                  <div key={name} className="flag-card">
                    <div className="flag-title">{name}</div>
                    <div className="pills">
                      <Pill ok={!!flags.lipidated} label="Lipidated" />
                      <Pill ok={flags.charged === true} label="Charged" />
                      <Pill ok={!!flags.over_500_Da} label=">500 Da" />
                      <Pill ok={!!flags.is_skp} label="SKP" />
                    </div>
                    <div className="note">
                      MW ~ {flags.approx_mw} Da • Charge:{" "}
                      {String(flags.net_charge)}
                    </div>
                  </div>
                )
              )}
            </div>

            {Array.isArray(report.safety) && report.safety.length > 0 && (
              <>
                <h3 className="section-title">Safety Notes</h3>
                <div className="safety-list">
                  {report.safety.map((s, i) => (
                    <div key={i} className={`safety ${s.severity}`}>
                      <span className="badge">{s.severity}</span>
                      <span>{s.message}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <h3 className="section-title">Personalized Plan</h3>
            <div className="recs">
              {report.ranked_recommendations?.map((r, i) => (
                <div key={i} className="rec-card">
                  <div className="rec-header">
                    <span className="rec-title">{r.category}</span>
                    <span className="rec-priority">Priority {r.priority}</span>
                  </div>
                  <div className="rec-body">
                    <div className="rec-rationale">{r.rationale}</div>
                    {Object.keys(r.parameters || {}).length > 0 && (
                      <div className="rec-params">
                        {Object.entries(r.parameters).map(([k, v]) => (
                          <div key={k} className="kv">
                            <span className="k">{prettyKey(k)}</span>
                            <span className="v">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function MetricCard({ name, val = 0, max = 100, help = "", hue = "260" }) {
  const pct = Math.max(0, Math.min(100, (Number(val) / max) * 100));
  return (
    <div className="metric-card">
      <div className="metric-top">
        <div className="metric-name">{name}</div>
        <div className="metric-val">{Number(val).toFixed(2)}</div>
      </div>
      <div className="bar">
        <div
          className="bar-fill"
          style={{ width: `${pct}%`, background: `hsl(${hue} 80% 55%)` }}
        />
      </div>
      <div className="metric-help">{help}</div>
    </div>
  );
}

function Pill({ ok, label }) {
  return <span className={`pill ${ok ? "ok" : "dim"}`}>{label}</span>;
}
function FitzSelector({ value, onChange }) {
  const options = [
    { id: 1, name: "Type I", desc: "Very fair, always burns", swatch: "#FBE9E0" },
    { id: 2, name: "Type II", desc: "Fair, burns easily",     swatch: "#F2D3C2" },
    { id: 3, name: "Type III", desc: "Medium, sometimes burns", swatch: "#E3B899" },
    { id: 4, name: "Type IV", desc: "Olive, rarely burns",    swatch: "#C3906E" },
    { id: 5, name: "Type V",  desc: "Brown, very rarely burns", swatch: "#8F5F3C" },
    { id: 6, name: "Type VI", desc: "Deep, never burns",      swatch: "#5A3A24" },
  ];

  return (
    <div className="fitz-grid" role="radiogroup" aria-label="Fitzpatrick skin type">
      {options.map((opt) => {
        const selected = opt.id === Number(value);
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`fitz-tile ${selected ? "selected" : ""}`}
            onClick={() => onChange(opt.id)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") onChange(Math.min(6, Number(value) + 1));
              if (e.key === "ArrowLeft"  || e.key === "ArrowUp")   onChange(Math.max(1, Number(value) - 1));
            }}
            title={`${opt.name} — ${opt.desc}`}
          >
            <span className="fitz-swatch" style={{ background: opt.swatch }} />
            <span className="fitz-label">
              <strong>{opt.id}</strong>
              <span className="fitz-name">{opt.name}</span>
              <span className="fitz-desc">{opt.desc}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function prettyKey(k) {
  return k.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
