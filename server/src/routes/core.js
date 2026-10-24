import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { cellToBoundary } from 'h3-js';
import { config } from '../config/index.js';
import { optionalAuth, requireAuth, validate } from '../middleware/index.js';
import { ml } from '../ml/adapter.js';
import { state, distKm } from '../ml/placeholder/state.js';
import { CategoryProfile, MlModel, Outcome, SearchLog, Poi, Store, Feedback } from '../models/index.js';
import { CITY, LOCALITIES } from '../data/city.js';
import { catByKey, GROUPS } from '../data/categories.js';
import { asyncH, bad, notFound, hash, insideCity, inr, round } from '../utils/index.js';
import { assumptionsFor, ownStores, resolveCategory, snap, latestVisit } from '../services/context.js';
import { buildEvidence, templateSummary, templateCompare, narrate } from '../llm/index.js';
import { generateGeminiSummary, generateGeminiChat } from '../llm/gemini.js';
import { getCache, setCache } from '../services/cache.js';

const r = Router();
r.use(optionalAuth);

const catSchema = z.string().refine((k) => !!catByKey[k], 'Unknown business category');
const shape = (s) => s && ({
  cell: s.cell, category: s.category, locality: s.locality, lat: s.lat, lon: s.lon, revenue: s.revenue, profit: s.profit, tier: s.tier,
  breakevenRent: s.breakevenRent, rent: s.rent, area: s.area, margin: s.margin, opex: s.opex, capex: s.capex, confidence: s.confidence, flags: s.flags,
  stress: s.stress, popChange: s.popChange, coverage: s.coverage, eligible: s.eligible, catchment: s.catchment, demandSupply: s.demandSupply, shap: s.shap,
  label: s.label, icon: s.icon, rule: s.rule, empty: s.empty, reason: s.reason, cannibalisation: s.cannibalisation, distKm: s.distKm,
});
const logSearch = (req, locality, category, q) => SearchLog.create({ user: req.user?._id, locality, category, q }).catch(() => {});

// ---------------- health / reference data
r.get('/health', asyncH(async (req, res) => {
  const db = mongoose.connection.readyState === 1 ? 'ok' : 'down';
  res.status(db === 'ok' ? 200 : 503).json({ api: 'ok', db, ml: ml.health(), modelVersion: config.modelVersion, llm: config.llmUrl ? 'configured' : 'template-only', time: new Date() });
}));

r.get('/categories', asyncH(async (req, res) => {
  const profiles = await CategoryProfile.find({}).sort({ order: 1 }).lean();
  res.json({ groups: GROUPS, categories: profiles });
}));

r.get('/city', (req, res) => res.json({ ...CITY, localities: LOCALITIES, cells: state.cells.length }));

r.get('/meta', asyncH(async (req, res) => {
  const [outcomes, feedback, models] = await Promise.all([Outcome.countDocuments(), Feedback.countDocuments(), MlModel.find({ version: config.modelVersion }).lean()]);
  res.json({
    modelVersion: config.modelVersion, mlMode: ml.health().mode, llm: config.llmUrl ? 'llm' : 'template',
    sources: [
      { name: 'OpenStreetMap', detail: 'POIs, roads, land use', licence: 'ODbL', kind: 'real', note: 'Seeded demo uses a simulated extract until the pipeline ingests OSM' },
      { name: 'WorldPop 100 m', detail: 'Population 2015 + 2020', licence: 'CC BY 4.0', kind: 'real', note: 'Seeded demo uses synthesised population' },
      { name: 'Store revenue, rent, margins', detail: 'Seeded simulator (variant A train, B shift test)', licence: '—', kind: 'simulated' },
      { name: 'Your uploads', detail: `${await Store.countDocuments({ chain: 'own', ...(req.user ? { owner: req.user._id } : {}) })} stores · ${outcomes} outcomes recorded`, licence: 'Yours', kind: 'yours' },
    ],
    limitations: [
      'Results demonstrate the method on a controlled benchmark; they are not evidence of real-world revenue accuracy.',
      'Distance is straight-line between cell centroids, not road network (isochrones are P2).',
      'Pollution is a land-use proxy, not measured air quality.',
      'Competitor size is assigned by brand class, not measured floor area.',
    ],
    calibration: models.map((m) => ({ category: m.category, scale: m.calibrationScale })), counts: { cells: state.cells.length, outcomes, feedback },
  });
}));

