import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, fieldErrors } from '../lib/api.js';
import { useApp, useAuth, useToast } from '../lib/state.jsx';
import { inr, parseNum, inrPlain, ROLE_LABEL, initials } from '../lib/format.js';
import { Icon, ThemeToggle, Field, Banner, Check, Radio, Seg, Sim } from '../components/ui.jsx';
import HexMap from '../components/HexMap.jsx';

const STEPS = ['Business', 'Market', 'Your stores', 'Format & economics', 'Goals & constraints'];
const ROLES = Object.entries(ROLE_LABEL).map(([value, label]) => ({ value, label }));

function Shell({ n, title, sub, children, aside, onBack, onNext, nextLabel = 'Continue', busy, err, canNext = true }) {
  const { user } = useAuth();
  const nav = useNavigate();
  return (
    <div className="page">
      <header className="hdr"><div className="hleft"><span className="s13 muted hide-sm">Set up your business profile</span></div><div className="logo">Karyakshetram<i>.</i></div>
        <div className="hright"><button className="btn ghost sm" onClick={() => nav('/')}><Icon n="save-3-line" s={16} /><span className="hide-sm">Save and exit</span></button><span className="hide-sm"><ThemeToggle /></span><div className="avatar">{initials(user?.name)}</div></div></header>
      <div className="row jc" style={{ padding: '20px 16px', borderBottom: '1px solid var(--line)' }}>
        <div className="stepper">{STEPS.map((s, i) => (<span key={s} className="row g8">{i > 0 && <span className="step-line hide-sm" />}
          <span className={`step ${i + 1 === n ? 'on' : i + 1 < n ? 'done' : ''}`}><span className="n">{i + 1 < n ? <Icon n="check-line" s={14} /> : i + 1}</span><span className="hide-sm">{s}</span></span></span>))}</div>
      </div>
      <div className="row as wrapx stack-md" style={{ padding: '32px 28px', gap: 28 }}>
        <div className="f1 col g24">
          <div className="col g6"><span className="s12 b acc up">Step {n} of 5</span><h1 className="h2">{title}</h1><p className="muted s14">{sub}</p></div>
          {err && <Banner tone="bad" icon="error-warning-line">{err}</Banner>}
          {children}
        </div>
        <aside style={{ width: 360, maxWidth: '100%' }} className="col g16">{aside}</aside>
      </div>
      <div className="row sb" style={{ padding: '16px 28px', borderTop: '1px solid var(--line)', background: 'var(--surface)', position: 'sticky', bottom: 0, zIndex: 50 }}>
        <button className="btn out" onClick={onBack} disabled={n === 1}><Icon n="arrow-left-line" s={16} />Back</button>
        <div className="row g6" aria-label={`Step ${n} of 5`}>{[1, 2, 3, 4, 5].map((i) => <span key={i} style={{ width: i === n ? 24 : 8, height: 8, borderRadius: 4, background: i <= n ? 'var(--accent)' : 'var(--line)' }} />)}</div>
        <button className="btn ink" onClick={onNext} disabled={busy || !canNext}>{busy && <Icon n="loader-4-line" className="spin" />}{nextLabel}<Icon n="arrow-right-line" s={16} /></button>
      </div>
    </div>
  );
}

function Summary({ p, cat, storesCount }) {
  const rows = [
    ['Category', cat?.name], ['Role', ROLE_LABEL[p.role]], ['City', p.city ? 'Pune & PCMC' : null], ['Focus areas', p.focusAreas?.length ? `${p.focusAreas.length} localities` : p.onboardingStep > 2 ? 'Whole city' : null],
    ['Own stores', p.hasStores === false ? 'None (first store)' : storesCount ? `${storesCount} loaded` : null], ['Format', p.format?.areaSqft && p.onboardingStep > 3 ? `${inrPlain(p.format.areaSqft)} sq ft` : null], ['Constraints', p.completed ? 'Set' : null],
  ];
  return <div className="card pad20 col g12"><div className="h4">Your profile so far</div>{rows.map(([k, v]) => <div key={k} className="row sb s13 g8"><span className="muted">{k}</span><span className="b row g6" style={{ textAlign: 'right' }}>{v || '—'}{v && <Icon n="checkbox-circle-fill" s={14} c="var(--ok)" />}</span></div>)}<div className="s11 muted">Editable any time from Profile. Changes re-score recommendations.</div></div>;
}
const Why = ({ t, children }) => <div className="panel pad20 col g8"><div className="row g8 b s14"><Icon n="information-line" s={16} c="var(--accent)" />{t}</div><div className="s13 muted" style={{ lineHeight: 1.55 }}>{children}</div></div>;

