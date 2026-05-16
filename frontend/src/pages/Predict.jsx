import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AnimatedBackground from "@/components/AnimatedBackground";
import {
  FlaskConical, Send,
  MessageCircle, X, ChevronDown, Sparkles, ClipboardPaste,
} from "lucide-react";

const EXPRESS_BASE_URL = import.meta.env.VITE_EXPRESS_BASE_URL || "";
const TOKEN_KEY = "llmprop_token";

const DEMO_DESCRIPTIONS = {
  NaCl:
    "Sodium Chloride (NaCl) crystallizes in a rock salt structure (Fm-3m) with a face-centered cubic lattice. Lattice parameter a = 5.64 Å. Each Na⁺ is surrounded by 6 Cl⁻ ions in an octahedral coordination. It has a band gap of 8.5 eV and is an ionic insulator.",
  TiO2:
    "Titanium Dioxide (TiO2) crystallizes in the rutile structure (P42/mnm) with a tetragonal lattice. Lattice parameters a = 4.59 Å, c = 2.96 Å. Each Ti⁴⁺ is coordinated by 6 O²⁻ ions. It has a band gap of 3.0 eV and is widely used in photocatalysis.",
  Fe2O3:
    "Iron(III) Oxide (Fe2O3) crystallizes in the corundum structure (R-3c) with a hexagonal lattice. Lattice parameter a = 5.04 Å, c = 13.75 Å. Each Fe³⁺ is octahedrally coordinated by 6 O²⁻ ions. It has a band gap of 2.2 eV and is commonly known as hematite.",
};