r.get('/eval', asyncH(async (req, res) => {
  const category = resolveCategory(req, req.query.category);
  const m = await MlModel.findOne({ version: config.modelVersion, category }).lean();
  const p = catByKey[category];
  res.json({
    category, model: m, targets: [
      { id: 'KPI-2', metric: 'Rank quality (Spearman ρ)', target: '≥ 0.60' }, { id: 'KPI-1', metric: 'Revenue accuracy (R²)', target: '≥ 0.50' },
      { id: 'KPI-5', metric: 'Interval coverage P10–P90', target: '80% ± 7 pp' }, { id: 'KPI-6', metric: 'Generator-shift drop', target: '≤ 0.10' },
      { id: 'KPI-3', metric: 'NDCG@20', target: '≥ 0.75' }, { id: 'KPI-4', metric: 'Top-20 hit rate', target: '≥ 60%' },
    ],
    assumptions: { areaSqft: p.areaSqft, capex: p.capex, opex: p.opex, margin: p.margin, rentRange: [Math.round(60 * p.rentFactor), Math.round(220 * p.rentFactor)], catchmentKm: p.catchmentKm },
    outcomes: await Outcome.countDocuments({ category }),
  });
}));

r.get('/localities', (req, res) => res.json({ localities: LOCALITIES }));

r.get('/search', asyncH(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ results: [] });
  const ll = q.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (ll) {
    const lat = +ll[1], lon = +ll[2];
    if (!insideCity(lat, lon)) return res.json({ results: [], error: 'Outside Pune & PCMC' });
    const c = snap(lat, lon);
    return res.json({ results: [{ type: 'point', name: `${c?.locality || 'Point'} (${lat.toFixed(4)}, ${lon.toFixed(4)})`, lat, lon, cell: c?._id }] });
  }
  if (/^8[0-9a-f]{14}$/i.test(q) && state.byId.has(q)) { const c = state.byId.get(q); return res.json({ results: [{ type: 'cell', name: `${c.locality} · ${q}`, lat: c.lat, lon: c.lon, cell: q }] }); }
  const results = LOCALITIES.filter((l) => l.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8).map((l) => ({ type: 'locality', name: l.name, lat: l.lat, lon: l.lon }));
  if (results[0]) logSearch(req, results[0].name, resolveCategory(req, req.query.category), q);
  res.json({ results });
}));

r.get('/trending', asyncH(async (req, res) => {
  const category = resolveCategory(req, req.query.category);
  const now = Date.now(), wk = 7 * 864e5;
  const agg = await SearchLog.aggregate([
    { $match: { createdAt: { $gte: new Date(now - 2 * wk) } } },
    { $group: { _id: '$locality', thisWeek: { $sum: { $cond: [{ $gte: ['$createdAt', new Date(now - wk)] }, { $cond: [{ $eq: ['$category', category] }, 2, 1] }, 0] } }, lastWeek: { $sum: { $cond: [{ $lt: ['$createdAt', new Date(now - wk)] }, 1, 0] } } } },
  ]);
  const { results } = await ml.scoreAll({ category, assumptions: assumptionsFor(req.user, category) });
  const best = new Map();
  for (const s of results) if (s.eligible.ok) { const b = best.get(s.locality); if (!b || s.profit.exp > b.profit.exp) best.set(s.locality, s); }
  const rows = agg.filter((a) => best.has(a._id)).map((a) => {
    const b = best.get(a._id);
    return { locality: a._id, searches: a.thisWeek, change: a.lastWeek ? (a.thisWeek - a.lastWeek) / a.lastWeek : 1, tier: b.tier, popChange: b.popChange, cell: b.cell, lat: b.lat, lon: b.lon };
  }).sort((x, y) => y.searches * (1 + y.popChange) - x.searches * (1 + x.popChange)).slice(0, 7);
  res.json({ category, trending: rows });
}));