export default function Onboarding() {
  const { step } = useParams();
  const n = Math.min(5, Math.max(1, Number(step) || 1));
  const nav = useNavigate();
  const toast = useToast();
  const { user, saveProfile } = useAuth();
  const { categories, setCategory } = useApp();
  const [p, setP] = useState(() => JSON.parse(JSON.stringify(user.profile || {})));
  const [name] = useState(user.name);
  const [errs, setErrs] = useState({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [stores, setStores] = useState([]);
  const cat = categories.find((c) => c.key === p.category);
  useEffect(() => { api('/stores').then((r) => setStores(r.stores)).catch(() => {}); }, []);
  useEffect(() => { setErr(''); setErrs({}); window.scrollTo(0, 0); }, [n]);
  const pKey = `${p.businessName}|${p.category}|${p.hasStores}`;
  useEffect(() => { setErrs((e) => (Object.keys(e).length ? {} : e)); setErr(''); }, [pKey]);
  if (n > (user.profile?.onboardingStep || 1) + 1 && !user.profile?.completed) return <NavigateTo to={`/onboarding/${user.profile?.onboardingStep || 1}`} />;

  const save = async (patch, nextStep) => {
    setBusy(true); setErr(''); setErrs({});
    try {
      const r = await saveProfile({ profile: { ...patch, onboardingStep: Math.max(nextStep || n, user.profile?.onboardingStep || 1) } });
      setP(JSON.parse(JSON.stringify(r.user.profile)));
      return true;
    } catch (e) { setErrs(fieldErrors(e)); setErr(e.message); return false; } finally { setBusy(false); }
  };
  const go = (k) => nav(`/onboarding/${k}`);
  const back = () => go(n - 1);

  // ------------------------------- step 1
  if (n === 1) {
    return <Step1 {...{ p, setP, categories, errs, err, busy, back, name }} onNext={async () => {
      const e = {}; if (!p.businessName || p.businessName.trim().length < 2) e.businessName = 'Enter your business or brand name'; if (!p.category) e.category = 'Choose a business category';
      setErrs(e); if (Object.keys(e).length) { setErr('Fill the highlighted fields to continue.'); return; }
      const changed = p.category !== user.profile?.category;
      if (await save({ businessName: p.businessName.trim(), role: p.role || 'expansion_manager', category: p.category, ...(changed ? {} : {}) }, 2)) { setCategory(p.category); go(2); }
    }} />;
  }
  if (n === 2) return <Step2 {...{ p, setP, cat, err, busy, back, stores }} onNext={async () => { if (await save({ city: 'pune', focusAreas: p.focusAreas || [], grid: p.grid || 'res8' }, 3)) go(3); }} />;
  if (n === 3) return <Step3 {...{ p, setP, cat, err, setErr, busy, back, stores, setStores, toast }} onNext={async () => {
    if (p.hasStores == null) { setErr('Tell us whether you already operate stores.'); return; }
    if (p.hasStores && !stores.length) { setErr('Add at least one store, or choose “No, this is our first store”.'); return; }
    if (await save({ hasStores: p.hasStores, competitorBrands: p.competitorBrands || [] }, 4)) go(4);
  }} />;
  if (n === 4) return <Step4 {...{ p, setP, cat, err, errs, setErrs, busy, back, stores }} onNext={async (fmt) => { if (await save({ format: fmt }, 5)) go(5); }} />;
  return <Step5 {...{ p, setP, cat, err, errs, setErrs, busy, back, stores }} onNext={async (goals) => {
    if (await save({ goals, completed: true }, 5)) { toast('Profile complete. Finding your best locations…'); nav('/app'); }
  }} />;
}
function NavigateTo({ to }) { const nav = useNavigate(); useEffect(() => { nav(to, { replace: true }); }, [nav, to]); return null; }

function Step1({ p, setP, categories, errs, err, busy, back, onNext }) {
  const [q, setQ] = useState('');
  const groups = [...new Set(categories.map((c) => c.group))];
  const list = categories.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
  const cat = categories.find((c) => c.key === p.category);
  return (
    <Shell n={1} title="What are you expanding?" sub="Pick the business type. Everything after this step adapts to it." onBack={back} onNext={onNext} busy={busy} err={err}
      aside={<><Summary p={p} cat={cat} /><Why t="Why we ask">The category loads a profile: hard rules, demand drivers, catchment{cat ? ` (${cat.catchmentKm} km for ${cat.name.toLowerCase()})` : ''}, store size, margin and opex. Your role sets the default view: managers see the ranked map, finance sees money and stress tests first.</Why>
        {cat && <div className="card pad20 col g8"><div className="row g8 b"><Icon n={cat.icon} c="var(--accent)" />{cat.name}</div><span className="s12 muted">Drivers: {cat.drivers}</span><span className="s12 muted">Rule: {cat.ruleText}</span></div>}</>}>
      <div className="grid2">
        <Field label="Business or brand name" icon="building-2-line" value={p.businessName} onChange={(v) => setP({ ...p, businessName: v })} error={errs.businessName || errs['profile.businessName']} placeholder="e.g. FreshMart Retail Pvt Ltd" />
        <Field label="Your role" value={p.role || 'expansion_manager'} onChange={(v) => setP({ ...p, role: v })} options={ROLES} />
      </div>
      <div className="row sb wrap g8"><div className="h4">Business category</div><div className="search" style={{ width: 340, height: 40 }}><Icon n="search-line" s={16} /><input placeholder="Search 30 categories" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search categories" /></div></div>
      {(errs.category || errs['profile.category']) && <span className="help err"><Icon n="error-warning-line" s={14} />{errs.category || errs['profile.category']}</span>}
      {!categories.length && <div className="grid4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="skel" style={{ height: 58 }} />)}</div>}
      {groups.map((g) => { const items = list.filter((c) => c.group === g); if (!items.length) return null; return (
        <div key={g} className="col g8"><span className="s12 b muted up">{g}</span><div className="grid4" style={{ gap: 10 }}>{items.map((c) => (
          <button key={c.key} className={`cat ${p.category === c.key ? 'on' : ''}`} onClick={() => setP({ ...p, category: c.key })} aria-pressed={p.category === c.key}><span className="ic"><Icon n={c.icon} /></span><span className="f1">{c.name}</span>{c.p0 && <span className="tag ok">P0</span>}</button>))}</div></div>); })}
      {categories.length > 0 && !list.length && <div className="s13 muted">No category matches “{q}”.</div>}
    </Shell>
  );
}

function Step2({ p, setP, cat, err, busy, back, onNext, stores }) {
  const [locs, setLocs] = useState([]);
  const [cells, setCells] = useState(null);
  useEffect(() => { api('/localities').then((r) => setLocs(r.localities)); api(`/cells?category=${p.category}`).then(setCells).catch(() => {}); }, [p.category]);
  const fa = p.focusAreas || [];
  const toggle = (l) => setP({ ...p, focusAreas: fa.includes(l) ? fa.filter((x) => x !== l) : [...fa, l] });
  const low = useMemo(() => {
    if (!cells) return [];
    const by = {};
    for (const f of cells.features) { const k = f.properties.locality; if (!fa.length || fa.includes(k)) { by[k] = by[k] || { n: 0, low: 0, cov: 0 }; by[k].n++; by[k].cov += f.properties.coverage; if (f.properties.coverage < 0.4) by[k].low++; } }
    return Object.entries(by).filter(([, v]) => v.low / v.n > 0.4).map(([k, v]) => [k, v.cov / v.n]);
  }, [cells, fa]);
  const shown = cells ? { ...cells, features: cells.features.filter((f) => !fa.length || fa.includes(f.properties.locality)) } : null;
  return (
    <Shell n={2} title="Where do you want to grow?" sub="Choose the city and, if you like, the areas you care about." onBack={back} onNext={onNext} busy={busy} err={err}
      aside={<><Summary p={{ ...p, city: 'pune', onboardingStep: 2 }} cat={cat} storesCount={stores.length} /><Why t="Coverage check">We check data coverage as you pick areas. If more than 40% of a catchment has coverage below 0.4, results show an “insufficient data” state instead of a guess.</Why>
        {low.slice(0, 3).map(([k, c]) => <Banner key={k} tone="warn" icon="error-warning-line">{k}: low map coverage ({c.toFixed(2)}). Results there will show wider ranges.</Banner>)}</>}>
      <div className="col g10"><div className="h4">City</div><div className="grid4" style={{ gap: 10 }}>
        <button className="cat on" style={{ minHeight: 64 }}><span className="ic"><Icon n="building-line" /></span><span className="col f1"><span>Pune &amp; PCMC</span><span className="sub">{cells ? `${cells.features.length.toLocaleString('en-IN')} cells · live` : 'live'}</span></span><Radio on /></button>
        {['Kolhapur', 'Nashik', 'Nagpur'].map((c) => <button key={c} className="cat dis" disabled style={{ minHeight: 64 }} title="Coming soon"><span className="ic"><Icon n="building-line" c="var(--muted)" /></span><span className="col f1"><span>{c}</span><span className="sub">Coming soon</span></span><Radio /></button>)}
      </div></div>
      <div className="row as g20 stack-md">
        <div className="f1 col g12">
          <div className="h4">Focus areas <span className="s12 muted" style={{ fontWeight: 400 }}>optional · leave empty to scan the whole city</span></div>
          <div className="row g8 wrap">{locs.map((l) => { const on = fa.includes(l.name); return <button key={l.name} className={`chip ${on ? 'on' : ''}`} onClick={() => toggle(l.name)} aria-pressed={on}>{on && <Icon n="check-line" s={14} />}{l.name}</button>; })}
            {fa.length > 0 && <button className="chip" onClick={() => setP({ ...p, focusAreas: [] })}><Icon n="close-line" s={14} />Clear</button>}</div>
          <div className="h4" style={{ marginTop: 8 }}>Grid detail</div>
          <div className="row g10 stack-md">
            {[['res8', 'Standard · H3 res 8', '~0.74 km² cells, best where map data is complete'], ['res7', 'Coarse · H3 res 7', 'Use when data coverage is sparse']].map(([v, t, d]) => (
              <button key={v} className={`cat f1 ${(p.grid || 'res8') === v ? 'on' : ''}`} style={{ padding: 14 }} onClick={() => setP({ ...p, grid: v })}><Radio on={(p.grid || 'res8') === v} /><span className="col"><span>{t}</span><span className="sub">{d}</span></span></button>))}
          </div>
        </div>
        <div style={{ width: 360, height: 300, maxWidth: '100%', position: 'relative' }}>
          <HexMap features={shown?.features} fit="features" controls={false} legend={false} popup={false} />
          <div className="legend" style={{ left: 10, top: 10 }}>{fa.length ? `${fa.length} areas · ${shown?.features.length || 0} cells selected` : 'Whole city selected'}</div>
        </div>
      </div>
    </Shell>
  );
}

function Step3({ p, setP, cat, err, setErr, busy, back, onNext, stores, setStores, toast }) {
  const [mode, setMode] = useState('csv');
  const [report, setReport] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [manual, setManual] = useState({ name: '', lat: '', lon: '', rev: '' });
  const [mErr, setMErr] = useState({});
  const [brand, setBrand] = useState('');
  const fileRef = useRef(null);
  const upload = async (file) => {
    if (!file) return;
    if (file.size > 1024 * 1024) { setErr('File must be 1 MB or smaller. Nothing was imported.'); return; }
    setUploading(true); setErr('');
    const form = new FormData(); form.append('file', file); form.append('category', p.category); form.append('mode', 'replace');
    try { const r = await api('/stores/upload', { method: 'POST', form }); setReport({ ...r, file: file.name }); setStores((await api('/stores')).stores); setP({ ...p, hasStores: true }); }
    catch (e) { setReport(e.report ? { report: e.report, file: file.name, summary: null } : null); setErr(e.message); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };
  const addStore = async (body) => {
    try { await api('/stores', { method: 'POST', body: { ...body, category: p.category } }); setStores((await api('/stores')).stores); setP({ ...p, hasStores: true }); toast('Store added'); return true; }
    catch (e) { setMErr(fieldErrors(e)); toast(e.message, { tone: 'bad', icon: 'error-warning-line' }); return false; }
  };
  const del = async (id) => { await api(`/stores/${id}`, { method: 'DELETE' }); setStores((s) => s.filter((x) => x._id !== id)); };
  const sum = report?.summary;
  const brands = p.competitorBrands || [];
  return (
    <Shell n={3} title="Do you already operate stores?" sub="Load your current outlets so new sites are judged against your own network, not only competitors." onBack={back} onNext={onNext} busy={busy} err={err}
      aside={<><Summary p={{ ...p, onboardingStep: 3 }} cat={cat} storesCount={stores.length} /><Why t="Why your stores matter">Each existing store competes with a new one for the same households. With your stores loaded, every site shows the revenue it would take from them and the net gain to your network.</Why>
        <div className="note"><b>Validation rules</b><br />• lat/lon must fall inside the city polygon.<br />• Duplicates (same H3 cell + name) skipped.<br />• Missing revenue → simulated estimate, flagged and shown with wider range.<br />• &gt; 500 rows or &gt; 1 MB → rejected, nothing imported.<br />• 0 valid rows → stay on step.</div></>}>
      <div className="row g12 stack-md">
        {[[true, 'Yes, we operate stores', 'Enables cannibalisation and portfolio planning'], [false, 'No, this is our first store', 'Cannibalisation is skipped; competitors still count']].map(([v, t, d]) => (
          <button key={String(v)} className={`cat f1 ${p.hasStores === v ? 'on' : ''}`} style={{ padding: 16, alignItems: 'flex-start' }} onClick={() => setP({ ...p, hasStores: v })}><span style={{ marginTop: 2 }}><Radio on={p.hasStores === v} /></span><span className="col g4"><span>{t}</span><span className="sub">{d}</span></span></button>))}
      </div>
      {p.hasStores && <>
        <Seg value={mode} onChange={setMode} items={[{ value: 'csv', label: 'Upload CSV', icon: 'upload-cloud-2-line' }, { value: 'manual', label: 'Enter manually', icon: 'edit-box-line' }]} />
        {mode === 'csv' && <div className="row g16 as stack-md">
          <label className="f1 col ac jc g8" style={{ border: '1.5px dashed var(--line)', borderRadius: 16, padding: 24, background: 'var(--surface)', cursor: 'pointer', textAlign: 'center' }}
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files[0]); }}>
            <Icon n={uploading ? 'loader-4-line' : 'file-upload-line'} s={28} c="var(--accent)" className={uploading ? 'spin' : ''} />
            <div className="b">{report?.file ? `${report.file} · ${sum?.rows ?? '—'} rows` : 'Drop your CSV here or click to choose'}</div>
            <span className="s12 muted">Columns: name, lat, lon, annual_revenue (optional) · max 500 rows, 1 MB</span>
            <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => upload(e.target.files[0])} />
            <span className="btn out sm">{report ? 'Replace file' : 'Choose file'}</span>
            <a className="s12 acc b" href={`data:text/csv;charset=utf-8,${encodeURIComponent('name,lat,lon,annual_revenue\nStore #01 Aundh,18.5590,73.8077,44000000\nStore #02 Pashan,18.5362,73.7997,\n')}`} download="stores_template.csv" onClick={(e) => e.stopPropagation()}>Download template</a>
          </label>
          {report && <div className="card pad16 col g8" style={{ width: 260 }}><div className="b s13">Import result</div>
            {sum ? <>{[['ok', 'Valid', sum.valid], ['warn', 'Imputed revenue', sum.imputed], ['bad', 'Excluded', sum.excluded]].map(([c, t, v]) => <div key={t} className="row sb s13"><span className="row g6"><span className="dot" style={{ background: `var(--${c})` }} />{t}</span><b>{v}</b></div>)}</> : <span className="s13 badc">Nothing imported</span>}
            <button className="btn soft sm" onClick={() => { const rows = report.report.filter((r) => r.status !== 'valid'); const csv = ['line,name,status,reason', ...rows.map((r) => `${r.line},"${r.name}",${r.status},"${r.reason}"`)].join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'import_errors.csv'; a.click(); }}><Icon n="download-2-line" s={14} />Download error report</button></div>}
        </div>}
        {mode === 'manual' && <form className="card pad16 row g10 as wrap" onSubmit={async (e) => {
          e.preventDefault(); const lat = parseNum(manual.lat), lon = parseNum(manual.lon), rev = parseNum(manual.rev);
          const me = {}; if (!manual.name.trim()) me.name = 'Name is required'; if (!Number.isFinite(lat)) me.lat = 'Latitude must be a number'; if (!Number.isFinite(lon)) me.lon = 'Longitude must be a number'; if (Number.isNaN(rev)) me.annualRevenue = 'Enter a number';
          setMErr(me); if (Object.keys(me).length) return;
          if (await addStore({ name: manual.name.trim(), lat, lon, annualRevenue: rev ?? undefined })) setManual({ name: '', lat: '', lon: '', rev: '' });
        }}>
          <div style={{ flex: 2, minWidth: 180 }}><Field label="Store name" value={manual.name} onChange={(v) => setManual({ ...manual, name: v })} error={mErr.name} /></div>
          <div style={{ flex: 1, minWidth: 110 }}><Field label="Latitude" value={manual.lat} onChange={(v) => setManual({ ...manual, lat: v })} error={mErr.lat} placeholder="18.5590" /></div>
          <div style={{ flex: 1, minWidth: 110 }}><Field label="Longitude" value={manual.lon} onChange={(v) => setManual({ ...manual, lon: v })} error={mErr.lon} placeholder="73.8077" /></div>
          <div style={{ flex: 1.4, minWidth: 140 }}><Field label="Annual revenue (optional)" value={manual.rev} onChange={(v) => setManual({ ...manual, rev: v })} error={mErr.annualRevenue} suffix="₹" /></div>
          <button className="btn ink" style={{ marginTop: 22 }}><Icon n="add-line" />Add</button>
        </form>}
        {stores.length > 0 && <div className="card" style={{ overflowX: 'auto' }}><table className="t"><thead><tr><th>Store</th><th>Lat, lon</th><th>Annual revenue</th><th>Status</th><th /></tr></thead><tbody>
          {stores.map((s) => <tr key={s._id}><td className="b">{s.name}</td><td className="muted num">{s.loc.coordinates[1].toFixed(4)}, {s.loc.coordinates[0].toFixed(4)}</td><td className="num">{inr(s.annualRevenue)}</td>
            <td>{s.revenueEstimated ? <span className="tag warn">No revenue · simulated estimate used</span> : <span className="tag ok">Valid</span>}{s.category !== p.category && <span className="tag info" style={{ marginLeft: 6 }}>Other category</span>}</td>
            <td style={{ textAlign: 'right' }}><button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => del(s._id)} aria-label={`Remove ${s.name}`}><Icon n="delete-bin-line" s={15} /></button></td></tr>)}
          {report?.report?.filter((r) => r.status === 'excluded').map((r) => <tr key={`x${r.line}`}><td className="b">{r.name}</td><td className="muted">{r.lat}, {r.lon}</td><td>{r.annualRevenue ? inr(r.annualRevenue) : '—'}</td><td><span className="tag bad">{r.reason} · excluded</span></td><td /></tr>)}
        </tbody></table></div>}
      </>}
      <div className="field"><label>Competitor brands to watch <span className="s11 muted" style={{ fontWeight: 400 }}>optional</span></label>
        <div className="row g8 wrap">{brands.map((b) => <button key={b} className="chip on" onClick={() => setP({ ...p, competitorBrands: brands.filter((x) => x !== b) })} aria-label={`Remove ${b}`}>{b}<Icon n="close-line" s={14} /></button>)}
          <form className="row g6" onSubmit={(e) => { e.preventDefault(); const b = brand.trim(); if (b && !brands.includes(b) && brands.length < 20) setP({ ...p, competitorBrands: [...brands, b] }); setBrand(''); }}>
            <div className="input" style={{ height: 32, borderRadius: 999 }}><input placeholder="Add brand" value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={40} style={{ width: 120 }} /></div><button className="chip"><Icon n="add-line" s={14} />Add</button></form></div></div>
    </Shell>
  );
}

