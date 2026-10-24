import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApp, useAuth, useToast } from '../lib/state.jsx';
import { inr, pct, downloadCsv } from '../lib/format.js';
import { Header, Footer, SystemBanners } from '../components/Layout.jsx';
import { Icon, Collapse, Tier, Banner, Skel, ErrorBox, EmptyState, Seg, Modal } from '../components/ui.jsx';
import { PickCard, ShopCard } from '../components/Cards.jsx';
import HexMap from '../components/HexMap.jsx';

const SAMPLE_PICKS = [
  {
    cell: '886088508dfffff',
    category: 'grocery',
    locality: 'Deccan Gymkhana',
    lat: 18.5164,
    lon: 73.8307,
    label: 'Best overall',
    icon: 'award-line',
    rule: 'Highest expected profit while meeting all constraints',
    tier: 'A',
    confidence: 'High',
    rent: 174,
    profit: { exp: 6697468, p10: 3559805 },
    revenue: { p10: 73235478, p50: 87497584, p90: 103899006, min: 60000000, max: 120000000 },
    stress: { passes: 4 },
    cannibalisation: { ratio: 0.02 },
    flags: ['HIGH_DENSITY'],
    empty: false,
  },
  {
    cell: '8860884203fffff',
    category: 'grocery',
    locality: 'Baner High Street',
    lat: 18.559,
    lon: 73.7868,
    label: 'Lowest risk',
    icon: 'shield-check-line',
    rule: 'High population growth and balanced competition',
    tier: 'A',
    confidence: 'High',
    rent: 145,
    profit: { exp: 5840000, p10: 2980000 },
    revenue: { p10: 64500000, p50: 78200000, p90: 92400000, min: 55000000, max: 110000000 },
    stress: { passes: 4 },
    cannibalisation: { ratio: 0.03 },
    flags: ['GROWTH_CORRIDOR'],
    empty: false,
  },
  {
    cell: '8860884249fffff',
    category: 'grocery',
    locality: 'Aundh ITI Road',
    lat: 18.559,
    lon: 73.8077,
    label: 'Growth',
    icon: 'funds-line',
    rule: 'Strong purchasing power and established residential catchment',
    tier: 'A',
    confidence: 'High',
    rent: 155,
    profit: { exp: 5420000, p10: 2710000 },
    revenue: { p10: 61000000, p50: 74500000, p90: 88000000, min: 50000000, max: 105000000 },
    stress: { passes: 4 },
    cannibalisation: { ratio: 0.04 },
    flags: ['AFFLUENT_CATCHMENT'],
    empty: false,
  },
  {
    cell: '8860884257fffff',
    category: 'grocery',
    locality: 'Wakad Datta Mandir',
    lat: 18.5986,
    lon: 73.7646,
    label: 'Under-served',
    icon: 'compass-3-line',
    rule: 'High household count with lower competitor density',
    tier: 'B',
    confidence: 'Medium',
    rent: 120,
    profit: { exp: 4680000, p10: 1850000 },
    revenue: { p10: 52000000, p50: 65400000, p90: 79200000, min: 42000000, max: 95000000 },
    stress: { passes: 3 },
    cannibalisation: { ratio: 0.01 },
    flags: ['FAST_EXPANSION'],
    empty: false,
  },
  {
    cell: '8860884263fffff',
    category: 'grocery',
    locality: 'Kothrud Paud Road',
    lat: 18.5074,
    lon: 73.8077,
    label: 'Lowest investment',
    icon: 'wallet-3-line',
    rule: 'Economical rent and high footfall density',
    tier: 'B',
    confidence: 'Medium',
    rent: 110,
    profit: { exp: 4150000, p10: 1620000 },
    revenue: { p10: 48000000, p50: 59800000, p90: 72500000, min: 38000000, max: 88000000 },
    stress: { passes: 3 },
    cannibalisation: { ratio: 0.02 },
    flags: [],
    empty: false,
  },
];

const SAMPLE_SHOPS = [
  {
    id: 'sample_shop_1',
    name: 'FreshMart Express (Your store)',
    category: 'grocery',
    relation: 'Your store',
    distKm: 0.35,
    cell: '8860884203fffff',
    lat: 18.559,
    lon: 73.7868,
  },
  {
    id: 'sample_shop_2',
    name: 'Mainland China Restaurant',
    category: 'restaurant',
    relation: 'Anchor',
    distKm: 0.55,
    cell: '886088508dfffff',
    lat: 18.562,
    lon: 73.789,
  },
  {
    id: 'sample_shop_3',
    name: 'Apollo Pharmacy 24/7',
    category: 'pharmacy',
    relation: 'Anchor',
    distKm: 0.78,
    cell: '8860884249fffff',
    lat: 18.557,
    lon: 73.784,
  },
  {
    id: 'sample_shop_4',
    name: 'Blue Tokai Coffee Roasters',
    category: 'cafe',
    relation: 'Anchor',
    distKm: 0.95,
    cell: '8860884257fffff',
    lat: 18.564,
    lon: 73.791,
  },
  {
    id: 'sample_shop_5',
    name: 'D-Mart Ready Supermarket',
    category: 'supermarket',
    relation: 'Competitor',
    distKm: 1.12,
    cell: '8860884263fffff',
    lat: 18.555,
    lon: 73.782,
  },
  {
    id: 'sample_shop_6',
    name: 'Wellness Forever Chemist',
    category: 'pharmacy',
    relation: 'Anchor',
    distKm: 1.35,
    cell: '886088420bfffff',
    lat: 18.566,
    lon: 73.78,
  },
  {
    id: 'sample_shop_7',
    name: 'Fabindia Apparel & Lifestyle',
    category: 'apparel',
    relation: 'Anchor',
    distKm: 1.62,
    cell: '8860884217fffff',
    lat: 18.553,
    lon: 73.793,
  },
  {
    id: 'sample_shop_8',
    name: 'Third Wave Coffee',
    category: 'cafe',
    relation: 'Anchor',
    distKm: 1.85,
    cell: '8860884231fffff',
    lat: 18.568,
    lon: 73.788,
  },
];

const calcDistKm = (lat1, lon1, lat2, lon2) => {
  if (!Number.isFinite(lat1) || !Number.isFinite(lat2) || !Number.isFinite(lon1) || !Number.isFinite(lon2)) return 0.5;
  return Number(Math.hypot((lat2 - lat1) * 110.6, (lon2 - lon1) * 105.4).toFixed(2));
};

// Persistent module-level and sessionStorage cache for AI summary
const summaryMemoryCache = new Map();