// ---------------- hex layer (GeoJSON)
r.get('/cells', asyncH(async (req, res) => {
  const category = resolveCategory(req, req.query.category);
  const limit = Math.min(Number(req.query.limit) || 5000, 5000);
  const bbox = req.query.bbox ? String(req.query.bbox).split(',').map(Number) : null;
  if (bbox && (bbox.length !== 4 || bbox.some((v) => !Number.isFinite(v)))) throw bad('bbox must be minLon,minLat,maxLon,maxLat', 'bbox');
  const a = assumptionsFor(req.user, category);
  const key = `cells:${config.modelVersion}:${category}:${hash(a)}`;
  let fc = getCache(key);
  if (!fc) {
    const { results, source } = await ml.scoreAll({ category, assumptions: a });
    fc = {
      type: 'FeatureCollection', source, modelVersion: config.modelVersion, category,
      features: results.map((s) => ({
        type: 'Feature', id: s.cell,
        geometry: { type: 'Polygon', coordinates: [cellToBoundary(s.cell, true)] },
        properties: { id: s.cell, locality: s.locality, tier: s.tier, exp: Math.round(s.profit.exp), p10: Math.round(s.profit.p10), p50: Math.round(s.revenue.p50), rent: s.rent, eligible: s.eligible.ok, reasons: s.eligible.reasons, confidence: s.confidence, flags: s.flags, coverage: s.coverage },
      })),
    };
    setCache(key, fc);
  }
  let feats = fc.features;
  if (bbox) feats = feats.filter((f) => { const [lon, lat] = f.geometry.coordinates[0][0]; return lon >= bbox[0] && lon <= bbox[2] && lat >= bbox[1] && lat <= bbox[3]; });
  res.json({ ...fc, features: feats.slice(0, limit) });
}));

// ---------------- single site (location page)
async function siteFor(req, cellId, category, overrides = {}) {
  const cell = state.byId.get(cellId);
  if (!cell) throw notFound('This location is not part of the current scoring run. Rescore to see current values.');
  const visit = await latestVisit(cellId, category);
  const a = assumptionsFor(req.user, category, { ...(visit?.quotedRent ? { rent: visit.quotedRent } : {}), ...overrides });
  const { result, source } = await ml.score({ cell: cellId, category, assumptions: a });
  const { same } = await ownStores(req.user, category);
  let cann = null;
  if (same.length && result.eligible.ok) {
    const c = await ml.cannibalisation({ site: result, own: same, category });
    cann = { takenRs: c.takenRs, ratio: c.ratio, netNetworkProfit: c.netNetworkProfit, netNetworkRevenue: c.netNetworkRevenue, lostMargin: c.lostMargin, affected: c.affected };
    result.shap.Network = -c.lostMargin;
  }
  return { site: result, cann, source, visit };
}

r.get('/cells/:id', asyncH(async (req, res) => {
  const category = resolveCategory(req, req.query.category);
  const { site, cann, source, visit } = await siteFor(req, req.params.id, category);
  const neighbourhood = { landuse: state.byId.get(site.cell).landuse, features: state.byId.get(site.cell).features, simFlags: state.byId.get(site.cell).simFlags };
  const comps = (state.pois.get(category) || []).map((q) => ({ id: String(q._id), name: q.name, lat: q.lat, lon: q.lon, brandClass: q.brandClass, distKm: distKm(q.lat, q.lon, site.lat, site.lon) })).filter((q) => q.distKm <= site.catchment.km + 1).sort((x, y) => x.distKm - y.distKm).slice(0, 25);
  res.json({ site: { ...shape(site), cannibalisation: cann }, neighbourhood, competitors: comps, visit, source, modelVersion: config.modelVersion, scoredAt: new Date() });
}));

r.get('/cells/:id/similar', asyncH(async (req, res) => {
  const category = resolveCategory(req, req.query.category);
  const base = state.byId.get(req.params.id);
  if (!base) throw notFound('Location not found');
  const { results } = await ml.scoreAll({ category, assumptions: assumptionsFor(req.user, category) });
  const me = results.find((s) => s.cell === base._id);
  const filter = String(req.query.filter || 'all');
  let list = results.filter((s) => s.cell !== base._id && s.eligible.ok).map((s) => ({ ...s, distKm: distKm(s.lat, s.lon, base.lat, base.lon) })).filter((s) => s.distKm <= 8 && s.distKm >= 0.8);
  if (filter === 'tierA') list = list.filter((s) => s.tier === 'A');
  if (filter === 'nearby') list = list.filter((s) => s.distKm <= 3);
  if (filter === 'lowerRent') list = list.filter((s) => s.rent < me.rent);
  list.sort((x, y) => Math.abs(x.profit.exp - me.profit.exp) / 1e5 + x.distKm - (Math.abs(y.profit.exp - me.profit.exp) / 1e5 + y.distKm));
  const lim = Number(req.query.limit || 6); const seen = new Set(); const out = [];
  for (const s of list) { if (seen.has(s.locality)) continue; seen.add(s.locality); out.push(s); if (out.length >= lim) break; }
  for (const s of list) { if (out.length >= lim) break; if (!out.includes(s)) out.push(s); }
  res.json({ similar: out.map(shape) });
}));

