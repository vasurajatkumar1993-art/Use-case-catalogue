"use client";

import React, { useState, useMemo } from "react";
import { Plus, Search, Sparkles, BookMarked, Layers, Trash2, X, Check, Loader2, ArrowRight, Quote } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { COMPETENCIES, DOMAINS, SITUATIONS, type UseCase, type Draft } from "@/lib/types";

const EMPTY_DRAFT: Draft = {
  title: "", situation: "", task: "", action: "", result: "",
  metric: "", lesson: "", interview_angle: "",
  competencies: [], domains: [], situation_type: "",
};

export default function CatalogApp({
  initialEntries,
  email,
}: {
  initialEntries: UseCase[];
  email: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [entries, setEntries] = useState<UseCase[]>(initialEntries);
  const [view, setView] = useState<"capture" | "library" | "story">("capture");

  const [raw, setRaw] = useState("");
  const [structuring, setStructuring] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [fComp, setFComp] = useState<string[]>([]);
  const [fDom, setFDom] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [pickedComp, setPickedComp] = useState<string>(COMPETENCIES[0]);

  const toggle = (arr: string[], v: string, set: (x: string[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  // ---- AI structuring (server route) ----
  const structure = async () => {
    if (!raw.trim()) return;
    setStructuring(true); setError(""); setDraft(null);
    try {
      const r = await fetch("/api/structure", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ raw: raw.trim() }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed");
      setDraft({ ...EMPTY_DRAFT, ...data });
    } catch (e: any) {
      setError(e.message || "Couldn't structure that one — try again or add a bit more detail.");
    } finally {
      setStructuring(false);
    }
  };

  const saveDraft = async () => {
    if (!draft) return;
    setSaving(true); setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Session expired — sign in again."); setSaving(false); return; }

    const payload = {
      user_id: user.id,
      occurred_on: new Date().toISOString().slice(0, 10),
      title: draft.title,
      raw: raw.trim(),
      situation: draft.situation,
      task: draft.task,
      action: draft.action,
      result: draft.result,
      metric: draft.metric,
      lesson: draft.lesson,
      interview_angle: draft.interview_angle,
      competencies: draft.competencies,
      domains: draft.domains,
      situation_type: draft.situation_type,
    };

    const { data, error: dbErr } = await supabase
      .from("use_cases")
      .insert(payload)
      .select()
      .single();

    setSaving(false);
    if (dbErr) { setError(dbErr.message); return; }

    setEntries([data as UseCase, ...entries]);
    setDraft(null); setRaw(""); setView("library");
  };

  const remove = async (id: string) => {
    const prev = entries;
    setEntries(entries.filter((e) => e.id !== id));
    const { error: dbErr } = await supabase.from("use_cases").delete().eq("id", id);
    if (dbErr) setEntries(prev); // rollback on failure
  };

  // ---- derived ----
  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (fComp.length && !fComp.some((c) => e.competencies.includes(c))) return false;
      if (fDom.length && !fDom.some((d) => e.domains.includes(d))) return false;
      if (search.trim()) {
        const hay = `${e.title} ${e.situation ?? ""} ${e.task ?? ""} ${e.action ?? ""} ${e.result ?? ""} ${e.lesson ?? ""} ${e.metric ?? ""}`.toLowerCase();
        if (!hay.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [entries, fComp, fDom, search]);

  const storyMatches = useMemo(
    () => entries.filter((e) => e.competencies.includes(pickedComp)),
    [entries, pickedComp]
  );

  const usedComps = useMemo(() => {
    const s = new Set<string>();
    entries.forEach((e) => e.competencies.forEach((c) => s.add(c)));
    return s;
  }, [entries]);

  return (
    <div className="ucj">
      <div className="ucj-wrap">
        <header className="ucj-mast">
          <div>
            <div className="ucj-mark grotesk">Use Case Catalog<span className="dot">.</span></div>
            <div className="ucj-sub">your product work, indexed for recall</div>
          </div>
          <div className="ucj-count">
            <span>{entries.length} {entries.length === 1 ? "card" : "cards"} on file</span>
            <button className="ucj-signout" onClick={signOut}>Sign out</button>
          </div>
        </header>

        <nav className="ucj-tabs">
          <button className={`ucj-tab ${view === "capture" ? "on" : ""}`} onClick={() => setView("capture")}><Plus size={15} /> Capture</button>
          <button className={`ucj-tab ${view === "library" ? "on" : ""}`} onClick={() => setView("library")}><Layers size={15} /> Catalog</button>
          <button className={`ucj-tab ${view === "story" ? "on" : ""}`} onClick={() => setView("story")}><BookMarked size={15} /> Story Bank</button>
        </nav>

        {/* CAPTURE */}
        {view === "capture" && (
          <div>
            <div className="ucj-capture">
              <label className="ucj-label">Brain-dump today&apos;s work</label>
              <textarea
                className="ucj-ta" rows={5} value={raw}
                onChange={(e) => setRaw(e.target.value)}
                placeholder="What did you wrestle with today? Don't structure it — just talk. 'Spent the morning unblocking the OM migration, eng wanted X but risk wanted Y, ended up proposing a phased cutover and got both to sign off…'"
              />
              <div className="ucj-row" style={{ marginTop: 12 }}>
                <span style={{ fontSize: 12.5, color: "var(--muted)" }}>The catalog structures it into a STAR card and tags it for you.</span>
                <div className="ucj-spacer" />
                <button className="ucj-btn ucj-btn-primary" onClick={structure} disabled={structuring || !raw.trim()}>
                  {structuring ? <><Loader2 size={15} className="ucj-spin" /> Structuring…</> : <><Sparkles size={15} /> Structure it</>}
                </button>
              </div>
              {error && <div className="ucj-err">{error}</div>}
            </div>

            {draft && (
              <div className="ucj-draft">
                <div className="ucj-draft-h"><Sparkles size={14} /> Review &amp; save</div>

                <div className="ucj-field">
                  <label className="ucj-label">Title</label>
                  <input className="ucj-input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                </div>

                {(["situation", "task", "action", "result"] as const).map((k) => (
                  <div className="ucj-field" key={k}>
                    <label className="ucj-label">{k}</label>
                    <textarea className="ucj-mini-ta" rows={2} value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} />
                  </div>
                ))}

                <div className="ucj-field">
                  <label className="ucj-label">Quotable metric</label>
                  <input className="ucj-input" value={draft.metric} placeholder="e.g. +2.5% auth rate" onChange={(e) => setDraft({ ...draft, metric: e.target.value })} />
                </div>

                <div className="ucj-field">
                  <label className="ucj-label">Lesson</label>
                  <textarea className="ucj-mini-ta" rows={2} value={draft.lesson} onChange={(e) => setDraft({ ...draft, lesson: e.target.value })} />
                </div>

                <div className="ucj-field">
                  <label className="ucj-section-lbl">Competencies</label>
                  <div className="ucj-row">
                    {COMPETENCIES.map((c) => (
                      <button key={c} className={`ucj-chip coral ${draft.competencies.includes(c) ? "on" : ""}`}
                        onClick={() => setDraft({ ...draft, competencies: draft.competencies.includes(c) ? draft.competencies.filter((x) => x !== c) : [...draft.competencies, c] })}>{c}</button>
                    ))}
                  </div>
                </div>

                <div className="ucj-field">
                  <label className="ucj-section-lbl">Domains</label>
                  <div className="ucj-row">
                    {DOMAINS.map((d) => (
                      <button key={d} className={`ucj-chip ${draft.domains.includes(d) ? "on" : ""}`}
                        onClick={() => setDraft({ ...draft, domains: draft.domains.includes(d) ? draft.domains.filter((x) => x !== d) : [...draft.domains, d] })}>{d}</button>
                    ))}
                  </div>
                </div>

                <div className="ucj-field">
                  <label className="ucj-section-lbl">Situation type</label>
                  <div className="ucj-row">
                    {SITUATIONS.map((s) => (
                      <button key={s} className={`ucj-chip ${draft.situation_type === s ? "on" : ""}`}
                        onClick={() => setDraft({ ...draft, situation_type: s })}>{s}</button>
                    ))}
                  </div>
                </div>

                <div className="ucj-row" style={{ marginTop: 16 }}>
                  <button className="ucj-btn ucj-btn-ghost" onClick={() => setDraft(null)}><X size={15} /> Discard</button>
                  <div className="ucj-spacer" />
                  <button className="ucj-btn ucj-btn-primary" onClick={saveDraft} disabled={saving}>
                    {saving ? <><Loader2 size={15} className="ucj-spin" /> Saving…</> : <><Check size={15} /> Save to catalog</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CATALOG */}
        {view === "library" && (
          <div>
            <div className="ucj-filterbar">
              <div className="ucj-searchwrap">
                <Search size={16} />
                <input className="ucj-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search across every card…" />
              </div>
              <div>
                <p className="ucj-section-lbl">Filter by competency</p>
                <div className="ucj-row">
                  {COMPETENCIES.map((c) => (
                    <button key={c} className={`ucj-chip coral ${fComp.includes(c) ? "on" : ""}`} onClick={() => toggle(fComp, c, setFComp)}>{c}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className="ucj-section-lbl">Filter by domain</p>
                <div className="ucj-row">
                  {DOMAINS.map((d) => (
                    <button key={d} className={`ucj-chip ${fDom.includes(d) ? "on" : ""}`} onClick={() => toggle(fDom, d, setFDom)}>{d}</button>
                  ))}
                </div>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="ucj-empty">
                <div className="grotesk">{entries.length === 0 ? "Your catalog is empty" : "Nothing matches yet"}</div>
                <div>{entries.length === 0 ? "Capture your first use case to start the catalog." : "Loosen a filter or clear the search."}</div>
              </div>
            ) : filtered.map((e) => (
              <article className="ucj-card" key={e.id}>
                <div className="ucj-card-top">
                  <h3 className="ucj-card-title grotesk">{e.title}</h3>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    <span className="ucj-card-date">{e.occurred_on}</span>
                    <button className="ucj-del" onClick={() => remove(e.id)} title="Remove card"><Trash2 size={15} /></button>
                  </div>
                </div>

                {e.metric && <div className="ucj-metric"><span className="num">{e.metric}</span></div>}

                <div className="ucj-tags">
                  {e.competencies.map((c) => <span key={c} className="ucj-chip-static ucj-chip-comp">{c}</span>)}
                  {e.domains.map((d) => <span key={d} className="ucj-chip-static ucj-chip-dom">{d}</span>)}
                  {e.situation_type && <span className="ucj-chip-static ucj-chip-sit">{e.situation_type}</span>}
                </div>

                {expanded[e.id] && (
                  <div className="ucj-star">
                    {([["Situation", e.situation], ["Task", e.task], ["Action", e.action], ["Result", e.result]] as const).map(([k, v]) => v && (
                      <div className="ucj-star-row" key={k}>
                        <div className="ucj-star-k">{k}</div>
                        <div className="ucj-star-v">{v}</div>
                      </div>
                    ))}
                    {e.lesson && <div className="ucj-lesson"><b>Lesson — </b>{e.lesson}</div>}
                  </div>
                )}

                <button className="ucj-expand" onClick={() => setExpanded({ ...expanded, [e.id]: !expanded[e.id] })}>
                  {expanded[e.id] ? "Hide the STAR" : "Open the full STAR"} <ArrowRight size={13} />
                </button>
              </article>
            ))}
          </div>
        )}

        {/* STORY BANK */}
        {view === "story" && (
          <div>
            <p className="ucj-section-lbl">Pick the competency you&apos;ll be asked about</p>
            <div className="ucj-row" style={{ marginBottom: 24 }}>
              {COMPETENCIES.map((c) => (
                <button key={c} className={`ucj-chip coral ${pickedComp === c ? "on" : ""}`} onClick={() => setPickedComp(c)}
                  style={{ opacity: usedComps.has(c) ? 1 : 0.45 }}>{c}</button>
              ))}
            </div>

            {storyMatches.length === 0 ? (
              <div className="ucj-empty">
                <div className="grotesk">No stories for &quot;{pickedComp}&quot; yet</div>
                <div>Capture a use case that shows this competency and it&apos;ll surface here, interview-ready.</div>
              </div>
            ) : storyMatches.map((e) => (
              <article className="ucj-card" key={e.id}>
                <h3 className="ucj-card-title grotesk" style={{ marginBottom: 4 }}>{e.title}</h3>
                {e.metric && <div className="ucj-metric"><span className="num">{e.metric}</span></div>}
                {e.interview_angle && (
                  <div className="ucj-lesson" style={{ marginTop: 12, display: "flex", gap: 8 }}>
                    <Quote size={15} style={{ flexShrink: 0, color: "var(--coral)", marginTop: 2 }} />
                    <span><b>When to use it — </b>{e.interview_angle}</span>
                  </div>
                )}
                <div className="ucj-star">
                  {([["Situation", e.situation], ["Task", e.task], ["Action", e.action], ["Result", e.result]] as const).map(([k, v]) => v && (
                    <div className="ucj-star-row" key={k}>
                      <div className="ucj-star-k">{k}</div>
                      <div className="ucj-star-v">{v}</div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