function Step4({ p, setP, cat, err, errs, setErrs, busy, back, onNext, stores }) {
  const f = p.format || {};
  const [v, setV] = useState({ areaSqft: f.areaSqft ?? cat?.areaSqft, margin: f.margin != null ? +(f.margin * 100).toFixed(1) : cat ? cat.margin * 100 : '', opex: f.opex ?? cat?.opex, capex: f.capex ?? cat?.capex, staff: f.staff ?? 10 });
  const [extras, setExtras] = useState(() => ({ ...Object.fromEntries((cat?.fields || []).map((x) => [x.key, x.default])), ...(f.extras || {}) }));
  const drivers = (cat?.drivers || '').split(',').map((s) => s.trim()).filter(Boolean);
  const [w, setW] = useState(() => ({ ...Object.fromEntries(drivers.map((d, i) => [d, [80, 60, 40, 20][i] ?? 30])), ...(f.drivers || {}) }));
  useEffect(() => { if (cat && v.areaSqft == null) setV({ areaSqft: cat.areaSqft, margin: cat.margin * 100, opex: cat.opex, capex: cat.capex, staff: 10 }); }, [cat]); // eslint-disable-line react-hooks/exhaustive-deps
  const reset = () => { if (!cat) return; setV({ areaSqft: cat.areaSqft, margin: cat.margin * 100, opex: cat.opex, capex: cat.capex, staff: 10 }); setExtras(Object.fromEntries(cat.fields.map((x) => [x.key, x.default]))); setErrs({}); };
  const maxArea = Math.max(20000, (cat?.areaSqft || 0) * 2);
  const next = () => {
    const area = parseNum(v.areaSqft), m = parseNum(v.margin), opex = parseNum(v.opex), capex = parseNum(v.capex), staff = parseNum(v.staff);
    const e = {};
    if (!Number.isFinite(area) || area < 200 || area > maxArea) e.areaSqft = `Allowed 200 – ${maxArea.toLocaleString('en-IN')} sq ft`;
    if (!Number.isFinite(m) || m < 1 || m > 80) e.margin = 'Margin must be between 1% and 80%';
    if (!Number.isFinite(opex) || opex <= 0) e.opex = 'Operating cost must be more than 0';
    if (!Number.isFinite(capex) || capex <= 0) e.capex = 'Capex must be more than 0';
    if (!Number.isFinite(staff) || staff < 0) e.staff = 'Enter 0 or more';
    setErrs(e); if (Object.keys(e).length) return;
    onNext({ areaSqft: area, margin: m / 100, opex, capex, staff: Math.round(staff), extras, drivers: w });
  };
  const E = (k) => errs[k] || errs[`profile.format.${k}`];
  return (
    <Shell n={4} title="Store format and economics" sub="These numbers turn predicted revenue into profit, tier and break-even rent." onBack={back} onNext={next} busy={busy} err={err}
      aside={<><Summary p={{ ...p, onboardingStep: 4, format: { areaSqft: parseNum(v.areaSqft) } }} cat={cat} storesCount={stores.length} />
        <div className="card pad20 col g10"><div className="h4">This step changes per category</div><span className="s13 muted">{cat?.name} asks for: {cat?.fields.map((x) => x.label).join(', ')}.</span>
          <span className="s12 muted">Other examples: EV charging asks charger type and kW per bay; jewellery asks vault and security level; warehouses ask docks and ceiling height.</span></div>
        <div className="note"><b>Validation</b><br />Area 200–{maxArea.toLocaleString('en-IN')} sq ft · margin 1–80% · opex &gt; 0. Out-of-range values show here and as HTTP 400 field messages from the API.</div></>}>
      <Banner tone="info" icon="magic-line" action={<button className="btn ghost sm" style={{ color: 'var(--info)' }} onClick={reset}><Icon n="refresh-line" s={14} />Reset to defaults</button>}>Pre-filled from the <b>&nbsp;{cat?.name}&nbsp;</b> profile. Change anything that differs for your business.</Banner>
      <div className="grid3">
        <Field label="Store area" sim value={v.areaSqft} onChange={(x) => setV({ ...v, areaSqft: x })} suffix="sq ft" error={E('areaSqft')} help={`Allowed 200 – ${maxArea.toLocaleString('en-IN')}`} />
        <Field label="Gross margin" sim value={v.margin} onChange={(x) => setV({ ...v, margin: x })} suffix="%" error={E('margin')} />
        <Field label="Operating cost / year" sim value={inrPlain(parseNum(v.opex)) || v.opex} onChange={(x) => setV({ ...v, opex: x })} suffix="₹" error={E('opex')} help={inr(parseNum(v.opex))} />
        <Field label="Capex (fit-out + equipment)" sim value={inrPlain(parseNum(v.capex)) || v.capex} onChange={(x) => setV({ ...v, capex: x })} suffix="₹" error={E('capex')} help={inr(parseNum(v.capex))} />
        <Field label="Staff (FTE)" value={v.staff} onChange={(x) => setV({ ...v, staff: x })} suffix="people" error={E('staff')} />
      </div>
      {drivers.length > 0 && <div className="col g12"><div className="row sb"><div className="h4">{cat?.name} demand drivers</div><span className="s12 muted">Weights tailor emphasis in explanations; the model itself is unchanged</span></div>
        {drivers.map((d) => <div key={d} className="row g16"><span className="s13" style={{ width: 220 }}>{d}</span><input type="range" className="rng f1" min="0" max="100" value={w[d] ?? 50} style={{ '--p': `${w[d] ?? 50}%` }} onChange={(e) => setW({ ...w, [d]: Number(e.target.value) })} aria-label={`${d} weight`} /><span className="b s13 num" style={{ width: 44, textAlign: 'right' }}>{w[d] ?? 50}%</span></div>)}</div>}
      {cat?.fields?.length > 0 && <div className="col g12"><div className="h4">{cat.name}-specific options</div><div className="grid3">
        {cat.fields.map((fl) => fl.type === 'select' ? <Field key={fl.key} label={fl.label} value={extras[fl.key]} onChange={(x) => setExtras({ ...extras, [fl.key]: x })} options={fl.options} />
          : fl.type === 'toggle' ? <div key={fl.key} className="field"><label>{fl.label}</label><button className="input" onClick={() => setExtras({ ...extras, [fl.key]: !extras[fl.key] })} style={{ justifyContent: 'space-between' }}><span>{extras[fl.key] ? 'Yes' : 'No'}</span><span className={`tgl sm ${extras[fl.key] ? 'on' : ''}`} /></button></div>
          : <Field key={fl.key} label={fl.label} value={extras[fl.key]} onChange={(x) => setExtras({ ...extras, [fl.key]: x === '' ? '' : Number(x) })} suffix={fl.unit} type="number" />)}
      </div></div>}
    </Shell>
  );
}