// ---------------- recommend (J1)
const recSchema = z.object({
  category: catSchema,
  city: z.literal('pune', { errorMap: () => ({ message: 'Only Pune & PCMC is live' }) }).default('pune'),
  constraints: z.object({
    maxRent: z.number().min(10, 'Rent must be between ₹10 and ₹1,000 per sq ft per month').max(1000, 'Rent must be between ₹10 and ₹1,000 per sq ft per month').optional(),
    minSpacingKm: z.number().min(0.5, 'Spacing must be 0.5 – 10 km').max(10, 'Spacing must be 0.5 – 10 km').default(1.5),
    minP10Profit: z.number().min(0, 'Must be 0 or more').optional(),
    budget: z.number().positive('Budget must be more than 0').optional(),
  }).default({}),
  assumptions: z.object({ margin: z.number().min(0.01).max(0.8).optional(), opex: z.number().positive().optional(), areaSqft: z.number().min(200).max(500000).optional() }).default({}),
  focusAreas: z.array(z.string()).max(40).default([]),
  excludeLow: z.boolean().default(true),
  locality: z.string().optional(),
  grid: z.enum(['res8', 'res7']).optional(),
});

r.post('/recommend', validate(recSchema), asyncH(async (req, res) => {
  const b = req.body;
  const p = catByKey[b.category];
  const a = assumptionsFor(req.user, b.category, b.assumptions);
  const capex = a.capex ?? p.capex;
  if (b.constraints.budget && b.constraints.budget < capex) throw bad(`Budget ${inr(b.constraints.budget)} is below the capex of one store (${inr(capex)})`, 'constraints.budget');
  if (a.areaSqft && a.areaSqft > Math.max(20000, p.areaSqft * 2)) throw bad(`Area must be 200 – ${Math.max(20000, p.areaSqft * 2).toLocaleString('en-IN')} sq ft`, 'assumptions.areaSqft');
  const { same } = await ownStores(req.user, b.category);
  const focus = b.locality ? [b.locality] : b.focusAreas;
  const key = `rec:${config.modelVersion}:${b.category}:${hash({ b, a, focus, own: same.map((s) => s.id + s.revenue), u: String(req.user?._id || '') })}:${req.user?._id || ''}`;
  const hit = getCache(key);
  if (hit) return res.json({ ...hit, cached: true });
  const grid = b.grid || req.user?.profile?.grid || 'res8';
  const out = await ml.recommend({ category: b.category, constraints: b.constraints, assumptions: a, focusAreas: focus, excludeLow: b.excludeLow, own: same, grid });
  const body = {
    ...out,
    picks: out.picks.map(shape),
    allLocations: (out.allLocations || []).map(shape),
    ownStores: same.length,
    modelVersion: config.modelVersion,
    cached: false,
  };
  setCache(key, body);
  if (b.locality) logSearch(req, b.locality, b.category, b.locality);
  res.json(body);
}));

// ---------------- check a location (J2)
const checkSchema = z.object({
  category: catSchema,
  lat: z.number({ required_error: 'Latitude is required', invalid_type_error: 'Latitude must be a number' }),
  lon: z.number({ required_error: 'Longitude is required', invalid_type_error: 'Longitude must be a number' }),
  rent: z.number({ invalid_type_error: 'Rent must be a number' }).min(10, 'Allowed range ₹10 – ₹1,000. Did you enter monthly total rent?').max(1000, 'Allowed range ₹10 – ₹1,000. Did you enter monthly total rent?').optional(),
  area: z.number({ invalid_type_error: 'Area must be a number' }).min(200, 'Allowed 200 – 20,000 sq ft').max(20000, 'Allowed 200 – 20,000 sq ft').optional(),
});
r.post('/check', validate(checkSchema), asyncH(async (req, res) => {
  const { category, lat, lon, rent, area } = req.body;
  if (!insideCity(lat, lon)) throw bad('Pin is outside Pune & PCMC. Move it inside the highlighted city boundary.', 'lat', 'OUTSIDE_CITY');
  const cell = snap(lat, lon);
  if (!cell) throw bad('Pin is outside the scored grid', 'lat', 'OUTSIDE_CITY');
  const a = assumptionsFor(req.user, category, { ...(rent ? { rent } : {}), ...(area ? { areaSqft: area } : {}) });
  logSearch(req, cell.locality, category, `${lat},${lon}`);
  const el = cell.eligible?.[category] || { ok: true, reasons: [] };
  const insufficient = cell.coverage < 0.3;
  if (!el.ok) {
    const { alternatives } = await ml.nearestSuitable({ cell: cell._id, category, assumptions: a });
    return res.json({ eligible: false, cell: cell._id, locality: cell.locality, reasons: el.reasons.map((code) => ({ code, message: reasonText(code, cell, category) })), alternatives: alternatives.map(shape) });
  }
  const { site, cann } = await siteFor(req, cell._id, category, a);
  res.json({ eligible: true, cell: cell._id, locality: cell.locality, insufficient, site: { ...shape(site), cannibalisation: cann } });
}));

