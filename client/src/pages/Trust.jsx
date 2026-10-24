import { useState } from 'react';
import { useApi, useApp, useAuth } from '../lib/state.jsx';
import { inr } from '../lib/format.js';
import { Header, Footer } from '../components/Layout.jsx';
import { Icon, Collapse, Skel, ErrorBox, Banner, Tabs } from '../components/ui.jsx';

export default function Trust() {
  const { categories, category } = useApp();
  const { user } = useAuth();
  const p0 = categories.filter((c) => c.p0);
  const tabs = [...new Set([category, ...p0.map((c) => c.key)])].slice(0, 4).map((k) => categories.find((c) => c.key === k)).filter(Boolean);
  const [sel, setSel] = useState(category);
  const ev = useApi(`/eval?category=${sel}`, [sel]);
  const meta = useApi('/meta', []);
  const m = ev.data?.model;
  const pending = !m?.metrics || m.metrics.status === 'pending';
  return (
    <div className="page">
      <Header back={!!user} showCategory={false} crumb="Trust Center" />
      <div className="wrapx col g20" style={{ padding: '24px 28px' }}>
        <div className="row sb wrap g8"><div className="col g4"><h1 className="h2">Trust Center</h1><span className="muted s14">How good the model is, where the data comes from, and what it cannot do. Values come from metrics.json of the training run.</span></div><span className="tag">Model {meta.data?.modelVersion || '…'}</span></div>
        <Tabs items={tabs.map((t) => t.name)} value={categories.find((c) => c.key === sel)?.name} onChange={(name) => setSel(categories.find((c) => c.name === name)?.key)} />
        {ev.error && <ErrorBox compact error={ev.error} onRetry={ev.refetch} />}
        {pending && ev.data && <Banner tone="warn" icon="cpu-line">Awaiting metrics.json from the ML pipeline. This server runs the built-in placeholder engine ({meta.data?.mlMode}); targets below are the PRD acceptance criteria and will show measured values once your models are linked.</Banner>}
        <div className="grid4">{(ev.data?.targets || Array.from({ length: 4 })).slice(0, 4).map((t, i) => t ? (
          <div key={t.id} className="card pad16 col g6"><span className="s12 muted">{t.metric}</span><span className="h2 num">{pending ? '—' : m.metrics[t.id] ?? '—'}</span><span className={`tag ${pending ? '' : 'ok'}`} style={{ alignSelf: 'flex-start' }}>Target {t.target}{pending ? ' · pending' : ''}</span></div>) : <Skel key={i} h={110} style={{ borderRadius: 16 }} />)}</div>
        <div className="row as g16 stack-md">
          <div className="card pad20 col g12 f1"><div className="h4">Model vs baselines · spatial block CV, 5 folds × 5 seeds</div>
            <table className="t"><thead><tr><th>Model</th><th>Spearman ρ</th><th>NDCG@20</th><th>Top-20 hit</th><th /></tr></thead><tbody>
              {(m?.metrics?.baselines || [['Huff + LightGBM'], ['Ridge'], ['Weighted sum'], ['Population only']].map(([n]) => ({ name: n }))).map((b) => <tr key={b.name}><td className="b">{b.name}</td><td className="num">{b.spearman ?? '—'}</td><td className="num">{b.ndcg ?? '—'}</td><td className="num">{b.hit ?? '—'}</td><td>{b.shipped ? <span className="tag ok">Shipped</span> : pending ? <span className="tag">Pending</span> : ''}</td></tr>)}</tbody></table>
            <span className="s12 muted">The model with the best spatial-CV Spearman ρ ships per category. If the hybrid model does not beat the baselines, that result is reported here and the better model ships.</span></div>
          <div className="card pad20 col g12" style={{ width: 460, maxWidth: '100%' }}><div className="h4">Data sources</div>
            {meta.data ? meta.data.sources.map((s) => <div key={s.name} className="row g10 s13" style={{ padding: '8px 0', borderTop: '1px solid var(--line)' }}><span className="f1 col"><span className="b">{s.name}</span><span className="muted s12">{s.detail} · {s.licence}</span>{s.note && <span className="s11 faint">{s.note}</span>}</span><span className={`tag ${s.kind === 'real' ? 'ok' : s.kind === 'simulated' ? 'warn' : 'info'}`}>{s.kind === 'real' ? 'Real' : s.kind === 'simulated' ? 'Simulated' : 'Yours'}</span></div>) : <Skel h={160} />}</div>
        </div>
        <div className="row g16 as stack-md">
          <div className="f1"><Collapse open title={`Assumptions (${categories.find((c) => c.key === sel)?.name.toLowerCase() || ''})`}>{ev.data && <div className="s13 muted" style={{ lineHeight: 1.6 }}>{ev.data.assumptions.areaSqft.toLocaleString('en-IN')} sq ft · capex {inr(ev.data.assumptions.capex)} · opex {inr(ev.data.assumptions.opex)}/yr · margin {Math.round(ev.data.assumptions.margin * 100)}% · rent ₹{ev.data.assumptions.rentRange[0]}–{ev.data.assumptions.rentRange[1]}/sq ft/mo (simulated) · catchment {ev.data.assumptions.catchmentKm} km</div>}</Collapse></div>
          <div className="f1"><Collapse open title="Limitations"><ul className="s13 muted col g6" style={{ paddingLeft: 16 }}>{meta.data?.limitations.map((l) => <li key={l}>{l}</li>)}</ul></Collapse></div>
          <div className="f1"><Collapse open title="Recalibration log"><div className="s13 muted">{ev.data ? `${ev.data.outcomes} outcomes recorded · interval scale ${(m?.calibrationScale ?? 1).toFixed(2)} · last update ${m?.updatedAt ? new Date(m.updatedAt).toLocaleDateString('en-IN') : '—'}` : '…'}</div></Collapse></div>
        </div>
        <div className="card pad20 row g12 as"><Icon n="shield-check-line" s={20} c="var(--ok)" /><div className="col g4"><b>How explanations stay honest</b><span className="s13 muted" style={{ lineHeight: 1.6 }}>A language model only verbalises a structured evidence record at temperature 0. A validator rejects any number or site ID that is not in that record, and a template narrative is used whenever the AI is unavailable or fails validation. Scoring never depends on the language model.</span></div></div>
      </div>
      <Footer />
    </div>
  );
}
