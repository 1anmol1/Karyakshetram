import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, fieldErrors } from '../lib/api.js';
import { useApp, useAuth, useToast } from '../lib/state.jsx';
import { inr, inrPlain, parseNum, ROLE_LABEL, initials } from '../lib/format.js';
import { Header, Footer, SystemBanners } from '../components/Layout.jsx';
import { Icon, Collapse, Field, Modal, Banner, Check } from '../components/ui.jsx';

const NAV = [['personal', 'user-line', 'Personal'], ['business', 'building-2-line', 'Business'], ['stores', 'store-2-line', 'My stores'], ['format', 'equalizer-line', 'Format & economics'], ['goals', 'focus-3-line', 'Goals & constraints'], ['security', 'lock-line', 'Security']];

const Bar = ({ dirty, onSave, onDiscard, note, disabled }) => dirty && <div className="row sb wrap g8" style={{ marginTop: 16, padding: '12px 16px', borderRadius: 12, background: 'var(--surface)' }}><span className="s13 row g8"><Icon n="error-warning-line" s={16} c="var(--warn)" />{note || 'You have unsaved changes.'}</span><span className="row g8"><button className="btn ghost sm" onClick={onDiscard}>Discard</button><button className="btn ink sm" disabled={disabled} onClick={onSave}>Save changes</button></span></div>;
const Sec = ({ id, children, refs }) => <div ref={(el) => { refs.current[id] = el; }} style={{ scrollMarginTop: 90 }}>{children}</div>;