export function reasonText(code, cell, category) {
  const L = cell.landuse, F = cell.features, p = catByKey[category];
  const m = code.match(/_(\d+)/); const v = m ? Number(m[1]) : null;
  if (code.startsWith('IND_SHARE_GT')) return `Industrial land is ${Math.round(L.ind * 100)}% within 500 m (limit ${v}%)`;
  if (code.startsWith('COM_SHARE_LT')) return `Commercial land is ${Math.round(L.com * 100)}% (minimum ${v}%)`;
  if (code.startsWith('RES_SHARE_LT')) return `Residential land is ${Math.round(L.res * 100)}% (minimum ${v}%)`;
  if (code.startsWith('RES_SHARE_GT')) return `Residential land is ${Math.round(L.res * 100)}% (maximum ${v}%)`;
  if (code.startsWith('ROAD_GT')) return `Nearest suitable road is ${F.roadDistM} m away (limit ${v} m)`;
  if (code === 'HH_BELOW_MIN') return `Too few households nearby (minimum ${p.householdsMin.toLocaleString('en-IN')} for ${p.name.toLowerCase()})`;
  if (code.startsWith('NO_')) return `No ${code.split('_')[1].toLowerCase()} nearby and households below the minimum`;
  if (code === 'MASK_LOW_BUILTUP') return 'Less than 30% of the cell is built-up (buildable mask)';
  if (code === 'MASK_WATER_GREEN_GT_50') return 'More than 50% water, forest or park (buildable mask)';
  if (code === 'MASK_ROAD_GT_300M') return `No tertiary or larger road within 300 m (${F.roadDistM} m)`;
  return code;
}

// ---------------- explain / compare
r.post('/explain', validate(z.object({ cellId: z.string(), category: catSchema, compareWith: z.array(z.string()).max(2).default([]) })), asyncH(async (req, res) => {
  const { cellId, category, compareWith } = req.body;
  const { site, cann } = await siteFor(req, cellId, category);
  const evd = buildEvidence(site, cann);
  const name = site.locality;
  const tpl = templateSummary(evd, name);
  const n = await generateGeminiSummary(site, cann, tpl);
  const comparisons = [];
  for (const other of compareWith) {
    const o = await siteFor(req, other, category);
    const oe = buildEvidence(o.site, o.cann);
    const t = templateCompare(evd, oe, name, o.site.locality);
    comparisons.push({ cell: other, ...(await narrate('compare', [evd, oe], { text: t.text, claims: [{ text: t.text, evidence: t.evidence }] })) });
  }
  res.json({ evidence: evd, narrative: n.narrative, claims: n.claims, narrative_source: n.narrative_source, shap: site.shap, risks: risksOf(site, cann), comparisons, modelVersion: config.modelVersion });
}));

function risksOf(s, cann) {
  const out = [];
  if (!s.stress.competitor500m.pass || s.stress.competitor500m.tier !== s.tier) out.push({ code: 'COMPETITOR_ENTRY', text: `A dominant competitor within 500 m drops it to Tier ${s.stress.competitor500m.tier} (${inr(s.stress.competitor500m.exp)})` });
  if (s.rent > s.breakevenRent * 0.85) out.push({ code: 'RENT_NEAR_BREAKEVEN', text: `Rent ₹${Math.round(s.rent)} is close to break-even ₹${Math.round(s.breakevenRent)}` });
  for (const f of s.flags) out.push({ code: f, text: { EMPTY_MARKET: 'No competitors but households are below the category minimum', LOW_COVERAGE: 'Map data coverage is low here; ranges are wider', EXTRAPOLATION: 'Outside the range of training stores; treat with caution', HEAVY_CANNIBALISATION: 'Takes more from your stores than it adds' }[f] || f });
  if (cann && cann.ratio > 0.1) out.push({ code: 'CANNIBALISATION', text: `${Math.round(cann.ratio * 100)}% of its revenue would come from your own stores` });
  if (s.catchment.nearestCompetitorKm < 0.5) out.push({ code: 'COMPETITOR_NEAR', text: `Competitor ${round(s.catchment.nearestCompetitorKm, 1)} km away` });
  return out;
}

