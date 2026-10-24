import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApp, useToast } from '../lib/state.jsx';
import { inr, km, pct } from '../lib/format.js';
import { Header, Footer, SystemBanners } from '../components/Layout.jsx';
import { Icon, Kv, Sim, Banner, EmptyState, Skel, Field, Tier, ErrorBox } from '../components/ui.jsx';
import HexMap from '../components/HexMap.jsx';

export default function Cannibalisation() {
  const { cellId: param } = useParams();
  const { category, catInfo, picks } = useApp();
  const nav = useNavigate();
  const toast = useToast();
  const [saved, setSaved] = useState([]);
  const options = [...picks.filter((p) => !p.empty).map((p) => ({ cell: p.cell, name: `${p.label} · ${p.locality}` })), ...saved.filter((s) => s.category === category && !picks.some((p) => p.cell === s.cell)).map((s) => ({ cell: s.cell, name: `Saved · ${s.name}` }))];
  const cellId = param || options[0]?.cell;
  const [d, setD] = useState({ loading: true });
  const [threshold, setThreshold] = useState(5);
  useEffect(() => { api('/saved').then((r) => setSaved(r.saved)).catch(() => {}); }, []);
  const load = () => {
    if (!cellId) { setD({ loading: false, none: true }); return; }
    setD({ loading: true });
    api('/cannibalisation', { method: 'POST', body: { cellId, category, withPicks: true, pickCells: picks.filter((p) => !p.empty).map((p) => p.cell), pickLabels: picks.filter((p) => !p.empty).map((p) => p.label) }, timeout: 60000 }).then((r) => setD({ loading: false, data: r })).catch((e) => setD({ loading: false, error: e }));
  };
  useEffect(load, [cellId, category]); // eslint-disable-line react-hooks/exhaustive-deps

  const r = d.data;
  const res = r?.result;
  const site = r?.site;
  const over = res?.stores.filter((s) => s.lossPct * 100 > threshold) || [];
  return (
    <div className="page">
      <Header back />
      <SystemBanners />
      <div className="wrapx col g20" style={{ padding: '24px 28px' }}>
        <div className="row sb wrap g12"><div className="col g4"><h1 className="h2">Cannibalisation check</h1><span className="muted s14">How much a new site takes from your own stores, recomputed with the Huff model after adding it.</span></div>
          <div className="row g8"><span className="tag">{r ? `Own stores: ${r.ownStoresCategory} of this category` : 'Own stores: …'}</span><button className="btn out sm" onClick={() => nav('/profile#stores')}><Icon n="upload-cloud-2-line" s={14} />Update stores</button></div></div>
        <div className="card pad16 row g16 wrap ac">
          <div style={{ width: 300 }}><Field label="Candidate site" icon="map-pin-2-fill" value={cellId || ''} onChange={(v) => nav(`/cannibalisation/${v}`)} options={options.length ? options.map((o) => ({ value: o.cell, label: o.name })) : [{ value: '', label: 'No candidates yet' }]} /></div>
          <div style={{ width: 180 }}><Field label="Catchment" value={`${catInfo?.catchmentKm ?? '—'} km`} disabled /></div>
          <div style={{ width: 200 }}><Field label="Alert threshold" value={threshold} onChange={(v) => setThreshold(Math.max(0, Math.min(100, Number(v) || 0)))} suffix="% of revenue" type="number" /></div>
          <div className="col g4 f1"><span className="s12 b">Model</span><div className="row g8 s13" style={{ minHeight: 44 }}>Huff α {res?.model.alpha ?? '—'} · λ {res?.model.lambda ?? '—'} · {res?.model.source === 'placeholder' ? 'placeholder values' : 'fitted'} <Sim /></div></div>
        </div>

        {d.loading && <div className="row g20 stack-md"><Skel h={560} style={{ borderRadius: 18, flex: 1 }} /><div className="col g12" style={{ width: 560 }}><Skel h={200} /><Skel h={300} /></div></div>}
        {d.error && <div className="card"><ErrorBox error={d.error} onRetry={load} /></div>}
        {d.none && <div className="card"><EmptyState icon="map-pin-line" title="Pick a candidate site first" text="Run a search on the dashboard or save a location, then come back to see how it affects your network." action={<button className="btn ink sm" onClick={() => nav('/app')}>Go to dashboard</button>} /></div>}
        {r?.status === 'no_stores' && <StateCard tag="No own stores" tone="info" icon="store-3-line" title="This would be your first store" text="Nothing to cannibalise, so this check is skipped and recommendations use competitor pressure only. Add stores later to unlock network view and portfolio planning." actions={<><button className="btn ink sm" onClick={() => nav('/profile#stores')}><Icon n="add-line" />Add your stores</button><button className="btn out sm" onClick={() => nav(`/location/${cellId}`)}>Continue without</button></>} />}
        {r?.status === 'different_category' && <StateCard tag="Different category" tone="info" icon="shuffle-line" title={`Your stores are ${r.otherCategories.join(', ').toLowerCase()}`} text={`Your uploaded outlets are a different category from this search (${catInfo?.name.toLowerCase()}). They are not counted as cannibalisation.`} actions={<button className="btn out sm" onClick={() => nav('/profile#stores')}>Manage stores</button>} />}
        {r?.status === 'ineligible' && <StateCard tag="Ineligible site" tone="bad" icon="forbid-line" title={`Site fails a ${catInfo?.name.toLowerCase()} rule`} text={`${r.reasons.map((x) => x.message).join('. ')}. Cannibalisation is not computed for blocked sites.`} actions={<div className="col g6" style={{ width: '100%' }}>{r.alternatives.map((a) => <button key={a.cell} className="row g10 s13 panel pad12" onClick={() => nav(`/cannibalisation/${a.cell}`)}><Tier t={a.tier} /><span className="f1 b" style={{ textAlign: 'left' }}>{a.locality}</span><span className="muted">{km(a.distKm)}</span><Icon n="arrow-right-s-line" /></button>)}</div>} />}

        {res && <>
          {r.estimatedCount > 0 && <Banner tone="warn" icon="question-line">{r.estimatedCount} of your stores use estimated revenue, so their loss figures carry wider ranges.</Banner>}
          {r.status === 'no_overlap' && <Banner tone="ok" icon="checkbox-circle-line">No overlap with your network: 0 of your {r.ownStoresCategory} stores lose revenue. Nearest is {r.nearestStore?.name} at {km(r.nearestStore?.distKm)}. Net network profit equals site profit.</Banner>}
          {r.status === 'heavy' && <Banner tone="bad" icon="alert-line">Heavy overlap: {res.netNetworkProfit < 0 ? `you would lose more than you gain (net ${inr(res.netNetworkProfit)}).` : `one store loses ${pct(Math.max(...res.stores.map((s) => s.lossPct)))} of its revenue.`} Flagged on the pick and excluded from “Best overall”.</Banner>}
          <div className="row as g20 stack-md">
            <div style={{ flex: 1.35, height: 560, minWidth: 0, position: 'relative' }}>
              <HexMap features={null} picks={[{ lat: site.lat, lon: site.lon, n: '+', label: 'New site' }]} own={res.stores.map((s) => ({ lat: s.lat, lon: s.lon, label: s.name.split('·')[1]?.trim() || s.name }))}
                rings={[{ lat: site.lat, lon: site.lon, km: catInfo?.catchmentKm || 2 }, ...res.stores.filter((s) => s.lossPct > 0.001).map((s) => ({ lat: s.lat, lon: s.lon, km: catInfo?.catchmentKm || 2, kind: 'own' }))]} fit="markers" legend={false} />
              <div className="legend" style={{ left: 14, bottom: 28, width: 230 }}><div className="row g6"><span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--ink)' }} />Your store</div><div className="row g6" style={{ marginTop: 6 }}><span style={{ width: 14, borderTop: '2px dashed var(--accent)' }} />New site catchment</div><div className="row g6" style={{ marginTop: 6 }}><span style={{ width: 14, borderTop: '2px dashed var(--ink)' }} />Affected store catchment</div></div>
            </div>
            <div className="col g16 f1">
              <div className="grid2" style={{ gap: 12 }}>
                <div className="panel pad16"><Kv k="New site revenue" v={inr(site.revenue.p50, 2)} sub="P50 per year" /></div>
                <div className="panel pad16"><Kv k="Taken from own stores" v={`−${inr(res.takenRs)}`} sub={`${pct(res.ratio)} of new revenue · ${res.affected} stores`} /></div>
                <div className="panel pad16"><Kv k="Net network revenue" v={`+${inr(res.netNetworkRevenue, 2)}`} sub="after cannibalisation" /></div>
                <div className="panel pad16" style={{ background: res.netNetworkProfit >= 0 ? 'var(--okSoft)' : 'var(--badSoft)' }}><Kv k="Net network profit" v={`${res.netNetworkProfit >= 0 ? '+' : ''}${inr(res.netNetworkProfit)}`} sub={`${inr(site.profit.exp)} site − ${inr(res.lostMargin)} lost margin`} /></div>
              </div>
              {over.length > 0 && <Banner tone="warn" icon="error-warning-line"><b>{over[0].name}</b>&nbsp;loses {pct(over[0].lossPct)} of revenue, above your {threshold}% alert{over.length > 1 ? ` (and ${over.length - 1} more)` : ''}.</Banner>}
              <div className="card" style={{ overflowX: 'auto' }}><table className="t"><thead><tr><th>Your store</th><th>Distance</th><th>Revenue now</th><th>Loss</th><th style={{ width: 90 }} /></tr></thead><tbody>
                {res.stores.slice(0, 10).map((s) => { const hot = s.lossPct * 100 > threshold; return <tr key={s.id}><td className="b">{s.name}{s.estimated && <span className="tag warn" style={{ marginLeft: 6 }}>Estimated</span>}</td><td className="muted nowrap">{km(s.distKm)}</td><td className="num nowrap">{inr(s.revenue)}</td>
                  <td className={`b num nowrap ${hot ? 'warnc' : ''}`}>{s.lossPct > 0.001 ? `−${pct(s.lossPct)} · ${inr(s.lossRs)}` : 'No overlap'}</td><td><div className="bar"><b style={{ width: `${Math.min(100, s.lossPct * 500)}%`, background: hot ? 'var(--warn)' : 'var(--accent)' }} /></div></td></tr>; })}</tbody></table></div>
              <div className="row g8 wrap"><button className="btn ink" onClick={() => nav('/portfolio')}><Icon n="node-tree" s={16} />Plan network with this site</button><button className="btn out" onClick={() => nav(`/location/${cellId}`)}><Icon n="map-pin-line" s={16} />Open location</button></div>
            </div>
          </div>
          {r.picks?.length > 0 && <div className="card pad20 col g12"><div className="h4">How each pick affects your network</div>
            <div style={{ overflowX: 'auto' }}><table className="t"><thead><tr><th>Pick</th><th>Site profit</th><th>Taken from own</th><th>Lost margin</th><th>Net network profit</th><th>Verdict</th></tr></thead><tbody>
              {(() => { const best = Math.max(...r.picks.map((p) => p.netNetworkProfit)); return r.picks.map((p) => <tr key={p.cell} className="click" onClick={() => nav(`/cannibalisation/${p.cell}`)}><td className="b">{p.label} · {p.locality}</td><td className="num">{inr(p.profitExp)}</td><td className="num">{inr(p.takenRs)}</td><td className="num">{inr(p.lostMargin)}</td><td className={`b num ${p.netNetworkProfit >= 0 ? 'okc' : 'badc'}`}>{p.netNetworkProfit >= 0 ? '+' : ''}{inr(p.netNetworkProfit)}</td>
                <td>{p.netNetworkProfit < 0 ? <span className="tag bad">Destroys value</span> : p.netNetworkProfit === best ? <span className="tag ok">Best network gain</span> : p.takenRs < 1000 ? <span className="tag info">No own stores nearby</span> : p.lostMargin > p.profitExp * 0.3 ? <span className="tag warn">Heavy overlap</span> : <span className="tag ok">Adds value</span>}</td></tr>); })()}</tbody></table></div></div>}
        </>}
      </div>
      <Footer />
    </div>
  );
  function StateCard({ tag, tone, icon, title, text, actions }) {
    return <div className="card pad24 col g12" style={{ maxWidth: 640 }}><span className={`tag ${tone}`} style={{ alignSelf: 'flex-start' }}>{tag}</span><div className="iconbtn fill" style={{ width: 48, height: 48, fontSize: 22, color: 'var(--accent)' }}><Icon n={icon} /></div><div className="h4">{title}</div><p className="s13 muted" style={{ lineHeight: 1.55 }}>{text}</p><div className="row g8 wrap">{actions}</div></div>;
  }
}