export default function Profile() {
  const { user, saveProfile, logout, setUser } = useAuth();
  const { categories, setCategory } = useApp();
  const toast = useToast();
  const nav = useNavigate();
  const loc = useLocation();
  const p = user.profile || {};
  const cat = categories.find((c) => c.key === p.category);
  const [section, setSection] = useState(loc.hash.slice(1) || 'business');
  const [lastSaved, setLastSaved] = useState(null);
  const refs = useRef({});
  useEffect(() => { const h = loc.hash.slice(1); if (h) { setSection(h); setTimeout(() => refs.current[h]?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); } }, [loc.hash]);
  const goto = (k) => { setSection(k); refs.current[k]?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const done = (msg, r) => { setLastSaved(new Date()); toast(r?.rescored ? `${msg} · saved searches will re-score` : msg); };

  // ----- business
  const [biz, setBiz] = useState({ name: user.name, businessName: p.businessName || '', role: p.role, focusAreas: (p.focusAreas || []).join(', '), grid: p.grid || 'res8' });
  const [bizErr, setBizErr] = useState({});
  const bizDirty = biz.name !== user.name || biz.businessName !== (p.businessName || '') || biz.role !== p.role || biz.grid !== (p.grid || 'res8') || biz.focusAreas !== (p.focusAreas || []).join(', ');
  const saveBiz = async () => {
    try { const r = await saveProfile({ name: biz.name, profile: { businessName: biz.businessName, role: biz.role, grid: biz.grid, focusAreas: biz.focusAreas.split(',').map((s) => s.trim()).filter(Boolean) } }); setBizErr({}); done('Business details saved', r); }
    catch (e) { setBizErr(fieldErrors(e)); toast(e.message, { tone: 'bad', icon: 'error-warning-line' }); }
  };
  // ----- category change
  const [catModal, setCatModal] = useState(false);
  const [newCat, setNewCat] = useState(p.category);
  const changeCat = async () => {
    try { const r = await saveProfile({ profile: { category: newCat }, resetForCategory: true }); setCategory(newCat); setCatModal(false); done(`Category changed to ${categories.find((c) => c.key === newCat)?.name}`, r); }
    catch (e) { toast(e.message, { tone: 'bad' }); }
  };
  // ----- format
  const f = p.format || {};
  const initFmt = () => ({ areaSqft: String(f.areaSqft ?? ''), margin: f.margin != null ? String(+(f.margin * 100).toFixed(1)) : '', opex: String(f.opex ?? ''), capex: String(f.capex ?? ''), staff: String(f.staff ?? '') });
  const [fmt, setFmt] = useState(initFmt);
  const [fmtErr, setFmtErr] = useState({});
  const fmtDirty = JSON.stringify(fmt) !== JSON.stringify(initFmt());
  const saveFmt = async () => {
    const e = {}; const a = parseNum(fmt.areaSqft), m = parseNum(fmt.margin), o = parseNum(fmt.opex), c = parseNum(fmt.capex), s = parseNum(fmt.staff);
    if (!Number.isFinite(a) || a < 200) e.areaSqft = 'At least 200 sq ft'; if (!Number.isFinite(m) || m < 1 || m > 80) e.margin = 'Margin must be between 1% and 80%'; if (!Number.isFinite(o) || o <= 0) e.opex = 'Must be more than 0'; if (!Number.isFinite(c) || c <= 0) e.capex = 'Must be more than 0';
    setFmtErr(e); if (Object.keys(e).length) return;
    try { const r = await saveProfile({ profile: { format: { areaSqft: a, margin: m / 100, opex: o, capex: c, staff: Number.isFinite(s) ? Math.round(s) : undefined } } }); done('Format & economics saved', r); }
    catch (er) { setFmtErr(Object.fromEntries(Object.entries(fieldErrors(er)).map(([k, v]) => [k.split('.').pop(), v]))); }
  };
  // ----- goals
  const g = p.goals || {};
  const initGoals = () => ({ budget: String(g.budget ?? ''), maxRent: String(g.maxRent ?? ''), minSpacingKm: String(g.minSpacingKm ?? 1.5), minP10Profit: String(g.minP10Profit ?? 0), k: String(g.k ?? 5), risk: g.risk || 'balanced', excludeLowConfidence: g.excludeLowConfidence !== false });
  const [goals, setGoals] = useState(initGoals);
  const [goalErr, setGoalErr] = useState({});
  const goalsDirty = JSON.stringify(goals) !== JSON.stringify(initGoals());
  const validateGoals = (x) => {
    const e = {}; const b = parseNum(x.budget), r = parseNum(x.maxRent), s = parseNum(x.minSpacingKm), m = parseNum(x.minP10Profit), k = parseNum(x.k);
    if (!Number.isFinite(b) || b <= 0) e.budget = 'Budget must be more than 0'; if (!Number.isFinite(r) || r < 10 || r > 1000) e.maxRent = 'Rent must be between ₹10 and ₹1,000 per sq ft per month';
    if (!Number.isFinite(s) || s < 0.5 || s > 10) e.minSpacingKm = 'Spacing must be 0.5 – 10 km'; if (!Number.isFinite(m) || m < 0) e.minP10Profit = 'Must be 0 or more'; if (!Number.isInteger(k) || k < 1 || k > 20) e.k = '1 – 20';
    return e;
  };
  const liveGoalErr = validateGoals(goals);
  const saveGoals = async () => {
    setGoalErr(liveGoalErr); if (Object.keys(liveGoalErr).length) return;
    try { const r = await saveProfile({ profile: { goals: { budget: parseNum(goals.budget), maxRent: parseNum(goals.maxRent), minSpacingKm: parseNum(goals.minSpacingKm), minP10Profit: parseNum(goals.minP10Profit), k: parseNum(goals.k), risk: goals.risk, excludeLowConfidence: goals.excludeLowConfidence } } }); done('Goals & constraints saved', r); }
    catch (er) { setGoalErr(Object.fromEntries(Object.entries(fieldErrors(er)).map(([k, v]) => [k.split('.').pop(), v]))); }
  };
  // ----- stores
  const [stores, setStores] = useState(null);
  const [upRes, setUpRes] = useState(null);
  const fileRef = useRef(null);
  const loadStores = () => api('/stores').then((r) => setStores(r.stores)).catch(() => setStores([]));
  useEffect(() => { loadStores(); }, []);
  const upload = async (file, mode) => {
    if (!file) return;
    const form = new FormData(); form.append('file', file); form.append('category', p.category); form.append('mode', mode);
    try { const r = await api('/stores/upload', { method: 'POST', form }); setUpRes(r.summary); loadStores(); toast(`${r.summary.valid + r.summary.imputed} stores imported, ${r.summary.excluded} excluded`); }
    catch (e) { toast(e.message, { tone: 'bad', icon: 'error-warning-line' }); setUpRes(null); }
    finally { if (fileRef.current) fileRef.current.value = ''; }
  };
  const delStore = async (s) => { await api(`/stores/${s._id}`, { method: 'DELETE' }); setStores((x) => x.filter((y) => y._id !== s._id)); toast(`${s.name} removed`, { icon: 'delete-bin-line', tone: 'info' }); };
  // ----- security
  const [pw, setPw] = useState({ current: '', next: '' });
  const [pwErr, setPwErr] = useState({});
  const changePw = async () => {
    try { await api('/auth/password', { method: 'PATCH', body: { currentPassword: pw.current, newPassword: pw.next } }); setPw({ current: '', next: '' }); setPwErr({}); toast('Password updated'); }
    catch (e) { setPwErr(fieldErrors(e)); }
  };
  const [delModal, setDelModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const deleteAccount = async () => { try { await api('/profile', { method: 'DELETE' }); logout(); setUser(null); nav('/'); } catch (e) { toast(e.message, { tone: 'bad' }); } };

  const anyDirty = bizDirty || fmtDirty || goalsDirty;
  useEffect(() => { const h = (e) => { if (anyDirty) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h); }, [anyDirty]);

  return (
    <div className="page">
      <Header back />
      <SystemBanners />
      <div className="row as wrapx stack-md" style={{ padding: '24px 28px', gap: 28 }}>
        <aside className="col g4" style={{ width: 260, position: 'sticky', top: 90 }}>
          <div className="card pad20 col ac g8" style={{ marginBottom: 12, textAlign: 'center' }}><div className="avatar" style={{ width: 64, height: 64, fontSize: 20 }}>{initials(user.name)}</div><span className="b s16">{user.name}</span><span className="s12 muted">{p.businessName} · {ROLE_LABEL[p.role]}</span><span className="tag ok">{p.completed ? 'Profile complete' : 'Onboarding incomplete'}</span></div>
          {NAV.map(([k, ic, t]) => <button key={k} className={`navitem ${section === k ? 'on' : ''}`} onClick={() => goto(k)}><Icon n={ic} s={18} />{t}</button>)}
          <button className="navitem" onClick={() => nav('/saved')}><Icon n="bookmark-line" s={18} />Saved locations</button>
        </aside>
        <div className="col g16 f1" style={{ minWidth: 0 }}>
          <div className="row sb wrap g8"><div className="col g4"><h1 className="h2">Profile</h1><span className="muted s14">Everything you entered at sign-up. Edits re-score your searches.</span></div>{lastSaved && <span className="toast"><Icon n="checkbox-circle-fill" s={18} c="var(--ok)" />Saved {lastSaved.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>}</div>
          <Sec refs={refs} id="personal"><Collapse open={section === 'personal'} title={<><Icon n="user-line" s={18} />Personal</>}>
            <div className="grid2"><Field label="Full name" value={biz.name} onChange={(v) => setBiz({ ...biz, name: v })} error={bizErr.name} /><Field label="Email" value={user.email} disabled help="Contact support to change your email" /></div>
            <Bar dirty={biz.name !== user.name} onSave={saveBiz} onDiscard={() => setBiz({ ...biz, name: user.name })} /></Collapse></Sec>
          <Sec refs={refs} id="business"><Collapse open={section === 'business' || section === ''} title={<><Icon n="building-2-line" s={18} />Business</>} right={!bizDirty && lastSaved ? <span className="tag ok"><Icon n="check-line" s={12} />Saved</span> : null}>
            <div className="grid3">
              <Field label="Business name" value={biz.businessName} onChange={(v) => setBiz({ ...biz, businessName: v })} error={bizErr['profile.businessName']} />
              <div className="field"><label>Category</label><button className="input" style={{ justifyContent: 'space-between' }} onClick={() => setCatModal(true)}><span className="row g8"><Icon n={cat?.icon} s={16} c="var(--accent)" />{cat?.name}</span><Icon n="shuffle-line" s={16} c="var(--muted)" /></button></div>
              <Field label="Role" value={biz.role} onChange={(v) => setBiz({ ...biz, role: v })} options={Object.entries(ROLE_LABEL).map(([value, label]) => ({ value, label }))} />
              <Field label="City" value="Pune & PCMC" disabled />
              <Field label="Focus areas" value={biz.focusAreas} onChange={(v) => setBiz({ ...biz, focusAreas: v })} help="Comma-separated localities; empty = whole city" error={bizErr['profile.focusAreas.0'] || bizErr['profile.focusAreas.1']} />
              <Field label="Grid" value={biz.grid} onChange={(v) => setBiz({ ...biz, grid: v })} options={[{ value: 'res8', label: 'Standard · H3 res 8' }, { value: 'res7', label: 'Coarse · H3 res 7' }]} />
            </div>
            <Bar dirty={bizDirty} onSave={saveBiz} onDiscard={() => setBiz({ name: user.name, businessName: p.businessName || '', role: p.role, focusAreas: (p.focusAreas || []).join(', '), grid: p.grid || 'res8' })} /></Collapse></Sec>
          <Sec refs={refs} id="stores"><Collapse open={section === 'stores'} title={<><Icon n="store-2-line" s={18} />My stores <span className="tag">{stores?.length ?? '…'}</span></>} right={<span className="hide-sm s12 muted">CSV: name, lat, lon, annual_revenue</span>}>
            <div className="row g8 wrap" style={{ marginBottom: 12 }}><label className="btn out sm"><Icon n="upload-cloud-2-line" s={14} />Replace all (CSV)<input ref={fileRef} type="file" accept=".csv" hidden onChange={(e) => upload(e.target.files[0], 'replace')} /></label>
              <label className="btn out sm"><Icon n="add-line" s={14} />Append from CSV<input type="file" accept=".csv" hidden onChange={(e) => upload(e.target.files[0], 'append')} /></label>
              {upRes && <span className="s12 muted">Last import: {upRes.valid} valid · {upRes.imputed} imputed · {upRes.excluded} excluded</span>}</div>
            {stores?.length === 0 && <Banner tone="info" icon="store-3-line">No stores loaded. Cannibalisation is skipped until you add stores.</Banner>}
            {stores?.length > 0 && <div style={{ overflowX: 'auto', maxHeight: 360 }}><table className="t"><thead><tr><th>Store</th><th>Category</th><th>Annual revenue</th><th /></tr></thead><tbody>
              {stores.map((s) => <tr key={s._id}><td className="b">{s.name}</td><td className="muted s12">{categories.find((c) => c.key === s.category)?.name}</td><td className="num">{inr(s.annualRevenue)}{s.revenueEstimated && <span className="tag warn" style={{ marginLeft: 6 }}>Estimated</span>}</td><td style={{ textAlign: 'right' }}><button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => delStore(s)} aria-label={`Delete ${s.name}`}><Icon n="delete-bin-line" s={15} /></button></td></tr>)}</tbody></table></div>}
          </Collapse></Sec>
          <Sec refs={refs} id="format"><Collapse open={section === 'format'} title={<><Icon n="equalizer-line" s={18} />Format &amp; economics</>} right={<span className="s12 muted hide-sm">{inrPlain(f.areaSqft)} sq ft · {Math.round((f.margin || 0) * 100)}% · {inr(f.opex)}</span>}>
            <div className="grid3"><Field label="Store area" sim value={fmt.areaSqft} onChange={(v) => setFmt({ ...fmt, areaSqft: v })} suffix="sq ft" error={fmtErr.areaSqft} /><Field label="Gross margin" sim value={fmt.margin} onChange={(v) => setFmt({ ...fmt, margin: v })} suffix="%" error={fmtErr.margin} /><Field label="Operating cost / year" sim value={fmt.opex} onChange={(v) => setFmt({ ...fmt, opex: v })} suffix="₹" error={fmtErr.opex} help={inr(parseNum(fmt.opex))} />
              <Field label="Capex" sim value={fmt.capex} onChange={(v) => setFmt({ ...fmt, capex: v })} suffix="₹" error={fmtErr.capex} help={inr(parseNum(fmt.capex))} /><Field label="Staff (FTE)" value={fmt.staff} onChange={(v) => setFmt({ ...fmt, staff: v })} suffix="people" /></div>
            {f.extras && Object.keys(f.extras).length > 0 && <div className="row g6 wrap" style={{ marginTop: 12 }}>{Object.entries(f.extras).map(([k, v]) => <span key={k} className="tag">{cat?.fields?.find((x) => x.key === k)?.label || k}: {String(v === true ? 'Yes' : v === false ? 'No' : v)}</span>)}</div>}
            <Bar dirty={fmtDirty} onSave={saveFmt} onDiscard={() => { setFmt(initFmt()); setFmtErr({}); }} note="Changing economics re-scores profit, tiers and break-even rent." /></Collapse></Sec>
          <Sec refs={refs} id="goals"><Collapse open={section === 'goals'} title={<><Icon n="focus-3-line" s={18} />Goals &amp; constraints {goalsDirty && <span className="tag warn">Editing · unsaved</span>}</>}>
            <div className="grid2"><Field label="Total budget" value={goals.budget} onChange={(v) => setGoals({ ...goals, budget: v })} suffix="₹" error={goalErr.budget || (goalsDirty && liveGoalErr.budget)} help={`${inr(parseNum(goals.budget))} · was ${inr(g.budget)}`} />
              <Field label="Maximum rent" value={goals.maxRent} onChange={(v) => setGoals({ ...goals, maxRent: v })} suffix="₹/sq ft/month" error={goalErr.maxRent || (goalsDirty && liveGoalErr.maxRent)} help={`Was ₹${g.maxRent ?? '—'}`} />
              <Field label="Minimum distance between picks" value={goals.minSpacingKm} onChange={(v) => setGoals({ ...goals, minSpacingKm: v })} suffix="km" error={goalErr.minSpacingKm || (goalsDirty && liveGoalErr.minSpacingKm)} />
              <Field label="Minimum downside profit" value={goals.minP10Profit} onChange={(v) => setGoals({ ...goals, minP10Profit: v })} suffix="₹/yr" error={goalErr.minP10Profit || (goalsDirty && liveGoalErr.minP10Profit)} />
              <Field label="Sites planned (k)" value={goals.k} onChange={(v) => setGoals({ ...goals, k: v })} error={goalErr.k || (goalsDirty && liveGoalErr.k)} />
              <Field label="Risk appetite" value={goals.risk} onChange={(v) => setGoals({ ...goals, risk: v })} options={[{ value: 'conservative', label: 'Conservative' }, { value: 'balanced', label: 'Balanced' }, { value: 'aggressive', label: 'Aggressive' }]} /></div>
            <div style={{ marginTop: 12 }}><Check on={goals.excludeLowConfidence} onClick={() => setGoals({ ...goals, excludeLowConfidence: !goals.excludeLowConfidence })} label="Exclude low-confidence and empty-market sites from default picks" /></div>
            <Bar dirty={goalsDirty} onSave={saveGoals} disabled={Object.keys(liveGoalErr).length > 0} onDiscard={() => { setGoals(initGoals()); setGoalErr({}); }} note="Changing constraints re-scores your saved searches and dashboard picks." /></Collapse></Sec>
          <div className="card pad20 row sb wrap g12"><div className="col g4"><b>Change business category</b><span className="s13 muted">Switching category resets format, drivers and constraints to that category’s defaults. Your stores stay.</span></div><button className="btn out" onClick={() => setCatModal(true)}><Icon n="shuffle-line" s={16} />Change category</button></div>
          <Sec refs={refs} id="security"><Collapse open={section === 'security'} title={<><Icon n="lock-line" s={18} />Security</>}>
            <div className="grid2"><Field label="Current password" type="password" value={pw.current} onChange={(v) => setPw({ ...pw, current: v })} error={pwErr.currentPassword} /><Field label="New password" type="password" value={pw.next} onChange={(v) => setPw({ ...pw, next: v })} error={pwErr.newPassword} help="8+ characters with a number" /></div>
            <button className="btn ink sm" style={{ marginTop: 12 }} disabled={!pw.current || !pw.next} onClick={changePw}>Update password</button></Collapse></Sec>
          <div className="card pad20 row sb wrap g12" style={{ borderColor: 'var(--bad)' }}><div className="col g4"><b className="badc">Delete account</b><span className="s13 muted">Removes your profile, uploads and saved locations. Recorded outcomes stay anonymised in calibration.</span></div><button className="btn out danger" onClick={() => setDelModal(true)}>Delete</button></div>
        </div>
      </div>
      <Footer />
      <Modal open={catModal} onClose={() => setCatModal(false)} title="Change business category">
        <div className="col g12"><Banner tone="warn" icon="error-warning-line">Format, drivers and constraints reset to the new category’s defaults. Your stores and saved locations stay.</Banner>
          <Field label="New category" value={newCat} onChange={setNewCat} options={categories.map((c) => ({ value: c.key, label: c.name }))} />
          <div className="row g8"><button className="btn ghost" onClick={() => setCatModal(false)}>Cancel</button><button className="btn ink" disabled={newCat === p.category} onClick={changeCat}>Change category</button></div></div>
      </Modal>
      <Modal open={delModal} onClose={() => setDelModal(false)} title="Delete your account?">
        <div className="col g12"><p className="s13 muted">This cannot be undone. Type <b style={{ color: 'var(--text)' }}>DELETE</b> to confirm.</p><Field value={confirmText} onChange={setConfirmText} placeholder="DELETE" />
          <div className="row g8"><button className="btn ghost" onClick={() => setDelModal(false)}>Cancel</button><button className="btn pri" disabled={confirmText !== 'DELETE'} onClick={deleteAccount}>Delete account</button></div></div>
      </Modal>
    </div>
  );
}