function Step5({ p, setP, cat, err, errs, setErrs, busy, back, onNext, stores }) {
  const g = p.goals || {};
  const capex = p.format?.capex || cat?.capex || 0;
  const [v, setV] = useState({ budget: g.budget ?? capex * 5, maxRent: g.maxRent ?? Math.round(220 * (cat?.rentFactor || 1)), minSpacingKm: g.minSpacingKm ?? 1.5, minP10Profit: g.minP10Profit ?? 0, k: g.k ?? 5, risk: g.risk || 'balanced', excludeLowConfidence: g.excludeLowConfidence ?? true });
  const [custom, setCustom] = useState(![1, 3, 5, 10, 20].includes(g.k ?? 5));
  const check = (x) => {
    const e = {}; const b = parseNum(x.budget), r = parseNum(x.maxRent), s = parseNum(x.minSpacingKm), m = parseNum(x.minP10Profit), k = parseNum(x.k);
    if (!Number.isFinite(b) || b <= 0) e.budget = 'Budget must be more than 0'; else if (b < capex) e.budget = `Below the capex of one store (${inr(capex)})`;
    if (!Number.isFinite(r) || r < 10 || r > 1000) e.maxRent = 'Rent must be between ₹10 and ₹1,000 per sq ft per month';
    if (!Number.isFinite(s) || s < 0.5 || s > 10) e.minSpacingKm = 'Spacing must be 0.5 – 10 km';
    if (!Number.isFinite(m) || m < 0) e.minP10Profit = 'Must be 0 or more';
    if (!Number.isInteger(k) || k < 1 || k > 20) e.k = 'Choose 1 – 20 sites';
    return e;
  };
  const live = check(v);
  const nErr = Object.keys(live).length;
  const submit = () => { setErrs(live); if (nErr) return; onNext({ budget: parseNum(v.budget), maxRent: parseNum(v.maxRent), minSpacingKm: parseNum(v.minSpacingKm), minP10Profit: parseNum(v.minP10Profit), k: parseNum(v.k), risk: v.risk, excludeLowConfidence: v.excludeLowConfidence }); };
  const E = (k) => errs[k] || errs[`profile.goals.${k}`] || (Object.keys(errs).length ? live[k] : undefined);
  const ownCount = stores.filter((s) => s.category === p.category).length;
  return (
    <Shell n={5} title="Goals and constraints" sub="Set limits so we only show sites you could actually open." onBack={back} onNext={submit} nextLabel="Find locations" busy={busy} err={err || (Object.keys(errs).length && nErr ? `${nErr} field${nErr > 1 ? 's need' : ' needs'} attention before we can search.` : '')}
      aside={<><div className="card pad20 col g12"><div className="h4">Review before we search</div>
        {[['Category', cat?.name], ['City / areas', `Pune & PCMC · ${p.focusAreas?.length ? `${p.focusAreas.length} areas` : 'whole city'}`], ['Own stores', p.hasStores ? `${ownCount} of this category` : 'None (first store)'], ['Format', `${inrPlain(p.format?.areaSqft)} sq ft`], ['Margin / opex', `${((p.format?.margin || 0) * 100).toFixed(0)}% · ${inr(p.format?.opex)}`], ['Budget', `${inr(parseNum(v.budget))} · ${v.k} sites`], ['Max rent', live.maxRent ? `₹${v.maxRent} — fix` : `₹${v.maxRent}`]].map(([k, val], i) => <div key={k} className="row sb s13 g8"><span className="muted">{k}</span><span className={`b ${i === 6 && live.maxRent ? 'badc' : ''}`} style={{ textAlign: 'right' }}>{val}</span></div>)}
        <button className="btn ink" style={{ width: '100%' }} disabled={!!nErr || busy} onClick={submit}><Icon n="search-eye-line" s={16} />Find locations</button>
        <span className="s11 muted">{nErr ? `Disabled until ${nErr} field${nErr > 1 ? 's are' : ' is'} fixed.` : 'Typical response under 3 s.'}</span></div>
        <Why t="What happens next">We filter about 950 scored cells by your rules and constraints, then return five labelled picks at least {v.minSpacingKm} km apart with stress tests attached.</Why></>}>
      <div className="grid2">
        <Field label="Total budget (capex)" value={inrPlain(parseNum(v.budget)) || v.budget} onChange={(x) => setV({ ...v, budget: x })} suffix="₹" error={E('budget')} help={`${inr(parseNum(v.budget))} · about ${Math.max(0, Math.floor((parseNum(v.budget) || 0) / (capex || 1)))} stores at ${inr(capex)}`} />
        <Field label="Maximum rent" value={v.maxRent} onChange={(x) => setV({ ...v, maxRent: x })} suffix="₹/sq ft/month" error={E('maxRent') || (live.maxRent && String(v.maxRent).length > 3 ? live.maxRent : undefined)} />
        <Field label="Minimum distance between picks" value={v.minSpacingKm} onChange={(x) => setV({ ...v, minSpacingKm: x })} suffix="km" error={E('minSpacingKm')} help="Default 1.5 km keeps picks from competing with each other" />
        <Field label="Minimum downside profit (P10)" value={v.minP10Profit} onChange={(x) => setV({ ...v, minP10Profit: x })} suffix="₹/yr" error={E('minP10Profit')} help="Sites below this are hidden from default picks" />
      </div>
      <div className="col g10"><div className="h4">How many new sites are you planning?</div><div className="row g8 wrap">{[1, 3, 5, 10, 20].map((k) => <button key={k} className={`chip ${!custom && Number(v.k) === k ? 'on' : ''}`} style={{ width: 64, justifyContent: 'center' }} onClick={() => { setCustom(false); setV({ ...v, k }); }}>{k}</button>)}
        <button className={`chip ${custom ? 'on' : ''}`} onClick={() => setCustom(true)}>Custom</button>{custom && <div style={{ width: 120 }}><Field value={v.k} onChange={(x) => setV({ ...v, k: parseNum(x) })} suffix="sites" error={E('k')} /></div>}</div></div>
      <div className="col g10"><div className="h4">Risk appetite</div><div className="row g10 stack-md">{[['conservative', 'Conservative', 'Rank by downside (P10) profit'], ['balanced', 'Balanced', 'Rank by expected profit'], ['aggressive', 'Aggressive', 'Favour growth and under-served areas']].map(([k, t, d]) => (
        <button key={k} className={`cat f1 ${v.risk === k ? 'on' : ''}`} style={{ padding: 14 }} onClick={() => setV({ ...v, risk: k })}><Radio on={v.risk === k} /><span className="col"><span>{t}</span><span className="sub">{d}</span></span></button>))}</div></div>
      <Check on={v.excludeLowConfidence} onClick={() => setV({ ...v, excludeLowConfidence: !v.excludeLowConfidence })} label={<>Exclude low-confidence and empty-market sites from default picks <span className="tag">recommended</span></>} />
    </Shell>
  );
}