export default function Predict() {
  const navigate = useNavigate();
  const [input,   setInput]   = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [clearingHistory, setClearingHistory] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const [chatOpen,  setChatOpen]  = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [descriptionResult, setDescriptionResult] = useState("");
  const [descriptionLoading, setDescriptionLoading] = useState(false);
  const [descriptionError, setDescriptionError] = useState("");
  useEffect(() => {
    // Keep the helper panel in view when new content appears.
  }, [descriptionResult, descriptionError, descriptionLoading, chatOpen]);

  // Scroll reveal for results
  useEffect(() => {
    if (results) setTimeout(() => setRevealed(true), 50);
    else setRevealed(false);
  }, [results]);

  const formatResults = (prediction) => ([
    { property: "is_gap_direct", value: prediction.is_gap_direct },
    { property: "energy_per_atom", value: Number(prediction.energy_per_atom).toFixed(6) },
    { property: "formation_energy_per_atom", value: Number(prediction.formation_energy_per_atom).toFixed(6) },
    { property: "band_gap", value: Number(prediction.band_gap).toFixed(6) },
    { property: "e_above_hull", value: Number(prediction.e_above_hull).toFixed(6) },
    { property: "volume", value: Number(prediction.volume).toFixed(6) },
  ]);

  const loadHistory = async () => {
    setHistoryLoading(true);
    setHistoryError("");

    try {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) {
        navigate("/login", { replace: true });
        return;
      }

      const response = await fetch(`${EXPRESS_BASE_URL}/api/predictions?limit=12`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        navigate("/login", { replace: true });
        return;
      }

      if (!response.ok) {
        throw new Error("Could not fetch prediction history");
      }

      const data = await response.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      setHistoryError(err.message || "Could not fetch prediction history");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handlePredict = async () => {
    if (!input.trim()) return;

    setLoading(true);
    setResults(null);
    setError("");
    setRevealed(false);

    try {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) {
        navigate("/login", { replace: true });
        return;
      }

      const response = await fetch(`${EXPRESS_BASE_URL}/api/predict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text: input.trim() }),
      });

      if (response.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        navigate("/login", { replace: true });
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Prediction failed");
      }

      const prediction = await response.json();
      setResults(formatResults(prediction));
      await loadHistory();
    } catch (err) {
      setError(err.message || "Could not connect to the API");
    } finally {
      setLoading(false);
    }
  };

  const clearAllHistory = async () => {
    const confirmed = window.confirm(
      "Clear all saved prediction history? This cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    setClearingHistory(true);

    try {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) {
        navigate("/login", { replace: true });
        return;
      }

      const response = await fetch(`${EXPRESS_BASE_URL}/api/predictions`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        navigate("/login", { replace: true });
        return;
      }

      if (!response.ok) {
        throw new Error("Could not clear prediction history");
      }

      setHistory([]);
      await loadHistory();
    } catch (err) {
      setHistoryError(err.message || "Could not clear prediction history");
    } finally {
      setClearingHistory(false);
    }
  };

  const extractItems = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.results)) return payload.results;
    return [];
  };

  const fetchMaterialDescription = async (formula) => {
      // Call backend proxy to avoid CORS and keep API key on server
      const base = EXPRESS_BASE_URL || "";
      const resp = await fetch(`${base}/api/mp/description`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formula }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Could not fetch description from server");
      }

      const payload = await resp.json();
      if (!payload?.description) throw new Error("No description returned");
      return payload.description;
  };

  const useDescription = () => {
    if (descriptionResult) {
      setInput(descriptionResult);
    }
    setChatOpen(false);
  };

  const applyDemoFormula = (formula) => {
    const description = DEMO_DESCRIPTIONS[formula];
    if (!description) return;

    setInput(description);
    setChatInput(formula);
    setDescriptionError("");
    setDescriptionLoading(false);
    setDescriptionResult(description);
    setChatOpen(true);
  };

  const handleDescriptionLookup = async () => {
    const raw = chatInput.trim();
    const formula = raw && raw.length ? normalizeFormula(raw) : "";
    if (!formula) return;

    setDescriptionLoading(true);
    setDescriptionError("");
    setDescriptionResult("");

    try {
      const paragraph = await fetchMaterialDescription(formula);
      setDescriptionResult(paragraph);
      setChatInput(formula);
    } catch (err) {
      setDescriptionError(err.message || "Could not fetch material data");
    } finally {
      setDescriptionLoading(false);
    }
  };

  // Normalize unicode subscripts/superscripts to ASCII digits
  const normalizeFormula = (s) => {
    if (!s) return s;
    const sub = {
      '\u2080': '0','\u2081': '1','\u2082': '2','\u2083': '3','\u2084': '4','\u2085': '5','\u2086': '6','\u2087': '7','\u2088': '8','\u2089': '9'
    };
    const sup = {
      '\u2070': '0','\u00B9': '1','\u00B2': '2','\u00B3': '3','\u2074': '4','\u2075': '5','\u2076': '6','\u2077': '7','\u2078': '8','\u2079': '9'
    };
    return Array.from(s).map(ch => sub[ch] ?? sup[ch] ?? ch).join('');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Shared dark 3D background */}
      <AnimatedBackground />
      <Navbar />

      <main className="flex-1 relative pt-24 pb-20 z-10">
        <div className="max-w-2xl mx-auto px-6">

          {/* Page header */}
          <div className="mb-10 animate-fade-in-up">
            <p className="text-primary text-xs font-semibold tracking-widest uppercase mb-2 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" /> AI Inference
            </p>
            <h1 className="text-4xl md:text-5xl font-extrabold gradient-text mb-2">
              Predict Properties
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Enter a crystal description to predict material properties.
            </p>
          </div>

          {/* Input card */}
          <div
            className="glass-card rounded-2xl p-6 mb-5 animate-fade-in-up"
            style={{ animationDelay: "180ms" }}
          >
            <div className="mb-3 flex flex-wrap gap-2">
              {Object.keys(DEMO_DESCRIPTIONS).map((formula) => (
                <button
                  key={formula}
                  type="button"
                  onClick={() => applyDemoFormula(formula)}
                  className="inline-flex items-center rounded-full border border-blue-400/20 bg-slate-950/70 px-3 py-1 text-[11px] font-semibold text-sky-200/90 shadow-[0_0_0_1px_rgba(59,130,246,0.08)] transition-all hover:border-blue-300/40 hover:bg-slate-900/90 hover:text-sky-100 active:scale-95"
                >
                  {formula}
                </button>
              ))}
            </div>

            <div className="relative">
              <textarea
                id="crystal-description"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Describe the crystalline material…  e.g. Sodium chloride (NaCl) in rock salt (Fm-3m), a = 5.64 Å"
                className="w-full h-44 bg-muted/60 border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary resize-none font-mono transition-all"
              />
              {input && (
                <button
                  onClick={() => setInput("")}
                  className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
                  title="Clear"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              {/* Quick helper if user doesn't know how to describe the material */}
              <div className="mt-2 flex justify-end">
                <button
                  onClick={() => setChatOpen(true)}
                  className="text-sm font-semibold text-primary hover:underline"
                  title="Need help describing the material"
                >
                  Don't know the description?
                </button>
              </div>
            </div>
          </div>

          {/* Predict button */}
          <button
            onClick={handlePredict}
            disabled={loading || !input.trim()}
            className="w-full py-3.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-accent-hover transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] animate-pulse-glow mb-10"
            style={{ animationDelay: "260ms" }}
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            ) : (
              <>
                <FlaskConical className="w-4 h-4" />
                Predict Properties
              </>
            )}
          </button>

          {error && (
            <p className="text-sm text-red-400 mb-6">{error}</p>
          )}

          {loading && (
            <div className="glass-card rounded-2xl p-6 mb-8 animate-fade-in-up" aria-live="polite" aria-busy="true">
              <h2 className="text-base font-semibold text-foreground mb-5 flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-primary" />
                Generating Prediction
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={`prediction-skeleton-${i}`}
                    className="rounded-xl p-4 bg-muted/60 border border-border"
                  >
                    <div className="skeleton-shimmer h-3 w-24 rounded mb-3" />
                    <div className="skeleton-shimmer h-6 w-20 rounded" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          {results && (
            <div
              className={`glass-card rounded-2xl p-6 transition-all duration-700 ${
                revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
            >
              <h2 className="text-base font-semibold text-foreground mb-5 flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-primary" />
                Predicted Properties
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {results.map((r, i) => (
                  <div
                    key={r.property}
                    className="rounded-xl p-4 bg-muted/60 border border-border hover:border-primary/40 transition-all"
                    style={{
                      animationDelay: `${i * 80}ms`,
                      animation: "fadeInUp 0.5s ease-out both",
                    }}
                  >
                    <p className="text-xs text-muted-foreground mb-1">
                      {r.property === "is_gap_direct" && "is_gap_direct"}
                      {r.property === "energy_per_atom" && "energy_per_atom (eV/atom)"}
                      {r.property === "formation_energy_per_atom" && "formation_energy_per_atom (eV/atom)"}
                      {r.property === "band_gap" && "band_gap (eV)"}
                      {r.property === "e_above_hull" && "e_above_hull (eV/atom)"}
                      {r.property === "volume" && "volume (ų)"}
                    </p>
                    <p className="text-lg font-bold text-primary font-mono">{r.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Prediction history */}
          <div className="glass-card rounded-2xl p-6 mt-8 animate-fade-in-up" style={{ animationDelay: "320ms" }}>
            <div className="flex items-center justify-between gap-3 mb-5">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Prediction History
              </h2>
              {!historyLoading && history.length > 0 && (
                <button
                  onClick={clearAllHistory}
                  disabled={clearingHistory}
                  className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {clearingHistory ? "Clearing..." : "Clear All"}
                </button>
              )}
            </div>

            {historyLoading && (
              <div className="space-y-3" aria-live="polite" aria-busy="true">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={`history-skeleton-${i}`} className="rounded-xl p-4 bg-muted/60 border border-border">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="skeleton-shimmer h-3 w-40 rounded" />
                      <div className="skeleton-shimmer h-3 w-24 rounded" />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {Array.from({ length: 6 }).map((__, j) => (
                        <div key={`history-prop-skeleton-${i}-${j}`} className="rounded-lg px-2 py-2 bg-background/50 border border-border">
                          <div className="skeleton-shimmer h-2.5 w-16 rounded mb-2" />
                          <div className="skeleton-shimmer h-3.5 w-12 rounded" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {historyError && (
              <p className="text-sm text-red-400">{historyError}</p>
            )}

            {!historyLoading && !historyError && history.length === 0 && (
              <p className="text-sm text-muted-foreground">No predictions saved yet.</p>
            )}

            {!historyLoading && !historyError && history.length > 0 && (
              <div className="space-y-3">
                {history.map((item) => (
                  <div
                    key={item._id}
                    className="rounded-xl p-4 bg-muted/60 border border-border hover:border-primary/40 transition-all"
                  >
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <p className="text-xs text-muted-foreground truncate">
                        {item.inputText}
                      </p>
                      <p className="text-[11px] text-muted-foreground whitespace-nowrap">
                        {new Date(item.createdAt).toLocaleString()}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      <div className="rounded-lg px-2 py-1.5 bg-background/50 border border-border">
                        <p className="text-[10px] text-muted-foreground">is_gap_direct</p>
                        <p className="text-xs font-semibold text-primary font-mono">{item.prediction.is_gap_direct}</p>
                      </div>
                      <div className="rounded-lg px-2 py-1.5 bg-background/50 border border-border">
                        <p className="text-[10px] text-muted-foreground">energy_per_atom</p>
                        <p className="text-xs font-semibold text-primary font-mono">{Number(item.prediction.energy_per_atom).toFixed(6)}</p>
                      </div>
                      <div className="rounded-lg px-2 py-1.5 bg-background/50 border border-border">
                        <p className="text-[10px] text-muted-foreground">formation_energy_per_atom</p>
                        <p className="text-xs font-semibold text-primary font-mono">{Number(item.prediction.formation_energy_per_atom).toFixed(6)}</p>
                      </div>
                      <div className="rounded-lg px-2 py-1.5 bg-background/50 border border-border">
                        <p className="text-[10px] text-muted-foreground">band_gap</p>
                        <p className="text-xs font-semibold text-primary font-mono">{Number(item.prediction.band_gap).toFixed(6)}</p>
                      </div>
                      <div className="rounded-lg px-2 py-1.5 bg-background/50 border border-border">
                        <p className="text-[10px] text-muted-foreground">e_above_hull</p>
                        <p className="text-xs font-semibold text-primary font-mono">{Number(item.prediction.e_above_hull).toFixed(6)}</p>
                      </div>
                      <div className="rounded-lg px-2 py-1.5 bg-background/50 border border-border">
                        <p className="text-[10px] text-muted-foreground">volume</p>
                        <p className="text-xs font-semibold text-primary font-mono">{Number(item.prediction.volume).toFixed(6)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── Floating mini chatbot ─────────────────────────────────── */}
      <div className="fixed top-20 right-4 z-50 flex flex-col items-end gap-2">
        {/* Expanded panel */}
        {chatOpen && (
          <div className="w-80 rounded-2xl overflow-hidden shadow-2xl border border-border animate-fade-in-up glass-card flex flex-col"
            style={{ height: 380 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-primary/20 flex items-center justify-center">
                  <MessageCircle className="w-3.5 h-3.5 text-primary" />
                </div>
                <span className="text-xs font-semibold text-foreground">Crystal Helper</span>
              </div>
              <button
                onClick={() => setChatOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            {/* Result area */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {!descriptionResult && !descriptionError && !descriptionLoading && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Enter a formula and click search to generate a description.
                </p>
              )}

              {descriptionLoading && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Fetching Materials Project data...
                </p>
              )}

              {descriptionError && (
                <p className="text-xs text-red-400 leading-relaxed">
                  {descriptionError}
                </p>
              )}

              {descriptionResult && !descriptionError && (
                <div className="rounded-xl border border-border bg-background/70 p-3 space-y-2">
                  <p className="text-xs text-foreground leading-relaxed">
                    {descriptionResult}
                  </p>
                  <button
                    onClick={useDescription}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 border border-primary/30 text-primary text-xs font-semibold hover:bg-primary/20 transition-all hover:scale-[1.02] active:scale-95"
                  >
                    <ClipboardPaste className="w-3.5 h-3.5" />
                    Use Description
                  </button>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-border space-y-3">
              <div className="flex gap-2">
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleDescriptionLookup()}
                  placeholder="Type formula (e.g. NaCl)"
                  className="flex-1 bg-muted border border-border rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                />
                <button
                  onClick={handleDescriptionLookup}
                  disabled={!chatInput.trim() || descriptionLoading}
                  className="p-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-40"
                >
                  {descriptionLoading ? (
                    <div className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

            </div>
          </div>
        )}

        {/* Floating chat toggle removed; inline helper button is used instead */}
      </div>

      <Footer />
    </div>
  );
}