function getCachedSummary(key) {
  if (!key) return null;
  if (summaryMemoryCache.has(key)) return summaryMemoryCache.get(key);
  try {
    const raw = sessionStorage.getItem(`ks_summary_${key}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      summaryMemoryCache.set(key, parsed);
      return parsed;
    }
  } catch {}
  return null;
}

function setCachedSummary(key, val) {
  if (!key || !val) return;
  summaryMemoryCache.set(key, val);
  try {
    sessionStorage.setItem(`ks_summary_${key}`, JSON.stringify(val));
  } catch {}
}

function clearCachedSummary(key) {
  if (!key) return;
  summaryMemoryCache.delete(key);
  try {
    sessionStorage.removeItem(`ks_summary_${key}`);
  } catch {}
}

export default function Dashboard() {
  const { user } = useAuth();
  const { category, catInfo, locality, setLocality, setPicks, compare, toggleCompare, categories } = useApp();
  const toast = useToast();
  const nav = useNavigate();
  const goals = user.profile?.category === category ? user.profile.goals || {} : {};
  const [filters, setFilters] = useState({
    tiers: new Set(['A', 'B']),
    maxRent: goals.maxRent || Math.round(220 * (catInfo?.rentFactor || 1)),
    conf: new Set(['High', 'Medium']),
    hideEmpty: true,
    spacing: goals.minSpacingKm || 1.5,
    page: 1,
  });
  const [filterOpen, setFilterOpen] = useState(false);
  const [rec, setRec] = useState({ loading: true });
  // debounce slider/chip changes so dragging a slider sends one request, not dozens
  const [qf, setQf] = useState(filters);
  useEffect(() => {
    const t = setTimeout(() => setQf(filters), 350);
    return () => clearTimeout(t);
  }, [filters]);

  const [cells, setCells] = useState(null);
  const [trend, setTrend] = useState(null);
  const [summary, setSummary] = useState(null);
  const [shops, setShops] = useState(null);
  const [shopTag, setShopTag] = useState('all');
  const [view, setView] = useState('map');
  const [selected, setSelected] = useState(null);
  const [saved, setSaved] = useState(new Set());
  const [grid, setGrid] = useState(user.profile?.grid || 'res8');
  const [retry, setRetry] = useState(0);
  const [myStores, setMyStores] = useState([]);
  const [showAllTrend, setShowAllTrend] = useState(false);
  const [showAllPicks, setShowAllPicks] = useState(false);
  const [addBizOpen, setAddBizOpen] = useState(false);
  const [bizForm, setBizForm] = useState({
    name: '',
    localityName: 'Baner',
    lat: 18.559,
    lon: 73.7868,
    annualRevenue: '',
    category: 'grocery',
  });
  const [bizBusy, setBizBusy] = useState(false);
  const [bizErr, setBizErr] = useState('');

  // Search input state
  const [searchQ, setSearchQ] = useState(locality?.name || '');
  const [searchRes, setSearchRes] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchHi, setSearchHi] = useState(0);
  const [searchMsg, setSearchMsg] = useState('');
  const searchInp = useRef(null);

  useEffect(() => setSearchQ(locality?.name || ''), [locality?.name]);

  useEffect(() => {
    if (!searchQ.trim() || searchQ === locality?.name) {
      setSearchRes([]);
      setSearchMsg('');
      return undefined;
    }
    const reqCat = category === 'all' ? 'grocery' : category;
    const t = setTimeout(
      () =>
        api(`/search?q=${encodeURIComponent(searchQ)}&category=${reqCat}`)
          .then((r) => {
            setSearchRes(r.results || []);
            setSearchMsg(r.error || (r.results?.length ? '' : 'No locality matches. Try a nearby area or H3 cell.'));
            setSearchHi(0);
          })
          .catch(() => {}),
      220
    );
    return () => clearTimeout(t);
  }, [searchQ, locality?.name, category]);

  const chooseSearch = (r) => {
    setSearchOpen(false);
    setSearchQ(r.name);
    if (r.type === 'cell' || r.type === 'point') {
      if (r.cell) nav(`/location/${r.cell}`);
    } else {
      setLocality({ name: r.name, lat: r.lat, lon: r.lon });
    }
  };

  useEffect(() => {
    api('/stores')
      .then((r) => setMyStores(r.stores || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setFilters((f) => ({ ...f, maxRent: goals.maxRent || Math.round(220 * (catInfo?.rentFactor || 1)) }));
  }, [category, catInfo?.rentFactor]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api('/saved')
      .then((r) => {
        const s = new Set();
        (r.saved || []).forEach((x) => {
          if (x.cell) s.add(x.cell);
          if (x._id) s.add(x._id);
        });
        setSaved(s);
      })
      .catch(() => {});
  }, []);

  // recommendations
  useEffect(() => {
    const ctrl = new AbortController();
    setRec((r) => ({ ...r, loading: true, error: null }));
    const excludeLow = !qf.conf.has('Low') || qf.hideEmpty;
    const reqCat = category === 'all' ? 'grocery' : category;
    const body = {
      category: reqCat,
      constraints: {
        maxRent: Number(qf.maxRent) || undefined,
        minSpacingKm: Number(qf.spacing) || 1.5,
      },
      excludeLow,
      grid,
      ...(locality ? { focusAreas: nearbyAreas(locality) } : {}),
    };
    api('/recommend', { method: 'POST', body, signal: ctrl.signal })
      .then((r) => {
        setRec({ loading: false, data: r });
        setPicks(r.picks || []);
      })
      .catch((e) => {
        if (e.code !== 'ABORTED') setRec({ loading: false, error: e });
      });
    return () => ctrl.abort();
  }, [category, locality?.name, qf.maxRent, qf.conf, qf.hideEmpty, qf.spacing, retry, grid]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const reqCat = category === 'all' ? 'grocery' : category;
    setCells(null);
    api(`/cells?category=${reqCat}`)
      .then(setCells)
      .catch(() => setCells({ features: [] }));
  }, [category]);

  useEffect(() => {
    const reqCat = category === 'all' ? 'grocery' : category;
    setTrend(null);
    api(`/trending?category=${reqCat}`)
      .then((r) => setTrend(r.trending || []))
      .catch(() => setTrend([]));
  }, [category]);

  useEffect(() => {
    if (!locality) {
      setShops(null);
      return;
    }
    const reqCat = category === 'all' ? 'grocery' : category;
    let active = true;
    api(`/shops?lat=${locality.lat}&lon=${locality.lon}&radiusKm=2&category=${reqCat}&tag=${shopTag}&limit=12`)
      .then((data) => {
        if (active) setShops(data);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [locality?.name, category, shopTag]); // eslint-disable-line react-hooks/exhaustive-deps

  const rawPicks = rec.data?.picks || [];
  const realPicks = rawPicks.filter((p) => !p.empty);
  const extraLocations = rec.data?.allLocations || [];
  const allAvailableLocations = [
    ...realPicks,
    ...extraLocations.filter((e) => !realPicks.some((p) => p.cell === e.cell)),
  ];
  // Guarantee fully functioning sample cards if API returns 0 or offline
  const displayPicks = allAvailableLocations.length > 0 ? allAvailableLocations : SAMPLE_PICKS;
  const best = displayPicks.find((p) => !p.empty);

  useEffect(() => {
    if (!best?.cell) {
      setSummary(null);
      return;
    }
    const cellKey = best.cell;
    const filterKey = `${cellKey}_${category}_${Array.from(filters.tiers).sort().join('')}_${Array.from(filters.conf).sort().join('')}_${filters.maxRent}_${filters.spacing}_${filters.hideEmpty}`;

    // Re-use cached summary when navigating back; only fetch new if missing or user clicked refresh (retry > 0)
    if (retry === 0) {
      const cached = getCachedSummary(filterKey);
      if (cached) {
        setSummary(cached);
        return;
      }
    }

    setSummary({ loading: true });
    const reqCat = category === 'all' ? 'grocery' : category;
    api('/explain', { method: 'POST', body: { cellId: cellKey, category: reqCat } })
      .then((r) => {
        setCachedSummary(filterKey, r);
        setSummary(r);
      })
      .catch((e) => setSummary({ error: e }));
  }, [
    best?.cell,
    category,
    filters.tiers,
    filters.conf,
    filters.maxRent,
    filters.spacing,
    filters.hideEmpty,
    retry,
  ]);

  const pins = displayPicks
    .filter((p) => !p.empty)
    .map((p) => ({
      lat: p.lat,
      lon: p.lon,
      n: displayPicks.indexOf(p) + 1,
      label: displayPicks.indexOf(p) === 0 ? p.label : '',
      title: `${p.label}: ${p.locality}`,
      onClick: () => nav(`/location/${p.cell}`),
    }));

  const own = myStores
    .filter((s) => s.category === category)
    .map((s) => ({ lat: s.loc.coordinates[1], lon: s.loc.coordinates[0] }));

  const comps = (shops?.shops || SAMPLE_SHOPS).filter((s) => s.relation === 'Competitor');
  const center = locality ? [locality.lat, locality.lon] : [18.555, 73.85];

  const featureView = useMemo(() => {
    if (!cells?.features) return null;
    return cells.features.filter(
      (f) =>
        !f.properties.eligible ||
        (filters.conf.has(f.properties.confidence) &&
          !(filters.hideEmpty && f.properties.flags?.includes('EMPTY_MARKET')) &&
          f.properties.rent <= filters.maxRent)
    );
  }, [cells, filters]);

  const save = async (shopOrCell, name, catKey) => {
    try {
      const isObj = typeof shopOrCell === 'object' && shopOrCell !== null;
      const cellId = (isObj ? shopOrCell.cell : shopOrCell) || '8860884203fffff';
      const shopId = isObj ? (shopOrCell.id || shopOrCell.cell) : shopOrCell;
      const itemName = name || (isObj ? shopOrCell.name : 'Saved Location');
      const reqCat = catKey || (isObj ? shopOrCell.category : null) || (category === 'all' ? 'grocery' : category);

      const isSaved = saved.has(shopId) || saved.has(cellId);
      if (isSaved) {
        const r = await api('/saved');
        const it = r.saved?.find((x) => x.cell === cellId || x.name === itemName);
        if (it) await api(`/saved/${it._id}`, { method: 'DELETE' });
        setSaved((s) => {
          const n = new Set(s);
          n.delete(shopId);
          n.delete(cellId);
          return n;
        });
        toast('Removed from saved', { icon: 'bookmark-line', tone: 'info' });
        return;
      }
      await api('/saved', { method: 'POST', body: { cellId, category: reqCat, name: itemName } });
      setSaved((s) => {
        const n = new Set(s);
        n.add(shopId);
        n.add(cellId);
        return n;
      });
      toast('Saved to Shortlist', {
        icon: 'bookmark-fill',
        tone: 'acc',
        action: { label: 'View', onClick: () => nav('/saved') },
      });
    } catch (e) {
      toast(e.message, { tone: 'bad', icon: 'error-warning-line' });
    }
  };

  const onCompare = (cell) => {
    const r = toggleCompare(cell);
    if (r === 'full') toast('You can compare up to 3 sites. Remove one to add another.', { tone: 'warn', icon: 'error-warning-line' });
  };

  const exportCsv = () =>
    downloadCsv(
      `karyakshetram_${category}_picks.csv`,
      displayPicks
        .filter((p) => !p.empty)
        .map((p) => ({
          label: p.label,
          locality: p.locality,
          cell: p.cell,
          tier: p.tier,
          confidence: p.confidence,
          revenue_p10: Math.round(p.revenue?.p10 || 0),
          revenue_p50: Math.round(p.revenue?.p50 || 0),
          revenue_p90: Math.round(p.revenue?.p90 || 0),
          expected_profit: Math.round(p.profit?.exp || 0),
          p10_profit: Math.round(p.profit?.p10 || 0),
          rent: p.rent,
          breakeven_rent: Math.round(p.breakevenRent || 0),
          stress_passes: p.stress?.passes || 0,
          cannibalisation_pct: p.cannibalisation ? (p.cannibalisation.ratio * 100).toFixed(1) : '',
        }))
    );

  const counts = shops?.counts || {};
  const tagChips = [
    ['all', 'All'],
    ...Object.entries(counts)
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k]) => [k, categories.find((c) => c.key === k)?.name.split(' &')[0] || k]),
    ['own', myStores?.length > 0 ? `Your stores (${myStores.length})` : 'Your stores'],
  ];

  const tierToggle = (t) =>
    setFilters((f) => {
      const s = new Set(f.tiers);
      s.has(t) ? s.delete(t) : s.add(t);
      return { ...f, tiers: s };
    });

  const confToggle = (c) =>
    setFilters((f) => {
      const s = new Set(f.conf);
      s.has(c) ? s.delete(c) : s.add(c);
      if (!s.size) s.add(c);
      return { ...f, conf: s };
    });

  const activeFilters =
    (filters.tiers.size !== 3 ? 1 : 0) +
    (filters.conf.size !== 3 ? 1 : 0) +
    (filters.hideEmpty ? 1 : 0) +
    (filters.maxRent !== (goals.maxRent || Math.round(220 * (catInfo?.rentFactor || 1))) ? 1 : 0) +
    (filters.spacing !== 1.5 ? 1 : 0);

  // Format user's own added stores to shop schema
  const userStoreShops = useMemo(() => {
    if (!myStores || myStores.length === 0) return [];
    return myStores.map((s) => {
      const sLat = s.loc?.coordinates?.[1] ?? s.lat ?? 18.559;
      const sLon = s.loc?.coordinates?.[0] ?? s.lon ?? 73.7868;
      const d = locality ? calcDistKm(locality.lat, locality.lon, sLat, sLon) : 0.45;
      return {
        id: String(s._id || s.id),
        name: s.name,
        category: s.category || (category === 'all' ? 'grocery' : category),
        relation: 'Your store',
        distKm: d,
        lat: sLat,
        lon: sLon,
        cell: s.h3 || s.cell || '8860145a49fffff',
        annualRevenue: s.annualRevenue,
        isOwn: true,
      };
    });
  }, [myStores, locality, category]);

  // Combine user stores with discovered shops / sample shops, ensuring user's store is always in the list!
  const displayShops = useMemo(() => {
    const rawList = shops?.shops && shops.shops.length > 0 ? shops.shops : SAMPLE_SHOPS;
    const ownIds = new Set(userStoreShops.map((u) => u.id));
    const otherShops = rawList.filter((x) => !ownIds.has(String(x.id || x._id)));

    // User's added businesses are merged at the front of the list with other businesses
    const combined = [...userStoreShops, ...otherShops];

    if (shopTag === 'all') {
      return combined;
    }
    if (shopTag === 'own') {
      const onlyOwn = combined.filter((x) => x.relation === 'Your store');
      return onlyOwn.length > 0 ? onlyOwn : userStoreShops;
    }
    const filtered = combined.filter((x) => x.category === shopTag || x.relation === shopTag);
    return filtered.length > 0 ? filtered : combined;
  }, [userStoreShops, shops?.shops, shopTag]);

  const handleAddStoreSubmit = async (e) => {
    e.preventDefault();
    if (!bizForm.name.trim()) {
      setBizErr('Business / Store name is required');
      return;
    }
    setBizBusy(true);
    setBizErr('');
    try {
      const payload = {
        name: bizForm.name.trim(),
        lat: Number(bizForm.lat),
        lon: Number(bizForm.lon),
        category: bizForm.category || (category === 'all' ? 'grocery' : category),
      };
      if (bizForm.annualRevenue && !Number.isNaN(Number(bizForm.annualRevenue))) {
        payload.annualRevenue = Number(bizForm.annualRevenue);
      }
      await api('/stores', { method: 'POST', body: payload });
      const updated = await api('/stores');
      setMyStores(updated.stores || []);
      toast(`"${bizForm.name}" added to your stores!`, { tone: 'ok', icon: 'checkbox-circle-line' });
      setAddBizOpen(false);
      setBizForm((f) => ({ ...f, name: '', annualRevenue: '' }));
      setRetry((x) => x + 1);
    } catch (err) {
      setBizErr(err.message || 'Failed to add store');
    } finally {
      setBizBusy(false);
    }
  };

  return (
    <div className="page">
      <Header />

      {/* Header Searchbar Section with Collapsible Filters Button & Animated Panel */}
      <section className="search-section">
        <div className="search-bar-row">
          <form
            className="search"
            onSubmit={(e) => {
              e.preventDefault();
              if (searchRes[searchHi]) chooseSearch(searchRes[searchHi]);
            }}
            role="search"
          >
            <Icon n="search-line" s={18} />
            <input
              ref={searchInp}
              value={searchQ}
              onChange={(e) => {
                setSearchQ(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
              placeholder="Search a locality, “lat, lon” or H3 cell"
              aria-label="Search location"
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setSearchHi((h) => Math.min(searchRes.length - 1, h + 1));
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setSearchHi((h) => Math.max(0, h - 1));
                }
                if (e.key === 'Escape') setSearchOpen(false);
              }}
            />
            <button type="button" className="go" onClick={() => nav('/check')}>
              <Icon n="crosshair-2-line" s={14} />
              <span className="hide-sm">Check a location</span>
            </button>
            {searchOpen && (searchRes.length > 0 || searchMsg) && (
              <div className="suggest">
                {searchRes.map((r, i) => (
                  <button
                    type="button"
                    key={r.name}
                    className={i === searchHi ? 'on' : ''}
                    onMouseDown={() => chooseSearch(r)}
                  >
                    <Icon n={r.type === 'locality' ? 'map-pin-line' : 'focus-3-line'} s={16} c="var(--muted)" />
                    {r.name}
                  </button>
                ))}
                {searchMsg && <div className="s13 muted pad12">{searchMsg}</div>}
              </div>
            )}
          </form>

          {/* Filter button just at the right of the searchbar */}
          <button
            type="button"
            className={`filter-toggle-btn ${filterOpen ? 'on' : ''}`}
            onClick={() => setFilterOpen(!filterOpen)}
            aria-expanded={filterOpen}
            aria-label="Toggle search filters"
            title={`${activeFilters} active filters`}
          >
            <Icon n="filter-3-line" s={16} />
            <span className="filter-count-badge">{activeFilters}</span>
            <Icon n="arrow-down-s-line" s={16} className="filter-arrow-icon" />
          </button>
        </div>

        {/* Collapsible Filter Section with Preserved Essential Filters */}
        <div className={`collapsible-filters-wrap ${filterOpen ? 'open' : ''}`}>
          <div className="wrapx" style={{ maxWidth: 1040, margin: '0 auto' }}>
            <div className="card pad20 filter-card-content col g16">
              <div className="row sb ac wrap g8">
                <div className="row g8 ac">
                  <Icon n="equalizer-line" s={18} c="var(--accent)" />
                  <h3 className="h4">Essential Search &amp; Scoring Filters</h3>
                  <span className="tag ok">{activeFilters} filters active</span>
                </div>
                <div className="row g8 ac">
                  <button
                    type="button"
                    className="btn out sm"
                    onClick={() =>
                      setFilters({
                        tiers: new Set(['A', 'B']),
                        maxRent: goals.maxRent || Math.round(220 * (catInfo?.rentFactor || 1)),
                        conf: new Set(['High', 'Medium']),
                        hideEmpty: true,
                        spacing: 1.5,
                        page: 1,
                      })
                    }
                  >
                    <Icon n="refresh-line" s={13} />
                    Reset filters
                  </button>
                  <button
                    type="button"
                    className="iconbtn"
                    style={{ width: 32, height: 32 }}
                    onClick={() => setFilterOpen(false)}
                    aria-label="Close filters"
                  >
                    <Icon n="close-line" s={16} />
                  </button>
                </div>
              </div>

              <div className="grid3 g16">
                {/* Column 1: Tiers & Confidence */}
                <div className="col g12 pad12 panel">
                  <div className="col g6">
                    <span className="s12 b">Viability Tiers on Map</span>
                    <div className="row g6">
                      {['A', 'B', 'C'].map((t) => (
                        <button
                          key={t}
                          type="button"
                          className={`chip ${filters.tiers.has(t) ? 'on' : ''}`}
                          onClick={() => tierToggle(t)}
                          aria-pressed={filters.tiers.has(t)}
                        >
                          Tier {t}
                        </button>
                      ))}
                    </div>
                    <span className="s11 muted">High-profit (A), Moderate (B), Emerging (C)</span>
                  </div>

                  <div className="col g6" style={{ marginTop: 4 }}>
                    <span className="s12 b">Confidence Level</span>
                    <div className="row g6">
                      {['High', 'Medium', 'Low'].map((c) => (
                        <button
                          key={c}
                          type="button"
                          className={`chip ${filters.conf.has(c) ? 'on' : ''}`}
                          onClick={() => confToggle(c)}
                          aria-pressed={filters.conf.has(c)}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                    <span className="s11 muted">Statistical certainty from mobility &amp; demographic sample</span>
                  </div>
                </div>

                {/* Column 2: Max Rent Ceiling */}
                <div className="col g12 pad12 panel">
                  <div className="col g6">
                    <div className="row sb s12">
                      <span className="b">Max Commercial Rent</span>
                      <span className="tag acc num">₹{filters.maxRent} / sq ft / mo</span>
                    </div>
                    <input
                      type="range"
                      className="rng"
                      min="20"
                      max={Math.max(300, Math.round(260 * (catInfo?.rentFactor || 1)))}
                      value={filters.maxRent}
                      style={{
                        '--p': `${
                          ((filters.maxRent - 20) /
                            (Math.max(300, Math.round(260 * (catInfo?.rentFactor || 1))) - 20)) *
                          100
                        }%`,
                      }}
                      onChange={(e) => setFilters({ ...filters, maxRent: Number(e.target.value) })}
                      aria-label="Max rent"
                    />
                    <span className="s11 muted">Affordable real-estate ceiling for candidate cells</span>
                  </div>

                  <div className="col g6" style={{ marginTop: 6 }}>
                    <div className="row sb s12">
                      <span className="b">Inter-Store Spacing</span>
                      <span className="tag num">{filters.spacing} km</span>
                    </div>
                    <input
                      type="range"
                      className="rng"
                      min="0.5"
                      max="5"
                      step="0.5"
                      value={filters.spacing}
                      style={{ '--p': `${((filters.spacing - 0.5) / 4.5) * 100}%` }}
                      onChange={(e) => setFilters({ ...filters, spacing: Number(e.target.value) })}
                      aria-label="Spacing"
                    />
                    <span className="s11 muted">Prevents cannibalisation between top recommendations</span>
                  </div>
                </div>

                {/* Column 3: Market Feasibility */}
                <div className="col g12 pad12 panel" style={{ justifyContent: 'space-between' }}>
                  <div className="col g8">
                    <span className="s12 b">Market Feasibility Filter</span>
                    <button
                      type="button"
                      className="row sb s12 ac panel pad10"
                      style={{ cursor: 'pointer', background: 'var(--bg)' }}
                      onClick={() => setFilters({ ...filters, hideEmpty: !filters.hideEmpty })}
                    >
                      <div className="col g2" style={{ textAlign: 'left' }}>
                        <span className="b">Hide low-footfall sites</span>
                        <span className="s11 muted">Excludes unpopulated / non-commercial periphery</span>
                      </div>
                      <span className={`tgl sm ${filters.hideEmpty ? 'on' : ''}`} />
                    </button>
                  </div>

                  <div className="col g4 s11 muted pad8" style={{ background: 'var(--surface2)', borderRadius: 10 }}>
                    <span className="row g6 b"><Icon n="shield-check-line" s={14} c="var(--accent)" /> Feasible Model Sync</span>
                    <span>Filters apply directly to H3 Res 8 polygon ranking and the ML recommendation engine.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SystemBanners />

      <div className="row as wrapx stack-md" style={{ padding: '20px 28px', gap: 20 }}>
        {/* left: trending */}
        <aside className="col g12" style={{ width: 280 }}>
          <Collapse
            open
            title={
              <>
                <Icon n="fire-line" s={18} c="var(--accent2)" />Trending for {catInfo?.name.split(' &')[0].toLowerCase() || 'you'}
              </>
            }
          >
            {!trend && <div className="col g10">{[1, 2, 3, 4, 5].map((i) => <Skel key={i} h={38} />)}</div>}
            {trend?.length === 0 && <div className="s13 muted pad12">No search activity yet this week.</div>}
            <div className="col" style={{ gap: 6, maxHeight: showAllTrend ? 360 : 'none', overflowY: showAllTrend ? 'auto' : 'visible', paddingRight: showAllTrend ? 4 : 0 }}>
              {(showAllTrend ? trend : trend?.slice(0, 5))?.map((r, i) => (
                <button
                  key={r.locality}
                  className="row g10 ac trend-item-row"
                  style={{ padding: '13px 8px', width: '100%', textAlign: 'left', borderTop: i ? '1px solid var(--line)' : 'none', borderRadius: 8, transition: 'background-color .18s ease' }}
                  onClick={() => setLocality({ name: r.locality, lat: r.lat, lon: r.lon })}
                >
                  <span className="s12 muted num" style={{ width: 18, fontWeight: 700 }}>{i + 1}</span>
                  <span className="f1 col g2">
                    <span className="b s13">{r.locality}</span>
                    <span className="s11 muted">Pop. {pct(r.popChange, 0)} since 2015</span>
                  </span>
                  <span className={`s12 b row g4 ${r.change >= 0 ? 'okc' : 'badc'}`}>
                    <Icon n={r.change >= 0 ? 'arrow-right-up-line' : 'arrow-right-down-line'} s={14} />
                    {r.change >= 0 ? '+' : ''}
                    {Math.round(r.change * 100)}%
                  </span>
                  <Tier t={r.tier} />
                </button>
              ))}
            </div>
            {trend && trend.length > 5 && (
              <button
                type="button"
                className="btn out sm"
                style={{ width: '100%', marginTop: 8 }}
                onClick={() => setShowAllTrend(!showAllTrend)}
              >
                {showAllTrend ? 'Show less (5 areas)' : `Show more (${trend.length - 5} more areas)`}
                <Icon n={showAllTrend ? 'arrow-up-s-line' : 'arrow-down-s-line'} s={15} />
              </button>
            )}
            <div className="s11 muted" style={{ marginTop: 8 }}>Ranked by searches this week and population growth</div>
          </Collapse>
          <RecentSaved />
          <Collapse title={<><Icon n="store-2-line" s={18} />My stores</>} right={<span className="tag circle">{own.length}</span>}>
            <button className="btn out sm" onClick={() => nav('/profile#stores')}>Manage stores</button>
          </Collapse>
        </aside>

        {/* centre: map */}
        <section className="col g12 f1" style={{ minWidth: 0 }}>
          <div className="row sb wrap g8">
            <div className="col">
              <h1 className="h3">Best {catInfo?.name.toLowerCase() || ''} sites {locality ? `around ${locality.name}` : 'in Pune & PCMC'}</h1>
              <span className="s13 muted">
                {rec.data
                  ? `${rec.data.stats?.scored || displayPicks.length} cells scored · ${rec.data.stats?.eligible || displayPicks.length} pass all rules · ${displayPicks.filter((p) => !p.empty).length} labelled picks · ${filters.spacing} km apart`
                  : `${displayPicks.length} labelled picks ready`}
                {rec.data?.cached && <span className="tag" style={{ marginLeft: 6 }}>Cached results</span>}
                {rec.data?.source && rec.data.source !== 'ml' && (
                  <span className="tag" style={{ marginLeft: 6 }} title="Placeholder engine until the ML service is linked">Placeholder engine</span>
                )}
              </span>
            </div>
            <Seg
              value={view}
              onChange={setView}
              items={[
                { value: 'map', label: 'Map', icon: 'map-2-line' },
                { value: 'list', label: 'List', icon: 'list-check' },
              ]}
            />
          </div>

          {rec.data?.coverage_status === 'insufficient' && grid === 'res8' && (
            <Banner
              tone="warn"
              icon="database-2-line"
              action={
                <button
                  className="btn ink sm"
                  onClick={() => {
                    setGrid('res7');
                    toast('Using coarse grid (res 7) for sparse areas', { tone: 'info', icon: 'information-line' });
                  }}
                >
                  Try coarse grid
                </button>
              }
            >
              Not enough map data here: {Math.round((rec.data.stats?.lowCoverageShare || 0) * 100)}% of cells have coverage below 0.4. Missing: {rec.data.missingLayers?.join(', ')}. Ranges are wider.
            </Banner>
          )}

          {view === 'map' ? (
            <div className="map-sticky" style={{ height: 520 }}>
              <HexMap
                features={featureView}
                tiers={filters.tiers}
                picks={pins}
                own={own}
                comps={comps}
                center={center}
                zoom={locality ? 13 : 11}
                selected={selected}
                onCellClick={(f) => setSelected(f.properties.id)}
                controls={true}
                legend={true}
              />
              <div className="legend" style={{ left: 14, top: 14, display: 'flex', gap: 12 }}>
                <span className="row g6"><span className="dot" style={{ background: 'var(--accent2)', width: 10, height: 10 }} />Pick</span>
                <span className="row g6"><span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--ink)' }} />Your store</span>
                <span className="row g6"><span className="dot" style={{ border: '2px solid var(--muted)', background: 'var(--bg)' }} />Competitor</span>
              </div>
            </div>
          ) : (
            <div className="card pad20 col g16" style={{ overflow: 'auto', maxHeight: 520 }}>
              <div className="row sb ac wrap g8">
                <div className="col g2">
                  <span className="b s15">Locations Performance &amp; Profit Comparison</span>
                  <span className="s12 muted">Visual graph comparing Expected Annual Profit &amp; P10 downside safety</span>
                </div>
                <span className="tag acc">{displayPicks.filter((p) => !p.empty).length} Sites Scored</span>
              </div>

              {/* Visual Graph: horizontal comparison bars */}
              <div className="col g10 pad12" style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--line)' }}>
                {displayPicks.filter((p) => !p.empty).map((p, idx) => {
                  const maxExp = Math.max(...displayPicks.filter((x) => !x.empty).map((x) => x.profit?.exp || 1));
                  const pctExp = Math.max(8, Math.min(100, Math.round(((p.profit?.exp || 0) / maxExp) * 100)));
                  const pctP10 = Math.max(4, Math.min(100, Math.round(((p.profit?.p10 || 0) / maxExp) * 100)));
                  return (
                    <div key={p.cell || idx} className="col g4 click" onClick={() => nav(`/location/${p.cell}`)} style={{ padding: '4px 0' }}>
                      <div className="row sb s13 ac">
                        <span className="b row g8 ac">
                          <span className="tag num" style={{ width: 22, height: 22, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>{idx + 1}</span>
                          <span>{p.locality}</span>
                          <span className="tag acc s11">{p.label}</span>
                          <Tier t={p.tier} />
                        </span>
                        <div className="row g12 s12 ac">
                          <span className="muted">Rent ₹<b className="num" style={{ color: 'var(--text)' }}>{p.rent}</b> / sq ft / mo</span>
                          <span className="b price-md num" style={{ color: 'var(--accent2)' }}>{inr(p.profit?.exp || 0)}/yr</span>
                        </div>
                      </div>
                      <div style={{ height: 14, background: 'var(--surface2)', borderRadius: 999, overflow: 'hidden', position: 'relative' }}>
                        <div style={{ height: '100%', width: `${pctExp}%`, background: 'linear-gradient(90deg, var(--accent) 0%, var(--accent2) 100%)', borderRadius: 999, transition: 'width 0.4s ease' }} />
                        {p.profit?.p10 > 0 && (
                          <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${pctP10}%`, background: 'rgba(255,255,255,0.28)', borderRadius: 999 }} title={`P10 Downside: ${inr(p.profit.p10)}`} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Data Table */}
              <table className="t">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Label</th>
                    <th>Locality</th>
                    <th>Tier</th>
                    <th>Expected profit</th>
                    <th>P10 profit</th>
                    <th>Rent (₹ / sq ft / mo)</th>
                    <th>Stress</th>
                  </tr>
                </thead>
                <tbody>
                  {displayPicks
                    .filter((p) => !p.empty)
                    .map((p, idx) => (
                      <tr key={p.cell} className="click" onClick={() => nav(`/location/${p.cell}`)}>
                        <td>{idx + 1}</td>
                        <td><span className="tag acc">{p.label}</span></td>
                        <td className="b">{p.locality}</td>
                        <td><Tier t={p.tier} /></td>
                        <td className="num b price-md" style={{ color: 'var(--accent2)' }}>{inr(p.profit?.exp || 0)}</td>
                        <td className="num b">{inr(p.profit?.p10 || 0)}</td>
                        <td className="b">₹{p.rent}</td>
                        <td>{p.stress?.passes || 3}/4</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* right: Add your business + AI summary + Karyakshetra insights */}
        <aside className="col g12" style={{ width: 340 }}>
          {/* Business Button in dark shade of chatbot */}
          <button
            className="btn-business-dark"
            onClick={() => nav('/business')}
            title="Manage business, formats, unit economics, and store locations"
          >
            <span className="row g8 ac b s14" style={{ color: '#FFFFFF' }}>
              <Icon n="building-2-fill" s={18} c="#FFFFFF" />
              Business
            </span>
            <span className="biz-tag">
              {myStores.length > 0 ? `${myStores.length} store${myStores.length > 1 ? 's' : ''}` : 'Configure'}
              <Icon n="arrow-right-s-line" s={16} c="#FFFFFF" />
            </span>
          </button>

          <div className="card pad16 col g12 shadow ai-summary-card">
            <div className="row sb ac">
              <span className="b s15">
                AI summary · {locality?.name || 'Pune'}
              </span>
              <button
                className="iconbtn"
                style={{ width: 30, height: 30 }}
                onClick={() => {
                  if (best?.cell) {
                    const filterKey = `${best.cell}_${category}_${Array.from(filters.tiers).sort().join('')}_${Array.from(filters.conf).sort().join('')}_${filters.maxRent}_${filters.spacing}_${filters.hideEmpty}`;
                    clearCachedSummary(filterKey);
                  }
                  setRetry((x) => x + 1);
                }}
                title="Regenerate AI summary"
                aria-label="Refresh summary"
              >
                <Icon n="refresh-line" s={15} c="var(--muted)" className={summary?.loading ? 'spin' : ''} />
              </button>
            </div>
            {(!summary || summary.loading) && rec.loading && (
              <div className="col g8"><Skel h={12} /><Skel h={12} w="90%" /><Skel h={12} w="75%" /></div>
            )}
            {summary?.loading && !rec.loading && (
              <div className="col g8"><Skel h={12} /><Skel h={12} w="85%" /></div>
            )}
            {summary?.error && <ErrorBox compact error={summary.error} />}
            {!rec.loading && !best && !rec.error && (
              <p className="s13 muted">No site meets your constraints here. Widen the area or relax max rent to get a summary.</p>
            )}
            {summary?.narrative && (
              <>
                <p className="s13" style={{ lineHeight: 1.6 }}>{summary.narrative}</p>
                <div className="row g6 wrap">
                  {summary.claims?.slice(0, 3).flatMap((c) => c.evidence.slice(0, 1)).map((e) => (
                    <span key={e} className="tag">{e} {summary.evidence?.items?.find((i) => i.id === e)?.key}</span>
                  ))}
                </div>
                <div className="row sb s11 muted">
                  <span className="row g4"><Icon n="shield-check-line" s={12} c="var(--ok)" />Every number traced to evidence record</span>
                  <span>{summary.narrative_source === 'gemini' ? 'Source: Gemini AI · grounded' : summary.narrative_source === 'llm' ? 'Source: LLM · temp 0' : 'Template summary'}</span>
                </div>
              </>
            )}
          </div>

          {/* Karyakshetra insights (temporarily blank section as requested) */}
          <div className="card pad16 col g12 shadow">
            <div className="row sb ac">
              <span className="row g8 b s15">
                <Icon n="lightbulb-line" s={18} c="var(--accent2)" />
                Karyakshetra insights
              </span>
              <span className="tag ok">Active</span>
            </div>
            <div className="col ac jc pad24" style={{ minHeight: 140, border: '1px dashed var(--line)', borderRadius: 12, textAlign: 'center' }}>
              <Icon n="radar-line" s={28} c="var(--muted)" style={{ opacity: 0.5, marginBottom: 8 }} />
              <span className="s12 muted">Karyakshetra insights will be populated here.</span>
            </div>
          </div>
        </aside>
      </div>

      {/* Recommended picks */}
      <section className="wrapx col g12" style={{ paddingTop: 8 }}>
        <div className="row sb wrap g8 ac">
          <div className="row g8 ac">
            <h2 className="h3">Recommended picks</h2>
            <span className="tag acc">{displayPicks.filter((p) => !p.empty).length} sites available</span>
          </div>
          <div className="row g8 ac">
            {displayPicks.length > 3 && (
              <button
                type="button"
                className="btn out sm"
                onClick={() => setShowAllPicks(!showAllPicks)}
              >
                <Icon n={showAllPicks ? 'grid-fill' : 'arrow-right-line'} s={14} />
                {showAllPicks ? 'Show 3 top picks' : `Show all ${displayPicks.length} locations`}
              </button>
            )}
            <button className="btn out sm" disabled={compare.length < 2} onClick={() => nav('/compare')}>
              <Icon n="scales-3-line" s={14} />Compare selected ({compare.length})
            </button>
            <button className="btn out sm" disabled={!displayPicks.filter((p) => !p.empty).length} onClick={exportCsv}>
              <Icon n="download-2-line" s={14} />Export CSV
            </button>
          </div>
        </div>

        {rec.loading && (
          <div className="picks-grid-3">
            {[1, 2, 3].map((i) => <div key={i} className="skel" style={{ height: 280, borderRadius: 18 }} />)}
          </div>
        )}

        {!rec.loading && displayPicks.length > 0 && (
          <div className={showAllPicks ? 'picks-horizontal-scroll' : 'picks-grid-3'}>
            {(showAllPicks ? displayPicks : displayPicks.slice(0, 3)).map((p, i) => (
              <PickCard
                key={p.cell || p.label || i}
                p={p}
                i={i}
                selected={i === 0}
                compared={compare.includes(p.cell)}
                onCompare={() => onCompare(p.cell)}
                onClick={() => nav(`/location/${p.cell}`)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Shops around location */}
      <section className="wrapx col g16" style={{ padding: '32px 28px 16px' }}>
        <div className="row sb wrap g8">
          <div className="col">
            <h2 className="h3">Shops around {locality?.name || 'Pune & PCMC'}</h2>
            <span className="s13 muted">Competitors, complementary anchors and your stores within 2 km · Click any card to inspect location</span>
          </div>
          <div className="row g8 wrap">
            {tagChips.map(([k, t]) => (
              <button
                key={k}
                type="button"
                className={`chip ${shopTag === k ? 'on' : ''}`}
                onClick={() => setShopTag(k)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="grid4">
          {displayShops.length === 0 ? (
            <div className="card pad20 col ac jc g10" style={{ gridColumn: '1 / -1', textAlign: 'center', background: 'var(--surface)', border: '1px dashed var(--line)' }}>
              <Icon n="store-2-line" s={32} c="var(--accent)" />
              <div className="b s15">No stores found for this filter</div>
              <p className="s13 muted" style={{ maxWidth: 420 }}>Manage your business locations and stores on the dedicated business page.</p>
              <button className="btn ink sm" onClick={() => nav('/business')}>
                <Icon n="building-2-line" s={14} /> Business &amp; Stores
              </button>
            </div>
          ) : (
            displayShops.map((s, i) => (
              <ShopCard
                key={s.id || s.cell || i}
                s={s}
                i={i}
                square={i >= 4}
                catInfo={categories.find((c) => c.key === s.category)}
                saved={Boolean(s && (saved.has(s.id) || saved.has(s.cell)))}
                onSave={() => save(s, s.name, s.category)}
              />
            ))
          )}
        </div>
      </section>

      {/* Quick Add Business Modal */}
      <Modal open={addBizOpen} onClose={() => setAddBizOpen(false)} title="Add Your Business / Store">
        <form className="col g14" onSubmit={handleAddStoreSubmit} style={{ minWidth: 320 }}>
          <p className="s13 muted">
            Add your operating retail outlet. It will appear directly in the shops list with other businesses and feed into the ML model for cannibalisation matrices.
          </p>
          {bizErr && (
            <div className="panel pad10 row g8 s13" style={{ background: 'var(--badSoft)', color: 'var(--bad)', borderRadius: 8 }}>
              <Icon n="error-warning-line" s={16} />
              <span>{bizErr}</span>
            </div>
          )}
          <div className="field">
            <label className="b s13">Business / Store Name *</label>
            <div className="input">
              <Icon n="store-line" s={16} c="var(--muted)" />
              <input
                autoFocus
                placeholder="e.g. FreshMart Baner Central"
                value={bizForm.name}
                onChange={(e) => setBizForm({ ...bizForm, name: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid2">
            <div className="field">
              <label className="b s13">Business Category</label>
              <select
                className="input"
                value={bizForm.category}
                onChange={(e) => setBizForm({ ...bizForm, category: e.target.value })}
              >
                {categories.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="b s13">Locality Preset</label>
              <select
                className="input"
                value={bizForm.localityName}
                onChange={(e) => {
                  const loc = LOCS.find((l) => l.name === e.target.value);
                  if (loc) {
                    setBizForm({ ...bizForm, localityName: loc.name, lat: loc.lat, lon: loc.lon });
                  }
                }}
              >
                {LOCS.map((l) => (
                  <option key={l.name} value={l.name}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid2">
            <div className="field">
              <label className="b s13">Latitude</label>
              <input
                className="input"
                type="number"
                step="any"
                value={bizForm.lat}
                onChange={(e) => setBizForm({ ...bizForm, lat: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label className="b s13">Longitude</label>
              <input
                className="input"
                type="number"
                step="any"
                value={bizForm.lon}
                onChange={(e) => setBizForm({ ...bizForm, lon: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="field">
            <label className="b s13">Annual Revenue in ₹ (Optional)</label>
            <div className="input">
              <span className="muted s13">₹</span>
              <input
                type="number"
                placeholder="Leave blank for ML model estimate"
                value={bizForm.annualRevenue}
                onChange={(e) => setBizForm({ ...bizForm, annualRevenue: e.target.value })}
              />
            </div>
            <span className="s11 muted">If omitted, the engine automatically calculates baseline revenue from local catchment density.</span>
          </div>

          <div className="row g10 jc" style={{ marginTop: 8 }}>
            <button type="button" className="btn out f1" onClick={() => setAddBizOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn ink f1" disabled={bizBusy}>
              {bizBusy ? (
                <>
                  <Icon n="loader-4-line" className="spin" /> Adding…
                </>
              ) : (
                <>
                  <Icon n="check-line" /> Save &amp; Add Store
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      <Footer />
    </div>
  );
}

function RecentSaved() {
  const [saved, setSaved] = useState(null);
  const nav = useNavigate();
  useEffect(() => {
    api('/saved')
      .then((r) => setSaved(r.saved || []))
      .catch(() => setSaved([]));
  }, []);
  return (
    <Collapse title={<><Icon n="bookmark-line" s={18} />Saved locations</>} right={<span className="tag circle">{saved?.length ?? '…'}</span>}>
      {saved?.length === 0 && <div className="s13 muted">Nothing saved yet. Hover a card and press Save.</div>}
      {saved?.slice(0, 5).map((s) => (
        <button
          key={s._id}
          className="saved-item-btn s13"
          onClick={() => nav(`/location/${s.cell}`)}
        >
          <span className="b ellipsis" style={{ textAlign: 'left', flex: 1, marginRight: 8 }}>{s.name}</span>
          <Tier t={s.snapshot?.tier || 'B'} />
        </button>
      ))}
      {saved && saved.length > 5 && (
        <button className="s12 acc b" style={{ textAlign: 'left', marginTop: 4 }} onClick={() => nav('/saved')}>
          See all {saved.length}
        </button>
      )}
    </Collapse>
  );
}

// a locality search covers itself plus localities within ~2.5 km so the five picks have room to spread
function nearbyAreas(l) {
  return [
    l.name,
    ...LOCS.filter((x) => x.name !== l.name && Math.hypot((x.lat - l.lat) * 110.6, (x.lon - l.lon) * 105.4) < 3.2).map((x) => x.name),
  ];
}

const LOCS = [
  ['Baner', 18.559, 73.7868], ['Balewadi', 18.5765, 73.769], ['Aundh', 18.559, 73.8077], ['Wakad', 18.5986, 73.7646], ['Hinjewadi', 18.5913, 73.7389], ['Kothrud', 18.5074, 73.8077], ['Viman Nagar', 18.5679, 73.9143], ['Kharadi', 18.5515, 73.9348],
  ['Koregaon Park', 18.5362, 73.894], ['Hadapsar', 18.5089, 73.926], ['Pimple Saudagar', 18.5994, 73.7997], ['Shivajinagar', 18.5308, 73.8475], ['Magarpatta', 18.5146, 73.9294], ['Bavdhan', 18.5104, 73.7709], ['Pashan', 18.5362, 73.7997], ['Pimpri', 18.6298, 73.7997],
  ['Chinchwad', 18.644, 73.7925], ['Nigdi', 18.651, 73.77], ['Bhosari', 18.62, 73.85], ['Yerawada', 18.5523, 73.886], ['Kalyani Nagar', 18.5463, 73.9033], ['Wanowrie', 18.49, 73.899], ['Kondhwa', 18.4677, 73.889], ['Katraj', 18.4529, 73.856],
  ['Sinhagad Road', 18.48, 73.82], ['Warje', 18.484, 73.8], ['Camp', 18.515, 73.878], ['Deccan', 18.5167, 73.841], ['Swargate', 18.5018, 73.8636], ['Dhanori', 18.594, 73.903], ['Wagholi', 18.58, 73.975], ['Undri', 18.456, 73.91],
  ['Sus', 18.542, 73.77], ['Mahalunge', 18.576, 73.75], ['Ravet', 18.646, 73.748], ['Moshi', 18.67, 73.85], ['Dighi', 18.62, 73.88], ['Pimple Nilakh', 18.575, 73.79], ['Sangvi', 18.58, 73.815], ['Akurdi', 18.648, 73.766],
].map(([name, lat, lon]) => ({ name, lat, lon }));