r.post('/compare', validate(z.object({ cells: z.array(z.string()).min(2, 'Pick at least 2 sites to compare').max(3, 'You can compare up to 3 sites'), category: catSchema })), asyncH(async (req, res) => {
  const { cells, category } = req.body;
  if (new Set(cells).size !== cells.length) throw bad('The same site was added twice', 'cells');
  const sites = []; const evs = [];
  for (const c of cells) { const s = await siteFor(req, c, category); sites.push({ ...shape(s.site), cannibalisation: s.cann }); evs.push(buildEvidence(s.site, s.cann)); }
  const order = sites.map((s, i) => i).sort((a, b) => sites[b].profit.exp - sites[a].profit.exp);
  const t = templateCompare(evs[order[0]], evs[order[1]], sites[order[0]].locality, sites[order[1]].locality);
  const n = await narrate('compare', evs, { text: t.text, claims: [{ text: t.text, evidence: t.evidence }] });
  res.json({ sites, narrative: n.narrative, narrative_source: n.narrative_source, evidence: evs, title: `Why ${sites[order[0]].locality} ranks above ${sites[order[1]].locality}` });
}));

// ---------------- cannibalisation (own-store availability states)
r.post('/cannibalisation', requireAuth, validate(z.object({
  cellId: z.string(),
  category: catSchema.optional(),
  withPicks: z.boolean().default(false),
  pickCells: z.array(z.string()).max(5).optional(),
  pickLabels: z.array(z.string().max(40)).max(5).optional(),
  crossCategory: z.boolean().default(false),
})), asyncH(async (req, res) => {
  const category = resolveCategory(req, req.body.category);
  const cell = state.byId.get(req.body.cellId);
  if (!cell) throw notFound('Location not found');
  const { all, same, mappedAll } = await ownStores(req.user, category);
  const base = {
    category,
    cell: cell._id,
    locality: cell.locality,
    ownStoresTotal: all.length,
    ownStoresCategory: same.length,
    estimatedCount: same.filter((s) => s.estimated).length,
  };
  if (!all.length) return res.json({ ...base, status: 'no_stores' });
  if (!same.length && !req.body.crossCategory) {
    return res.json({
      ...base,
      status: 'different_category',
      otherCategories: [...new Set(all.map((s) => s.category))].map((k) => catByKey[k]?.name || k),
      otherCategoryKeys: [...new Set(all.map((s) => s.category))],
    });
  }
  const storesToUse = same.length ? same : mappedAll;
  const isCross = same.length === 0 && all.length > 0;
  base.ownStoresCategory = storesToUse.length;
  base.estimatedCount = storesToUse.filter((s) => s.estimated).length;
  base.crossCategoryNotice = isCross;

  const el = cell.eligible?.[category];
  if (el && !el.ok) {
    const { alternatives } = await ml.nearestSuitable({ cell: cell._id, category, assumptions: assumptionsFor(req.user, category) });
    return res.json({ ...base, status: 'ineligible', reasons: el.reasons.map((code) => ({ code, message: reasonText(code, cell, category) })), alternatives: alternatives.map(shape) });
  }
  const { site } = await siteFor(req, cell._id, category);
  const c = await ml.cannibalisation({ site, own: storesToUse, category });
  const maxLoss = Math.max(0, ...c.stores.map((s) => s.lossPct));
  const status = c.takenRs < 1000 ? 'no_overlap' : c.netNetworkProfit < 0 || maxLoss > 0.2 ? 'heavy' : 'ok';
  let picks = null;
  if (req.body.withPicks && req.body.pickCells?.length) {
    picks = [];
    const labels = ['Best overall', 'Lowest risk', 'Lowest investment', 'Growth', 'Under-served'];
    for (const [i, pc] of req.body.pickCells.entries()) {
      if (!state.byId.has(pc)) continue;
      const s = await siteFor(req, pc, category);
      const takenRs = s.cann?.takenRs || 0;
      picks.push({ label: req.body.pickLabels?.[i] || labels[i] || 'Pick', cell: pc, locality: s.site.locality, profitExp: s.site.profit.exp, takenRs, lostMargin: takenRs * s.site.margin, netNetworkProfit: s.cann?.netNetworkProfit ?? s.site.profit.exp });
    }
  } else if (req.body.withPicks) {
    const g = req.user.profile.goals || {};
    const rec = await ml.recommend({ category, constraints: { maxRent: g.maxRent, minSpacingKm: g.minSpacingKm || 1.5, minP10Profit: g.minP10Profit }, assumptions: assumptionsFor(req.user, category), focusAreas: req.user.profile.focusAreas || [], excludeLow: g.excludeLowConfidence !== false, own: storesToUse });
    picks = rec.picks.filter((p) => !p.empty).map((p) => ({ label: p.label, cell: p.cell, locality: p.locality, profitExp: p.profit.exp, takenRs: p.cannibalisation?.takenRs || 0, lostMargin: (p.cannibalisation?.takenRs || 0) * p.margin, netNetworkProfit: p.cannibalisation?.netNetworkProfit ?? p.profit.exp }));
  }
  const nearest = [...c.stores].sort((a, b) => a.distKm - b.distKm)[0];
  res.json({ ...base, status, site: shape(site), result: { ...c, stores: c.stores.map((s) => ({ id: s.id, name: s.name, lat: s.lat, lon: s.lon, revenue: s.revenue, estimated: s.estimated, distKm: s.distKm, lossPct: s.lossPct, lossRs: s.lossRs })) }, nearestStore: nearest ? { name: nearest.name, distKm: nearest.distKm } : null, picks });
}));

