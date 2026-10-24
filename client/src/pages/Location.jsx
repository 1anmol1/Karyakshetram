import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, fieldErrors } from '../lib/api.js';
import { useApp, useAuth, useToast, useApi } from '../lib/state.jsx';
import { inr, pct, km, n, parseNum } from '../lib/format.js';
import { Header, Footer, SystemBanners } from '../components/Layout.jsx';
import { Icon, Tier, Conf, Sim, Kv, RangeBar, Tabs, Field, Modal, Skel, ErrorBox, Photo, Banner } from '../components/ui.jsx';
import { SimilarRow } from '../components/Cards.jsx';
import HexMap from '../components/HexMap.jsx';

const STRESS_ORDER = ['competitor500m', 'rentUp25', 'demandDown15', 'marginDown2'];
const LANDUSE = [['res', 'Residential'], ['com', 'Commercial'], ['ind', 'Industrial'], ['green', 'Green'], ['water', 'Water']];

export default function Location() {
  const { cellId } = useParams();
  const { category, catInfo, picks, compare, toggleCompare } = useApp();
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const d = useApi(`/cells/${cellId}?category=${category}`, [category]);
  const hex = useApi(`/cells?category=${category}`, [category]);
  const [ex, setEx] = useState(null);
  const [tab, setTab] = useState('Summary');
  const [ai, setAi] = useState(false);
  const [simFilter, setSimFilter] = useState('all');
  const sim = useApi(`/cells/${cellId}/similar?category=${category}&filter=${simFilter}`, [category, simFilter]);
  const [savedId, setSavedId] = useState(null);
  const [modal, setModal] = useState(null);
  const [rent, setRent] = useState(null);
  useEffect(() => { setEx(null); api('/explain', { method: 'POST', body: { cellId, category } }).then(setEx).catch((e) => setEx({ error: e })); }, [cellId, category]);
  useEffect(() => { api('/saved').then((r) => setSavedId(r.saved.find((x) => x.cell === cellId && x.category === category)?._id || null)).catch(() => {}); }, [cellId, category]);
  useEffect(() => { setRent(null); setTab('Summary'); }, [cellId]);

  const site = d.data?.site;
  const pick = picks.find((p) => p.cell === cellId);
  const shareUrl = window.location.href;
  const share = async () => {
    try { if (navigator.share) await navigator.share({ title: `Karyakshetram · ${site.locality}`, url: shareUrl }); else { await navigator.clipboard.writeText(shareUrl); toast('Link copied', { icon: 'link' }); } }
    catch { /* cancelled */ }
  };
  const toggleSave = async () => {
    try {
      if (savedId) { await api(`/saved/${savedId}`, { method: 'DELETE' }); setSavedId(null); toast('Removed from saved', { icon: 'bookmark-line', tone: 'info' }); }
      else { const r = await api('/saved', { method: 'POST', body: { cellId, category, name: site.locality } }); setSavedId(r.saved._id); toast('Saved to Shortlist', { icon: 'bookmark-fill', tone: 'acc' }); }
    } catch (e) { toast(e.message, { tone: 'bad', icon: 'error-warning-line' }); }
  };

  if (d.error) return <div className="page"><Header back /><div className="wrapx" style={{ padding: 40 }}><div className="card"><ErrorBox error={d.error} onRetry={d.refetch} /></div></div></div>;
  if (!site) return <div className="page"><Header back /><div className="wrapx col g16" style={{ padding: '20px 28px' }}><Skel h={400} style={{ borderRadius: 18 }} /><Skel h={34} w="50%" /><Skel h={140} style={{ borderRadius: 16 }} /></div></div>;

  const eligible = site.eligible.ok;
  const cn = site.cannibalisation;
  const comps = d.data.competitors || [];
  const whatIf = rent != null ? (() => { const r = Number(rent); const e = site.revenue.p50 * site.margin - r * site.area * 12 - site.opex; const p10 = site.revenue.p10 * site.margin - r * site.area * 12 - site.opex; return { e, p10, tier: p10 > 0 ? 'A' : e > 0 ? 'B' : 'C' }; })() : null;

  return (
    <div className="page">
      <Header back />
      <SystemBanners />
      <div className="row as wrapx stack-md" style={{ padding: '20px 28px 40px', gap: 24 }}>
        <div className="col g16 f1" style={{ minWidth: 0 }}>
          <div className="map-sticky" style={{ height: 380 }}>
            <HexMap features={hex.data?.features.filter((f) => { const [lo, la] = f.geometry.coordinates[0][0]; return Math.abs(la - site.lat) < 0.04 && Math.abs(lo - site.lon) < 0.045; })} selected={cellId} picks={[{ lat: site.lat, lon: site.lon, n: pick ? picks.indexOf(pick) + 1 : '' }]} rings={[{ lat: site.lat, lon: site.lon, km: site.catchment.km }]} comps={comps} center={[site.lat, site.lon]} zoom={14} legend={false} controls={true} />
            <span className="tag maptag" style={{ left: 14, top: 14, background: 'var(--bg)', height: 28 }}><Icon n="map-pin-2-line" s={14} />{site.catchment.km} km {catInfo?.name.toLowerCase() || ''} catchment · {comps.length} competitors</span>
          </div>
          <h1 className="h2">{site.locality} <span className="muted s16" style={{ fontWeight: 400 }}>· {pick?.label || 'Location'}</span></h1>
          <div className="row sb wrap g12">
            <div className="row g8 wrap">{eligible ? <Tier t={site.tier} /> : <span className="tag bad">Not suitable</span>}{pick && <span className="tag acc"><Icon n={pick.icon} s={12} />{pick.label}</span>}<Conf c={site.confidence} /><Sim /><span className="s12 muted">H3 {site.cell}</span></div>
            <div className="row g8 wrap">
              <button className="btn out" onClick={share}><Icon n="share-forward-line" s={16} />Share</button>
              <button className={`btn ${ai ? 'pri' : 'out'}`} onClick={() => setAi(!ai)} aria-pressed={ai}><Icon n="sparkling-2-line" s={16} c={ai ? '#fff' : 'var(--accent2)'} />AI summary</button>
              <button className="btn out" onClick={toggleSave}><Icon n={savedId ? 'bookmark-fill' : 'bookmark-line'} s={16} c={savedId ? 'var(--accent)' : undefined} />{savedId ? 'Saved' : 'Save'}</button>
              <button className={`btn ${compare.includes(cellId) ? 'soft' : 'out'}`} onClick={() => { const r = toggleCompare(cellId); if (r === 'full') toast('You can compare up to 3 sites. Remove one first.', { tone: 'warn', icon: 'error-warning-line' }); else if (r === 'added' && compare.length >= 1) toast('Added to compare', { action: { label: 'Open', onClick: () => nav('/compare') } }); }}><Icon n="scales-3-line" s={16} />{compare.includes(cellId) ? 'In compare' : 'Compare'}</button>
            </div>
          </div>
          {!eligible && <Banner tone="bad" icon="forbid-line" action={<button className="btn out sm" onClick={() => nav(`/check?lat=${site.lat}&lon=${site.lon}`)}>See alternatives</button>}>This cell fails a {catInfo?.name.toLowerCase()} rule: {site.eligible.reasons.join(', ')}.</Banner>}
          {d.data.visit?.quotedRent && <Banner tone="info" icon="map-pin-user-line">Using quoted rent ₹{d.data.visit.quotedRent} from the site visit by {d.data.visit.author} on {new Date(d.data.visit.createdAt).toLocaleDateString('en-IN')}.</Banner>}
          <div className="panel pad20 col g16">
            <div className="row g8 s13 wrap"><b>{catInfo?.name} · {n(site.area)} sq ft</b><span className="muted">· Scored {new Date(d.data.scoredAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · model {d.data.modelVersion}{d.data.source !== 'ml' ? ' (placeholder engine)' : ''}</span></div>
            <div className="grid5">
              <Kv k="Revenue P50" v={inr(site.revenue.p50)} sub={`P10 ${inr(site.revenue.p10)} · P90 ${inr(site.revenue.p90)}`} />
              <Kv k="Expected profit" v={inr(site.profit.exp)} sub="per year" />
              <Kv k="Downside (P10)" v={inr(site.profit.p10)} sub={site.profit.p10 > 0 ? 'still positive' : 'loss in a weak year'} />
              <Kv k="Break-even rent" v={`₹${Math.round(site.breakevenRent)}`} sub={`assumed ₹${site.rent} /sq ft/mo`} />
              <Kv k="Takes from own" v={cn ? inr(cn.takenRs) : '—'} sub={cn ? `${pct(cn.ratio)} of its revenue` : 'No own stores of this category'} />
            </div>
            {ex?.narrative ? <p className="s14" style={{ lineHeight: 1.6 }}>{ex.narrative}</p> : ex?.error ? <ErrorBox compact error={ex.error} /> : <div className="col g8"><Skel h={12} /><Skel h={12} w="80%" /></div>}
          </div>
          <Tabs items={['Summary', 'Why here', 'Risks', 'Neighbourhood', 'Money']} value={tab} onChange={setTab} />
          {tab === 'Summary' && <div className="row as g16 stack-md">
            <div className="card pad20 col g12 f1"><div className="h4">Revenue range (calibrated 80%)</div>
              <div className="col g6"><RangeBar {...site.revenue} /><div className="row sb s12 muted num"><span>P10 {inr(site.revenue.p10)}</span><span className="b" style={{ color: 'var(--text)' }}>P50 {inr(site.revenue.p50)}</span><span>P90 {inr(site.revenue.p90)}</span></div></div>
              <div className="divider" /><div className="h4">Why here · drivers</div><Drivers shap={site.shap} />
            </div>
            <Stress site={site} onCann={() => nav(`/cannibalisation/${cellId}`)} />
          </div>}
          {tab === 'Why here' && <div className="card pad20 col g16"><div className="h4">Contribution to expected profit (vs a typical site)</div><Drivers shap={site.shap} />
            <div className="divider" /><div className="h4">Evidence record</div>
            {ex?.evidence ? <table className="t"><tbody>{ex.evidence.items.map((i) => <tr key={i.id}><td className="muted" style={{ width: 70 }}>{i.id}</td><td>{i.label}</td><td className="b num">{i.text}</td></tr>)}</tbody></table> : <Skel h={120} />}
            <span className="s12 muted">Placeholder attribution until the ML service returns SHAP values (FR-09). Additivity: drivers sum to expected profit minus the typical-site baseline.</span></div>}
          {tab === 'Risks' && <div className="card pad20 col g12"><div className="h4">Risks and flags</div>
            {ex?.risks?.length ? ex.risks.map((r) => <div key={r.code} className="row g10 panel pad12 s13"><span className="tag warn">{r.code}</span><span>{r.text}</span></div>) : <div className="s13 muted">{ex ? 'No material risks flagged for this site.' : 'Loading…'}</div>}
            <div className="divider" /><Stress site={site} inline /></div>}
          {tab === 'Neighbourhood' && <div className="row as g16 stack-md">
            <div className="card pad20 col g12 f1"><div className="h4">Land use within the cell</div>
              {LANDUSE.map(([k, t]) => <div key={k} className="row g10 s13"><span style={{ width: 100 }}>{t}</span><div className="bar f1"><b style={{ width: `${(d.data.neighbourhood.landuse[k] || 0) * 100}%` }} /></div><span className="b num" style={{ width: 44, textAlign: 'right' }}>{Math.round((d.data.neighbourhood.landuse[k] || 0) * 100)}%</span></div>)}
              <div className="divider" /><div className="grid3">
                <Kv k="Population 2020" v={n(d.data.neighbourhood.features.pop2020)} sub={`${pct(site.popChange)} since 2015`} />
                <Kv k={`Households · ${site.catchment.km} km`} v={n(site.catchment.households)} />
                <Kv k="Nearest major road" v={`${d.data.neighbourhood.features.roadDistM} m`} />
                <Kv k="Schools / offices" v={`${d.data.neighbourhood.features.anchors.schools} / ${d.data.neighbourhood.features.anchors.offices}`} />
                <Kv k="Hospitals / transit" v={`${d.data.neighbourhood.features.anchors.hospitals} / ${d.data.neighbourhood.features.anchors.transit}`} />
                <Kv k="Data coverage" v={site.coverage.toFixed(2)} />
              </div></div>
            <div className="card pad20 col g8" style={{ width: 340 }}><div className="row sb"><div className="h4">Competitors in catchment</div><span className="tag">{site.catchment.competitors}</span></div>
              {comps.length ? comps.slice(0, 10).map((c) => <div key={c.id} className="row sb s13" style={{ padding: '6px 0', borderTop: '1px solid var(--line)' }}><span>{c.name}</span><span className="muted">{km(c.distKm)}</span></div>) : <span className="s13 muted">No competitors within the catchment. Check the empty-market flag before treating this as an opportunity.</span>}</div>
          </div>}
          {tab === 'Money' && <div className="row as g16 stack-md">
            <div className="card pad20 col g10 f1"><div className="h4">Yearly P&amp;L at P50</div>
              {[['Revenue', site.revenue.p50], [`Gross margin (${Math.round(site.margin * 100)}%)`, site.revenue.p50 * site.margin], [`Rent (₹${site.rent} × ${n(site.area)} sq ft × 12)`, -site.rent * site.area * 12], ['Operating cost', -site.opex], ['Expected profit', site.profit.exp]].map(([k, v], i) => <div key={k} className={`row sb s14 ${i === 4 ? 'b' : ''}`} style={{ padding: '8px 0', borderTop: i ? '1px solid var(--line)' : 'none' }}><span className={i === 0 ? 'muted' : ''}>{k}</span><span className="num">{inr(v)}</span></div>)}
              <div className="row sb s13 muted"><span>Capex (one-time)</span><span>{inr(site.capex)} · payback {site.profit.exp > 0 ? `${(site.capex / site.profit.exp).toFixed(1)} yrs` : 'n/a'}</span></div>
              {cn && <div className="row sb s13"><span className="muted">Lost margin at your stores</span><span className="num">−{inr(cn.lostMargin)} · net {inr(cn.netNetworkProfit)}</span></div>}
            </div>
            <div className="card pad20 col g12" style={{ width: 360 }}><div className="h4">What if the rent changes?</div>
              <div className="row sb s13"><span className="muted">Rent</span><b>₹{rent ?? site.rent} /sq ft/mo</b></div>
              <input type="range" className="rng" min="10" max={Math.max(400, Math.round(site.breakevenRent * 1.3))} value={rent ?? site.rent} style={{ '--p': `${((rent ?? site.rent) - 10) / (Math.max(400, Math.round(site.breakevenRent * 1.3)) - 10) * 100}%` }} onChange={(e) => setRent(e.target.value)} aria-label="Rent what-if" />
              {whatIf ? <div className="col g6 s13"><div className="row sb"><span className="muted">Expected profit</span><b>{inr(site.profit.exp)} → {inr(whatIf.e)}</b></div><div className="row sb"><span className="muted">Downside (P10)</span><b>{inr(site.profit.p10)} → {inr(whatIf.p10)}</b></div><div className="row sb"><span className="muted">Tier</span><span className="row g6"><Tier t={site.tier} />→<Tier t={whatIf.tier} /></span></div><button className="btn ghost sm" onClick={() => setRent(null)}>Reset</button></div>
                : <span className="s12 muted">Drag to recompute profit and tier instantly (FR-17). Break-even is ₹{Math.round(site.breakevenRent)}.</span>}
            </div>
          </div>}
          <div className="col g10"><div className="h4">Site photos</div><div className="row g10">{[1, 2, 3, 4].map((i) => <div key={i} className="photo f1" style={{ height: 130 }}><Photo seed={i + 10 + cellId.charCodeAt(9)} h={130} caption={i === 1 ? 'Illustration' : ''} /></div>)}</div>
            <span className="s11 muted">Illustrations until photos are added from a site visit.</span></div>
          <div className="card pad16 row sb wrap g12">
            <span className="row g10 s13"><b>Was this recommendation useful?</b>
              <button className="iconbtn" onClick={() => api('/feedback', { method: 'POST', body: { cellId, category, rating: 'up' } }).then(() => toast('Thanks for the feedback')).catch((e) => toast(e.message, { tone: 'bad' }))} aria-label="Thumbs up"><Icon n="thumb-up-line" s={16} /></button>
              <button className="iconbtn" onClick={() => setModal('down')} aria-label="Thumbs down"><Icon n="thumb-down-line" s={16} /></button></span>
            <span className="row g8"><button className="btn out sm" onClick={() => setModal('visit')}><Icon n="map-pin-user-line" s={14} />Add site-visit notes</button><button className="btn ink sm" onClick={() => setModal('opened')}><Icon n="store-2-line" s={14} />We opened here</button></span>
          </div>
        </div>

        <aside style={{ width: 440, maxWidth: '100%', position: 'relative' }} className="col g12">
          {ai ? <AiPanel cellId={cellId} category={category} ex={ex} onClose={() => setAi(false)} /> : <>
            <div className="row g8 wrap">{[['all', 'All'], ['tierA', 'Tier A'], ['nearby', 'Nearby'], ['lowerRent', 'Lower rent']].map(([k, t]) => <button key={k} className={`chip ${simFilter === k ? 'on' : ''}`} onClick={() => setSimFilter(k)}>{t}</button>)}</div>
            <div className="b s15">Similar locations</div>
            {sim.loading && [1, 2, 3, 4].map((i) => <div key={i} className="row g12"><Skel h={96} w={168} style={{ borderRadius: 12 }} /><div className="col g6 f1"><Skel h={14} /><Skel h={12} w="70%" /></div></div>)}
            {sim.error && <ErrorBox compact error={sim.error} onRetry={sim.refetch} />}
            {sim.data?.similar?.length === 0 && <div className="s13 muted">No similar suitable sites within 8 km for this filter.</div>}
            {sim.data?.similar?.map((s) => <SimilarRow key={s.cell} s={s} onOpen={() => nav(`/location/${s.cell}`)}><HexMap features={null} picks={[{ lat: s.lat, lon: s.lon }]} center={[s.lat, s.lon]} zoom={13} controls={false} legend={false} interactive={false} /></SimilarRow>)}
          </>}
        </aside>
      </div>
      <Footer />
      <FeedbackModal open={modal === 'down'} onClose={() => setModal(null)} cellId={cellId} category={category} />
      <VisitModal open={modal === 'visit'} onClose={() => setModal(null)} cellId={cellId} category={category} onSaved={() => { setModal(null); d.refetch(); }} />
      <OpenedModal open={modal === 'opened'} onClose={() => setModal(null)} cellId={cellId} category={category} site={site} user={user} />
    </div>
  );
}

export function Drivers({ shap }) {
  const rows = ['Demand', 'Access', 'Network', 'Competition', 'Cost'].map((k) => [k, shap?.[k] || 0]);
  const max = Math.max(1, ...rows.map(([, v]) => Math.abs(v)));
  return <div className="col g10">{rows.map(([k, v]) => (
    <div key={k} className="row g10 s13"><span style={{ width: 90 }}>{k}</span>
      <div className="f1 row" style={{ height: 10 }}><div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>{v < 0 && <span style={{ width: `${(-v / max) * 100}%`, height: 10, borderRadius: '4px 0 0 4px', background: 'var(--muted)' }} />}</div><span style={{ width: 1, height: 16, background: 'var(--line)' }} /><div style={{ flex: 1 }}>{v > 0 && <span style={{ display: 'block', width: `${(v / max) * 100}%`, height: 10, borderRadius: '0 4px 4px 0', background: 'var(--accent)' }} />}</div></div>
      <span className="b num" style={{ width: 70, textAlign: 'right' }}>{v >= 0 ? '+' : ''}{inr(v)}</span></div>))}</div>;
}

export function Stress({ site, onCann, inline }) {
  return (
    <div className={inline ? 'col g10' : 'card pad20 col g10'} style={inline ? undefined : { width: 340 }}>
      <div className="row sb"><div className="h4">Stress tests</div><span className={`tag ${site.stress.passes >= 3 ? 'ok' : site.stress.passes === 2 ? 'warn' : 'bad'}`}>{site.stress.passes} of 4 pass</span></div>
      {STRESS_ORDER.map((k) => { const s = site.stress[k]; return <div key={k} className="row g10 s13" style={{ padding: '8px 0', borderTop: '1px solid var(--line)' }}><Icon n={s.pass ? 'checkbox-circle-fill' : 'close-circle-fill'} s={18} c={s.pass ? 'var(--ok)' : 'var(--bad)'} /><span className="f1">{s.label}</span><span className="b nowrap">Tier {s.tier} · {inr(s.exp)}</span></div>; })}
      {onCann && <button className="btn soft sm" style={{ alignSelf: 'flex-start' }} onClick={onCann}><Icon n="git-merge-line" s={14} />Open cannibalisation</button>}
    </div>
  );
}

function AiPanel({ cellId, category, ex, onClose }) {
  const [msgs, setMsgs] = useState([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const ask = async (m) => {
    const t = (m ?? q).trim(); if (!t) return; setQ(''); setBusy(true); setMsgs((x) => [...x, { me: true, text: t }]);
    try { const r = await api('/chat', { method: 'POST', body: { message: t, category, cellId } }); setMsgs((x) => [...x, { text: r.answer, ev: r.evidence }]); }
    catch (e) { setMsgs((x) => [...x, { text: e.message, err: true }]); } finally { setBusy(false); }
  };
  return (
    <div className="card shadow col" style={{ borderRadius: 18 }}>
      <div className="row sb pad16"><span className="b s16">Ask about this location</span><button className="iconbtn" onClick={onClose} aria-label="Close AI summary"><Icon n="close-line" /></button></div>
      <div className="col g12" style={{ padding: '0 16px 16px' }}>
        <Icon n="sparkling-2-line" s={22} c="var(--accent2)" />
        <p className="s13">Curious about this site? Answers come only from its evidence record.</p>
        <div className="col g8" style={{ alignItems: 'flex-end' }}>{['Summarise this site', 'What breaks it in the stress tests?', 'At what rent does it stop making money?', 'How much does it take from my stores?'].map((s) => <button key={s} className="chip" onClick={() => ask(s)}>{s}</button>)}</div>
        <div className="divider" />
        <div className="col g10 s13" style={{ lineHeight: 1.6 }}><b className="s14">Summary</b>{ex?.narrative ? <span>{ex.narrative}</span> : <Skel h={60} />}</div>
        {ex?.claims && <div className="row g6 wrap">{ex.claims.flatMap((c) => c.evidence).slice(0, 8).map((e) => <span key={e} className="tag">{e}</span>)}</div>}
        {msgs.map((m, i) => m.me ? <div key={i} className="bubble-me">{m.text}</div> : <div key={i} className="bubble-ai" style={m.err ? { color: 'var(--bad)' } : undefined}>{m.text}{m.ev?.length > 0 && <div className="row g6 wrap" style={{ marginTop: 6 }}>{m.ev.map((e) => <span key={e} className="tag">{e}</span>)}</div>}</div>)}
        {busy && <div className="bubble-ai muted row g6"><Icon n="loader-4-line" className="spin" />Thinking…</div>}
        <div className="s11 muted row g4"><Icon n="shield-check-line" s={12} c="var(--ok)" />{ex?.narrative_source === 'llm' ? 'Validator passed · LLM, temperature 0' : 'Template narrative from evidence (no LLM configured)'}</div>
        <form className="row g8" onSubmit={(e) => { e.preventDefault(); ask(); }}><div className="input f1"><input placeholder="Ask a question…" value={q} onChange={(e) => setQ(e.target.value)} maxLength={500} aria-label="Ask about this location" /></div><button className="iconbtn" disabled={busy} aria-label="Send"><Icon n="send-plane-2-line" s={16} /></button></form>
        <div className="row jc"><span className="tag"><Icon n="sparkling-2-line" s={12} c="var(--accent2)" />Covers the similar-locations list until closed</span></div>
      </div>
    </div>
  );
}

function FeedbackModal({ open, onClose, cellId, category }) {
  const [reason, setReason] = useState('');
  const [comment, setComment] = useState('');
  const [err, setErr] = useState('');
  const toast = useToast();
  const send = async () => {
    if (!reason) { setErr('Pick what was wrong'); return; }
    try { await api('/feedback', { method: 'POST', body: { cellId, category, rating: 'down', reasonCode: reason, comment: comment || undefined } }); toast('Feedback sent. It audits rules and explanations; it does not change predictions.'); onClose(); setReason(''); setComment(''); setErr(''); }
    catch (e) { setErr(e.message); }
  };
  return <Modal open={open} onClose={onClose} title="What was wrong?">
    <div className="col g12"><div className="row g6 wrap">{[['wrong_land_use', 'Wrong land use'], ['rent_unrealistic', 'Rent unrealistic'], ['competitor_missing', 'Competitor missing'], ['other', 'Other']].map(([k, t]) => <button key={k} className={`chip ${reason === k ? 'on' : ''}`} onClick={() => { setReason(k); setErr(''); }}>{t}</button>)}</div>
      {err && <span className="help err"><Icon n="error-warning-line" s={14} />{err}</span>}
      <textarea className="ta" placeholder={reason === 'competitor_missing' ? 'Which competitor? (optional)' : 'Anything else? (optional)'} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} />
      <button className="btn ink" style={{ alignSelf: 'flex-start' }} onClick={send}>Send feedback</button></div>
  </Modal>;
}

function VisitModal({ open, onClose, cellId, category, onSaved }) {
  const [v, setV] = useState({ rent: '', footfall: '', notes: '' });
  const [errs, setErrs] = useState({});
  const toast = useToast();
  const send = async () => {
    const rent = parseNum(v.rent), ff = parseNum(v.footfall);
    const e = {}; if (rent != null && (Number.isNaN(rent) || rent < 10 || rent > 1000)) e.quotedRent = 'Rent must be between ₹10 and ₹1,000'; if (ff != null && (Number.isNaN(ff) || ff < 0)) e.footfall = 'Enter a count of 0 or more';
    if (rent == null && ff == null && !v.notes.trim()) e.notes = 'Add at least one observation';
    setErrs(e); if (Object.keys(e).length) return;
    try { await api('/visits', { method: 'POST', body: { cellId, category, quotedRent: rent ?? undefined, footfall: ff ?? undefined, notes: v.notes || undefined } }); toast('Observation saved. Quoted rent now replaces market benchmark rent.'); setV({ rent: '', footfall: '', notes: '' }); onSaved(); }
    catch (er) { setErrs(fieldErrors(er)); }
  };
  return <Modal open={open} onClose={onClose} title="Site-visit observations">
    <div className="col g12"><div className="grid2"><Field label="Quoted rent" value={v.rent} onChange={(x) => setV({ ...v, rent: x })} suffix="₹/sq ft/mo" error={errs.quotedRent} /><Field label="Footfall count" value={v.footfall} onChange={(x) => setV({ ...v, footfall: x })} suffix="per hour" error={errs.footfall} /></div>
      <div className="field"><label>Notes</label><textarea className="ta" value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} placeholder="Frontage, parking, visibility…" /></div>{errs.notes && <span className="help err">{errs.notes}</span>}
      <button className="btn ink" style={{ alignSelf: 'flex-start' }} onClick={send}>Save observation</button></div>
  </Modal>;
}

function OpenedModal({ open, onClose, cellId, category, site }) {
  const [v, setV] = useState({ date: '', rev: '' });
  const [errs, setErrs] = useState({});
  const [res, setRes] = useState(null);
  const send = async () => {
    const rev = parseNum(v.rev); const e = {};
    if (!v.date) e.openedOn = 'Enter the opening date'; else if (new Date(v.date) > new Date()) e.openedOn = 'Opening date cannot be in the future';
    if (rev == null || Number.isNaN(rev) || rev <= 0) e.actualMonthlyRevenue = 'Enter monthly revenue in ₹';
    setErrs(e); if (Object.keys(e).length) return;
    try { setRes(await api('/outcomes', { method: 'POST', body: { cellId, category, openedOn: v.date, actualMonthlyRevenue: rev } })); }
    catch (er) { setErrs(fieldErrors(er)); }
  };
  return <Modal open={open} onClose={() => { onClose(); setRes(null); }} title="We opened here">
    {res ? <div className="col g12"><Banner tone={res.insideInterval ? 'ok' : 'warn'} icon={res.insideInterval ? 'checkbox-circle-line' : 'error-warning-line'}>{res.insideInterval ? 'Inside the predicted P10–P90 range.' : 'Outside the predicted range.'} Intervals recalibrated in {res.recalibrationMs} ms.</Banner>
      <div className="grid2"><div className="panel pad16"><Kv k="Actual (annualised)" v={inr(res.actualAnnual)} /></div><div className="panel pad16"><Kv k="Predicted P50" v={inr(res.predicted.p50)} sub={`P10 ${inr(res.predicted.p10)} · P90 ${inr(res.predicted.p90)}`} /></div></div>
      <span className="s13 muted">New calibration scale: {res.new_calibration_scale.toFixed(2)}{res.coverage != null ? ` · coverage on recorded outcomes ${Math.round(res.coverage * 100)}%` : ''}</span><button className="btn ink" style={{ alignSelf: 'flex-start' }} onClick={() => { onClose(); setRes(null); }}>Done</button></div>
      : <div className="col g12"><Field label="Opened on" type="date" value={v.date} onChange={(x) => setV({ ...v, date: x })} error={errs.openedOn} inputProps={{ max: new Date().toISOString().slice(0, 10) }} />
        <Field label="Actual monthly revenue" value={v.rev} onChange={(x) => setV({ ...v, rev: x })} suffix="₹" error={errs.actualMonthlyRevenue} help={parseNum(v.rev) ? `${inr(parseNum(v.rev))} / month · predicted ${inr(site.revenue.p50 / 12)} / month` : `Predicted ${inr(site.revenue.p50 / 12)} / month`} />
        <button className="btn ink" style={{ alignSelf: 'flex-start' }} onClick={send}>Save outcome</button></div>}
  </Modal>;
}
