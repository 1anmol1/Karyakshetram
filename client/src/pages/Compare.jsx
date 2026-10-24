import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApp, useToast } from '../lib/state.jsx';
import { inr, downloadCsv } from '../lib/format.js';
import { Header, Footer, SystemBanners } from '../components/Layout.jsx';
import { Icon, Tier, Conf, Collapse, Photo, EmptyState, Skel, ErrorBox } from '../components/ui.jsx';
import { Drivers } from './Location.jsx';
import HexMap from '../components/HexMap.jsx';

const LAND = [['res', 'Residential'], ['com', 'Commercial'], ['ind', 'Industrial']];

export default function Compare() {
  const { compare, setCompare, picks, category } = useApp();
  const [saved, setSaved] = useState([]);
  const [d, setD] = useState({ loading: false });
  const [hl, setHl] = useState(true);
  const [picker, setPicker] = useState(null);
  const nav = useNavigate();
  const toast = useToast();
  useEffect(() => { api('/saved').then((r) => setSaved(r.saved.filter((s) => s.category === category))).catch(() => {}); }, [category]);
  useEffect(() => {
    if (compare.length < 2) { setD({ loading: false }); return; }
    setD({ loading: true });
    api('/compare', { method: 'POST', body: { cells: compare, category } }).then((r) => setD({ data: r })).catch((e) => setD({ error: e }));
  }, [compare.join(','), category]); // eslint-disable-line react-hooks/exhaustive-deps
  const options = [...picks.filter((p) => !p.empty).map((p) => ({ cell: p.cell, name: p.locality, sub: p.label })), ...saved.filter((s) => !picks.some((p) => p.cell === s.cell)).map((s) => ({ cell: s.cell, name: s.name, sub: 'Saved' }))];
  const sites = d.data?.sites || [];
  const replace = (i, cell) => { if (compare.includes(cell)) { toast('That site is already in the comparison', { tone: 'warn', icon: 'error-warning-line' }); return; } const next = [...compare]; next[i] = cell; setCompare(next.filter(Boolean)); setPicker(null); };
  const remove = (i) => setCompare(compare.filter((_, j) => j !== i));
  const best = (vals, dir = 1) => { if (!hl) return -1; const v = vals.map((x) => (typeof x === 'number' ? x : NaN)); const m = dir > 0 ? Math.max(...v.filter(Number.isFinite)) : Math.min(...v.filter(Number.isFinite)); return v.filter((x) => x === m).length === v.length ? -1 : v.indexOf(m); };
  const Row = ({ k, vals, raw, dir = 1 }) => { const b = best(raw || [], dir); return <div className="row" style={{ padding: '16px 0', borderTop: '1px solid var(--line)' }}><span className="s15" style={{ width: 260, flex: 'none' }}>{k}</span>{vals.map((v, i) => <span key={i} className={`s15 f1 ${i === b ? 'b' : ''}`} style={i === b ? { color: 'var(--accent)' } : undefined}>{v}</span>)}{vals.length < 3 && <span className="f1" />}</div>; };
  const exportCsv = () => downloadCsv('karyakshetram_compare.csv', sites.map((s) => ({ locality: s.locality, cell: s.cell, tier: s.tier, revenue_p50: Math.round(s.revenue.p50), expected_profit: Math.round(s.profit.exp), p10_profit: Math.round(s.profit.p10), rent: s.rent, breakeven_rent: Math.round(s.breakevenRent), stress_passes: s.stress.passes })));

  return (
    <div className="page">
      <Header back />
      <SystemBanners />
      <div className="wrapx col g16" style={{ padding: '24px 28px' }}>
        <div className="row sb wrap g8"><div className="col g4"><h1 className="h2">Compare sites</h1><span className="muted s14">Up to 3 sites side by side, using the same evidence as each location page.</span></div>
          <div className="row g8"><button className="btn out sm" disabled={!sites.length} onClick={exportCsv}><Icon n="download-2-line" s={14} />Export</button><button className="btn out sm" onClick={async () => { try { await navigator.clipboard.writeText(window.location.href); toast('Link copied'); } catch { toast('Copy failed', { tone: 'bad' }); } }}><Icon n="share-forward-line" s={14} />Share</button></div></div>

        {compare.length < 2 && <div className="card"><EmptyState icon="scales-3-line" title={compare.length ? 'Pick one more site to compare' : 'Pick 2 or 3 sites to compare'} text="Tick the box on any recommended pick, or press Compare on a location page." action={<div className="col g8 ac">{options.slice(0, 6).filter((o) => !compare.includes(o.cell)).map((o) => <button key={o.cell} className="chip" onClick={() => setCompare([...compare, o.cell])}><Icon n="add-line" s={14} />{o.name} · {o.sub}</button>)}{!options.length && <button className="btn ink sm" onClick={() => nav('/app')}>Find locations first</button>}</div>} /></div>}

        {compare.length >= 2 && <>
          <div className="row as stack-md" style={{ gap: 0 }}>
            <div style={{ width: 260, paddingTop: 140, flex: 'none' }} className="col g12 hide-md"><button className="panel pad16 row sb" style={{ width: 240 }} onClick={() => setHl(!hl)} aria-pressed={hl}><span className="s14">Highlight key differences</span><span className={`tgl ${hl ? 'on' : ''}`} /></button><span className="s12 muted" style={{ width: 230 }}>Best value in each row is highlighted when on.</span></div>
            {[0, 1, 2].map((i) => { const s = sites[i]; const cell = compare[i]; return (
              <div key={i} className="f1 col g12" style={{ paddingRight: 16, minWidth: 0 }}>
                <div className="card pad16 row sb shadow" style={{ position: 'relative' }}>
                  {cell ? <><div className="row g10" style={{ minWidth: 0 }}><div style={{ width: 44, height: 44, borderRadius: 10, overflow: 'hidden', flex: 'none' }}>{s ? <HexMap features={null} picks={[{ lat: s.lat, lon: s.lon }]} center={[s.lat, s.lon]} zoom={13} controls={false} legend={false} interactive={false} /> : <Skel h={44} />}</div>
                    <div className="col" style={{ minWidth: 0 }}><span className="b s15 ellipsis">{s?.locality || '…'}</span><span className="s12 muted">{picks.find((p) => p.cell === cell)?.label || 'Site'} · Tier {s?.tier || '…'}</span></div></div>
                    <span className="row g4"><button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => setPicker(picker === i ? null : i)} aria-label="Change site"><Icon n="arrow-down-s-line" s={18} /></button><button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => remove(i)} aria-label="Remove site"><Icon n="close-line" s={16} /></button></span></>
                    : <button className="row g8 b" style={{ width: '100%', height: 44 }} onClick={() => setPicker(picker === i ? null : i)}><Icon n="add-line" />Add a third site</button>}
                  {picker === i && <div className="popover" style={{ left: 0, right: 0, top: 70 }}>{options.length ? options.map((o) => <button key={o.cell} className={compare.includes(o.cell) ? 'on' : ''} onClick={() => replace(i, o.cell)}><Icon n="map-pin-line" s={16} c="var(--muted)" />{o.name}<span className="s11 muted" style={{ marginLeft: 'auto' }}>{o.sub}</span></button>) : <div className="s13 muted pad12">Save locations or run a search to add more options.</div>}</div>}
                </div>
                {cell && <><div className="photo" style={{ height: 150 }}><Photo seed={i + 20} h={150} /></div>
                  <div className="col ac g4"><span className="s12 muted">Expected profit / year</span>{s ? <><span className="h3 num">{inr(s.profit.exp)}</span><span className="row g6"><Tier t={s.tier} /><Conf c={s.confidence} /></span><button className="b s13 acc row g4" style={{ marginTop: 4 }} onClick={() => nav(`/location/${s.cell}`)}>View location <Icon n="arrow-right-line" s={14} /></button></> : <Skel h={60} w={160} />}</div></>}
              </div>); })}
          </div>
          {d.error && <ErrorBox compact error={d.error} />}
          {d.loading && <Skel h={200} style={{ borderRadius: 16 }} />}
          {d.data && <>
            <div className="card pad20 row g12 as" style={{ background: 'var(--surface)' }}><Icon n="sparkling-2-line" s={20} c="var(--accent2)" /><div className="col g6"><b>{d.data.title}</b><span className="s13" style={{ lineHeight: 1.6 }}>{d.data.narrative}</span><span className="row g6 wrap"><span className="s11 muted">{d.data.narrative_source === 'llm' ? 'LLM narrative · validated' : 'Template text (AI not configured)'} · every number from the evidence record</span></span></div></div>
            <Collapse open title="Key numbers">
              <Row k="Revenue P10 – P90" vals={sites.map((s) => `${inr(s.revenue.p10)} – ${inr(s.revenue.p90)}`)} raw={sites.map((s) => s.revenue.p50)} />
              <Row k="Expected profit" vals={sites.map((s) => inr(s.profit.exp))} raw={sites.map((s) => s.profit.exp)} />
              <Row k="Downside profit (P10)" vals={sites.map((s) => inr(s.profit.p10))} raw={sites.map((s) => s.profit.p10)} />
              <Row k="Assumed rent" vals={sites.map((s) => `₹${s.rent} /sq ft/mo`)} raw={sites.map((s) => s.rent)} dir={-1} />
              <Row k="Break-even rent" vals={sites.map((s) => `₹${Math.round(s.breakevenRent)}`)} raw={sites.map((s) => s.breakevenRent)} />
              <Row k="Rent-to-revenue" vals={sites.map((s) => `${((s.rent * s.area * 12) / s.revenue.p50 * 100).toFixed(1)}%`)} raw={sites.map((s) => (s.rent * s.area * 12) / s.revenue.p50)} dir={-1} />
            </Collapse>
            <Collapse open title="Stress tests">
              {['competitor500m', 'rentUp25', 'demandDown15', 'marginDown2'].map((k) => <Row key={k} k={sites[0].stress[k].label} vals={sites.map((s) => `${s.stress[k].pass ? 'Pass' : 'Fail'} · Tier ${s.stress[k].tier}`)} raw={sites.map((s) => s.stress[k].exp)} />)}
              <Row k="Passes" vals={sites.map((s) => `${s.stress.passes} of 4`)} raw={sites.map((s) => s.stress.passes)} />
            </Collapse>
            <Collapse open title="Cannibalisation">
              <Row k="Taken from own stores" vals={sites.map((s) => (s.cannibalisation ? inr(s.cannibalisation.takenRs) : 'No own stores'))} raw={sites.map((s) => s.cannibalisation?.takenRs ?? NaN)} dir={-1} />
              <Row k="Net network profit" vals={sites.map((s) => (s.cannibalisation ? inr(s.cannibalisation.netNetworkProfit) : inr(s.profit.exp)))} raw={sites.map((s) => s.cannibalisation?.netNetworkProfit ?? s.profit.exp)} />
            </Collapse>
            <Collapse title="Why here · drivers"><div className="row as g24 stack-md">{sites.map((s) => <div key={s.cell} className="f1 col g8"><b className="s13">{s.locality}</b><Drivers shap={s.shap} /></div>)}</div></Collapse>
            <Collapse title="Neighbourhood">
              <Row k={`Households in catchment`} vals={sites.map((s) => s.catchment.households.toLocaleString('en-IN'))} raw={sites.map((s) => s.catchment.households)} />
              <Row k="Competitors in catchment" vals={sites.map((s) => s.catchment.competitors)} raw={sites.map((s) => s.catchment.competitors)} dir={-1} />
              <Row k="Population change 2015–20" vals={sites.map((s) => `${(s.popChange * 100).toFixed(1)}%`)} raw={sites.map((s) => s.popChange)} />
              <Row k="Data coverage" vals={sites.map((s) => s.coverage.toFixed(2))} raw={sites.map((s) => s.coverage)} />
            </Collapse>
            <Collapse title="Risks and flags"><div className="row as g24 stack-md">{sites.map((s) => <div key={s.cell} className="f1 col g6"><b className="s13">{s.locality}</b>{s.flags.length ? s.flags.map((f) => <span key={f} className="tag warn" style={{ alignSelf: 'flex-start' }}>{f.replace(/_/g, ' ').toLowerCase()}</span>) : <span className="s13 muted">No flags</span>}</div>)}</div></Collapse>
          </>}
        </>}
      </div>
      <Footer />
    </div>
  );
}