// ---------------- portfolio planner (P1)
r.post('/portfolio', validate(z.object({ category: catSchema.optional(), k: z.number().int().min(1).max(20).default(5), spacingKm: z.number().min(0.5).max(10).default(1.5), budget: z.number().positive('Budget must be more than 0').optional() })), asyncH(async (req, res) => {
  const category = resolveCategory(req, req.body.category);
  const a = assumptionsFor(req.user, category);
  const capex = a.capex ?? catByKey[category].capex;
  if (req.body.budget && req.body.budget < capex) throw bad(`Budget ${inr(req.body.budget)} is below the capex of one store (${inr(capex)})`, 'budget');
  const { same } = await ownStores(req.user, category);
  const out = await ml.portfolio({ category, k: req.body.k, spacingKm: req.body.spacingKm, budget: req.body.budget, assumptions: a, own: same });
  res.json({ ...out, selected: out.selected.map((s) => ({ ...shape(s), marginalGain: s.marginalGain, takenFromNetwork: s.takenFromNetwork, lostMargin: s.lostMargin })), ownStores: same.length });
}));

// ---------------- shops around a point (competitors, anchors, your stores)
r.get('/shops', asyncH(async (req, res) => {
  const lat = Number(req.query.lat), lon = Number(req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw bad('lat and lon are required', 'lat');
  const radius = Math.min(Number(req.query.radiusKm) || 2, 10);
  const category = resolveCategory(req, req.query.category);
  const tag = req.query.tag && req.query.tag !== 'all' ? String(req.query.tag) : null;
  const out = [];
  if (tag !== null && tag !== 'own') {
    for (const q of state.pois.get(tag) || []) { const d = distKm(lat, lon, q.lat, q.lon); if (d <= radius) out.push({ id: String(q._id), name: q.name, category: q.category, relation: q.category === category ? 'Competitor' : 'Anchor', distKm: d, lat: q.lat, lon: q.lon, cell: q.h3 }); }
  } else if (tag === null) {
    for (const [k, arr] of state.pois) for (const q of arr) { const d = distKm(lat, lon, q.lat, q.lon); if (d <= radius) out.push({ id: String(q._id), name: q.name, category: k, relation: k === category ? 'Competitor' : 'Anchor', distKm: d, lat: q.lat, lon: q.lon, cell: q.h3 }); }
  }
  if (req.user && (tag === null || tag === 'own')) {
    const own = await Store.find({ owner: req.user._id, chain: 'own' }).lean();
    for (const s of own) { const d = distKm(lat, lon, s.loc.coordinates[1], s.loc.coordinates[0]); if (d <= radius) out.push({ id: String(s._id), name: s.name, category: s.category, relation: 'Your store', distKm: d, lat: s.loc.coordinates[1], lon: s.loc.coordinates[0], cell: s.h3 }); }
  }
  out.sort((a, b) => a.distKm - b.distKm);
  const counts = {};
  for (const [k, arr] of state.pois) counts[k] = arr.filter((q) => distKm(lat, lon, q.lat, q.lon) <= radius).length;
  res.json({ shops: out.slice(0, Number(req.query.limit) || 24), total: out.length, counts });
}));

// ---------------- chatbot (powered by Gemini API, fallback to deterministic metrics)
r.post('/chat', validate(z.object({ message: z.string().trim().min(1, 'Type a question').max(500), category: catSchema.optional(), cellId: z.string().optional(), picks: z.array(z.string()).max(5).optional() })), asyncH(async (req, res) => {
  const category = resolveCategory(req, req.body.category);
  const rawMsg = req.body.message.trim();
  const msg = rawMsg.toLowerCase();
  const cells = [req.body.cellId, ...(req.body.picks || [])].filter((x) => x && state.byId.has(x));
  if (!cells.length) {
    const defaultSites = state.cells.slice(0, 3).map((c) => ({ site: c }));
    const geminiRes = await generateGeminiChat(rawMsg, category, defaultSites, 'Search a locality or open a location first, then ask me about it.');
    return res.json({ answer: geminiRes.answer, evidence: [], narrative_source: geminiRes.narrative_source });
  }
  const sites = [];
  for (const c of [...new Set(cells)]) { const s = await siteFor(req, c, category); sites.push({ ...s, evd: buildEvidence(s.site, s.cann) }); }
  const main = sites[0];
  const T = (e, k) => e.evd.items.find((i) => i.key === k);
  let answer, ev = [];
  if (/rent/.test(msg) && /(rise|up|increase|25)/.test(msg)) {
    const best = [...sites].sort((a, b) => b.site.stress.rentUp25.exp - a.site.stress.rentUp25.exp)[0];
    answer = `${best.site.locality} holds up best if rent rises 25%: expected profit moves from ${T(best, 'profit_exp').text} to ${inr(best.site.stress.rentUp25.exp)} (Tier ${best.site.stress.rentUp25.tier}).`;
    ev = [T(best, 'profit_exp').id, T(best, 'stress.rentUp25').id];
  } else if (/break.?even|stop making money|what rent/.test(msg)) {
    answer = `${main.site.locality} breaks even at ${T(main, 'breakeven_rent').text} per sq ft per month; the assumed rent is ${T(main, 'rent').text}.`;
    ev = [T(main, 'breakeven_rent').id, T(main, 'rent').id];
  } else if (/(take|cannibal|my store|own store|steal)/.test(msg)) {
    answer = main.cann ? `${main.site.locality} would take ${T(main, 'cann.taken').text} a year from ${T(main, 'cann.affected').text} of your stores. Net network profit is ${T(main, 'cann.net_profit').text}.` : 'You have no stores of this category loaded, so there is nothing to cannibalise. Add your stores from Profile to see network effects.';
    ev = main.cann ? [T(main, 'cann.taken').id, T(main, 'cann.net_profit').id] : [];
  } else if (/stress|break it|risk|safe/.test(msg)) {
    const fails = Object.entries(main.site.stress).filter(([k, v]) => k !== 'passes' && !v.pass).map(([, v]) => v.label);
    answer = `${main.site.locality} passes ${T(main, 'stress.passes').text} stress tests.${fails.length ? ` It fails: ${fails.join(', ')}.` : ''} Downside profit is ${T(main, 'profit_p10').text}.`;
    ev = [T(main, 'stress.passes').id, T(main, 'profit_p10').id];
  } else if (/(why|rank|first|best)/.test(msg)) {
    answer = templateSummary(main.evd, main.site.locality).text; ev = main.evd.items.slice(0, 4).map((i) => i.id);
  } else {
    answer = templateSummary(main.evd, main.site.locality).text; ev = main.evd.items.slice(0, 4).map((i) => i.id);
  }
  const geminiRes = await generateGeminiChat(rawMsg, category, sites, answer);
  res.json({ answer: geminiRes.answer, evidence: ev, narrative_source: geminiRes.narrative_source });
}));

export default r;
