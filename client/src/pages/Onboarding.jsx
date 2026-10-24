import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth, useApp, useToast } from '../lib/state.jsx';
import { Icon, ThemeToggle } from '../components/ui.jsx';

const CATEGORY_ITEMS = [
  { key: 'restaurant', name: 'Restaurant & Dining', icon: 'restaurant-2-line', desc: 'Fine dining, casual dining, family bistros' },
  { key: 'cafe', name: 'Cafe & Beverage', icon: 'cup-line', desc: 'Specialty coffee, beverage bars, patisserie' },
  { key: 'pharmacy', name: 'Pharmacy & Wellness', icon: 'capsule-line', desc: 'Retail chemists, wellness, supplements' },
  { key: 'grocery', name: 'Grocery & Supermarket', icon: 'shopping-basket-2-line', desc: 'Daily essentials, organic food, mart' },
  { key: 'qsr', name: 'QSR & Fast Food', icon: 'fire-line', desc: 'Quick service, burgers, wraps, cloud kitchens' },
  { key: 'apparel', name: 'Fashion & Apparel', icon: 't-shirt-2-line', desc: 'Clothing boutique, footwear, accessories' },
  { key: 'bakery', name: 'Bakery & Desserts', icon: 'cake-3-line', desc: 'Artisanal breads, cakes, sweet treats' },
  { key: 'gym', name: 'Fitness & Gym', icon: 'run-line', desc: 'Fitness centers, yoga, pilates studios' },
  { key: 'salon', name: 'Salon & Spa', icon: 'scissors-cut-line', desc: 'Hair salon, beauty spa, grooming lounge' },
  { key: 'electronics', name: 'Electronics & Mobile', icon: 'tv-2-line', desc: 'Gadgets, smartphones, appliance retail' },
  { key: 'jewellery', name: 'Jewellery & Luxury', icon: 'vip-diamond-line', desc: 'Gold, diamonds, watches & lifestyle' },
  { key: 'diagnostics', name: 'Diagnostics & Clinic', icon: 'microscope-line', desc: 'Pathology labs, dental clinics, scan centers' },
];

const CHALLENGE_ITEMS = [
  { id: 'rent', label: 'High commercial rent & aggressive lease lock-ins', icon: 'money-dollar-circle-line' },
  { id: 'footfall', label: 'Unpredictable footfall & misleading pedestrian counts', icon: 'walk-line' },
  { id: 'cannibalisation', label: 'Risk of cannibalising our own existing stores', icon: 'git-merge-line' },
  { id: 'competition', label: 'Heavy competitor saturation in commercial hubs', icon: 'store-3-line' },
  { id: 'demographics', label: 'Understanding true neighborhood affluence & spending power', icon: 'user-search-line' },
  { id: 'visibility', label: 'Finding prime street frontage & accessible parking', icon: 'eye-line' },
  { id: 'breakeven', label: 'Long capex payback periods & uncertain break-even', icon: 'scales-3-line' },
  { id: 'permits', label: 'Navigating local municipal zoning & trade regulations', icon: 'shield-keyhole-line' },
];

const PRELOADER_MESSAGES = [
  'Saving your business identity & venture profile…',
  'Calibrating 949 H3 hexagonal spatial cells for Pune & PCMC…',
  'Analyzing catchment demographics and household affluence…',
  'Mapping competitor density and anchor footfall…',
  'Configuring baseline revenue models for your category…',
  'Your retail intelligence dashboard is ready!',
];

export default function Onboarding() {
  const { step: stepParam } = useParams();
  const initStep = Math.min(4, Math.max(1, Number(stepParam) || 1));
  const [step, setStep] = useState(initStep);
  const [direction, setDirection] = useState('forward');
  const nav = useNavigate();
  const toast = useToast();
  const { user, saveProfile } = useAuth();
  const { setCategory } = useApp();

  const [form, setForm] = useState({
    name: user?.name || '',
    businessName: user?.profile?.businessName || '',
    businessActivity: user?.profile?.businessActivity || '',
    businessType: user?.profile?.businessType || '',
    categories: user?.profile?.categories?.length
      ? user.profile.categories
      : [user?.profile?.category || 'grocery'],
    challengesNote: user?.profile?.challengesNote || '',
    challenges: user?.profile?.challenges || [
      'High commercial rent & aggressive lease lock-ins',
      'Unpredictable footfall & misleading pedestrian counts',
    ],
  });

  const [err, setErr] = useState('');
  const [preloaderIdx, setPreloaderIdx] = useState(0);
  const [progress, setProgress] = useState(15);

  const toggleCategory = (key) => {
    setForm((f) => {
      const exists = f.categories.includes(key);
      const updated = exists ? f.categories.filter((c) => c !== key) : [...f.categories, key];
      return { ...f, categories: updated.length ? updated : [key] };
    });
  };

  const toggleChallenge = (label) => {
    setForm((f) => {
      const exists = f.challenges.includes(label);
      const updated = exists ? f.challenges.filter((c) => c !== label) : [...f.challenges, label];
      return { ...f, challenges: updated };
    });
  };

  const goNext = () => {
    setErr('');
    if (step === 1) {
      if (!form.name.trim()) {
        setErr('Please introduce yourself with your name');
        return;
      }
      if (!form.businessName.trim()) {
        setErr('Please enter the name of your company');
        return;
      }
      setDirection('forward');
      setStep(2);
    } else if (step === 2) {
      if (!form.businessActivity.trim()) {
        setErr('Please tell us what your business does');
        return;
      }
      if (!form.businessType.trim()) {
        setErr('Please specify the type / format of your business');
        return;
      }
      setDirection('forward');
      setStep(3);
    } else if (step === 3) {
      if (!form.categories.length) {
        setErr('Please select at least one business category');
        return;
      }
      setDirection('forward');
      setStep(4);
    } else if (step === 4) {
      // Transition to creative preloader!
      startPreloaderAndFinish();
    }
  };

  const goBack = () => {
    setErr('');
    if (step > 1) {
      setDirection('backward');
      setStep((s) => s - 1);
    }
  };

  const startPreloaderAndFinish = () => {
    setDirection('forward');
    setStep('preloader');

    // Trigger saveProfile in background
    const primaryCategory = form.categories[0] || 'grocery';
    setCategory(primaryCategory);

    saveProfile({
      name: form.name.trim(),
      profile: {
        businessName: form.businessName.trim(),
        businessActivity: form.businessActivity.trim(),
        businessType: form.businessType.trim(),
        categories: form.categories,
        category: primaryCategory,
        challengesNote: form.challengesNote.trim(),
        challenges: form.challenges,
        completed: true,
        onboardingStep: 5,
      },
    }).catch((e) => {
      console.warn('Profile save warning:', e);
    });
  };

  // Preloader interval animation
  useEffect(() => {
    if (step !== 'preloader') return undefined;

    const interval = setInterval(() => {
      setPreloaderIdx((i) => (i + 1) % PRELOADER_MESSAGES.length);
      setProgress((p) => Math.min(100, p + 18));
    }, 450);

    const redirectTimer = setTimeout(() => {
      toast('Welcome to Karyakshetram!', { tone: 'ok', icon: 'checkbox-circle-fill' });
      nav('/app', { replace: true });
    }, 2500);

    return () => {
      clearInterval(interval);
      clearTimeout(redirectTimer);
    };
  }, [step, nav, toast]);

  return (
    <div className="ob-page">
      {/* Abstract Background Design */}
      <div className="ob-bg-decor" aria-hidden="true">
        <div className="ob-mesh" />
        <div className="ob-orb ob-orb-1" />
        <div className="ob-orb ob-orb-2" />
      </div>

      {/* Top Header */}
      <header className="ob-hdr">
        <div className="hleft">
          <span className="logo" style={{ fontSize: 22 }}>
            Karyakshetram<i>.</i>
          </span>
        </div>

        <div className="ob-stepper">
          {[1, 2, 3, 4].map((s) => (
            <span
              key={s}
              className={`ob-step-dot ${
                step === s || step === 'preloader'
                  ? 'active'
                  : typeof step === 'number' && s < step
                  ? 'done'
                  : ''
              }`}
              title={`Step ${s} of 4`}
            />
          ))}
          <span className="s12 b muted" style={{ marginLeft: 6 }}>
            {typeof step === 'number' ? `Step ${step} of 4` : 'Finishing setup'}
          </span>
        </div>

        <div className="hright">
          <ThemeToggle />
          <button
            type="button"
            className="btn ghost sm"
            onClick={startPreloaderAndFinish}
            title="Skip to dashboard"
          >
            Skip
          </button>
        </div>
      </header>

      {/* Main Content Stage */}
      <main className="ob-stage">
        {step === 'preloader' ? (
          <div className="ob-preloader-stage ob-anim-forward">
            <div className="ob-preloader-visual">
              <div className="ob-orbit ob-orbit-1" />
              <div className="ob-orbit ob-orbit-2" />
              <div className="ob-orbit-core">
                <Icon n="sparkling-2-line" />
              </div>
            </div>

            <div className="col g10">
              <h1 className="ob-preloader-title">Setting you up…</h1>
              <p className="ob-preloader-status">{PRELOADER_MESSAGES[preloaderIdx]}</p>
            </div>

            <div className="ob-progress-bar-wrap">
              <div className="ob-progress-bar-fill" style={{ width: `${progress}%` }} />
            </div>

            <span className="s12 muted">Configuring your personal spatial analytics engine</span>
          </div>
        ) : (
          <div className={`ob-center-box ${direction === 'forward' ? 'ob-anim-forward' : 'ob-anim-backward'}`}>
            {/* Step 1: Name and Business Name */}
            {step === 1 && (
              <>
                <div className="ob-hero">
                  <span className="ob-badge">
                    <Icon n="user-smile-line" s={14} /> Welcome to Karyakshetram
                  </span>
                  <h1 className="ob-title">Let’s get you started</h1>
                  <p className="ob-sub">
                    Tell us your name and your company name. We tailor every spatial model and catchment metric to your brand.
                  </p>
                </div>

                {err && (
                  <div className="panel pad12 row g8 s13" style={{ background: 'var(--badSoft)', color: 'var(--bad)', borderRadius: 12 }}>
                    <Icon n="error-warning-line" s={18} />
                    <span>{err}</span>
                  </div>
                )}

                <div className="ob-inputs-card">
                  <div className="ob-field">
                    <label className="ob-label">Your Name</label>
                    <div className="ob-input-wrap">
                      <Icon n="user-3-line" s={18} c="var(--muted)" />
                      <input
                        autoFocus
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Introduce yourself"
                        onKeyDown={(e) => e.key === 'Enter' && goNext()}
                      />
                    </div>
                  </div>

                  <div className="ob-field">
                    <label className="ob-label">Name of your company</label>
                    <div className="ob-input-wrap">
                      <Icon n="building-2-line" s={18} c="var(--muted)" />
                      <input
                        value={form.businessName}
                        onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                        placeholder="Name of your company"
                        onKeyDown={(e) => e.key === 'Enter' && goNext()}
                      />
                    </div>
                  </div>

                  <div className="ob-actions">
                    <span className="s13 muted">Only two quick details to start</span>
                    <button type="button" className="ob-btn ink" onClick={goNext}>
                      Continue <Icon n="arrow-right-line" s={16} />
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Step 2: What you do and Type of business */}
            {step === 2 && (
              <>
                <div className="ob-hero">
                  <span className="ob-badge">
                    <Icon n="briefcase-4-line" s={14} /> Venture Details
                  </span>
                  <h1 className="ob-title">Tell us about your business</h1>
                  <p className="ob-sub">
                    Describe your primary offering and operational type so our algorithms match relevant footfall and density curves.
                  </p>
                </div>

                {err && (
                  <div className="panel pad12 row g8 s13" style={{ background: 'var(--badSoft)', color: 'var(--bad)', borderRadius: 12 }}>
                    <Icon n="error-warning-line" s={18} />
                    <span>{err}</span>
                  </div>
                )}

                <div className="ob-inputs-card">
                  <div className="ob-field">
                    <label className="ob-label">What does your business do?</label>
                    <div className="ob-input-wrap">
                      <Icon n="store-2-line" s={18} c="var(--muted)" />
                      <input
                        autoFocus
                        value={form.businessActivity}
                        onChange={(e) => setForm({ ...form, businessActivity: e.target.value })}
                        placeholder="Tell us what you do..."
                        onKeyDown={(e) => e.key === 'Enter' && goNext()}
                      />
                    </div>
                  </div>

                  <div className="ob-field">
                    <label className="ob-label">Type of your business / Format</label>
                    <div className="ob-input-wrap">
                      <Icon n="git-branch-line" s={18} c="var(--muted)" />
                      <input
                        value={form.businessType}
                        onChange={(e) => setForm({ ...form, businessType: e.target.value })}
                        placeholder="Tell us more about what you do..."
                        onKeyDown={(e) => e.key === 'Enter' && goNext()}
                      />
                    </div>
                  </div>

                  <div className="ob-actions">
                    <button type="button" className="ob-btn out" onClick={goBack}>
                      <Icon n="arrow-left-line" s={16} /> Back
                    </button>
                    <button type="button" className="ob-btn ink" onClick={goNext}>
                      Continue <Icon n="arrow-right-line" s={16} />
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Step 3: Checkboxes in zig-zag rows */}
            {step === 3 && (
              <>
                <div className="ob-hero">
                  <span className="ob-badge">
                    <Icon n="apps-2-line" s={14} /> Retail Sectors
                  </span>
                  <h1 className="ob-title">What is your business all about?</h1>
                  <p className="ob-sub">
                    Select all sectors that apply. We construct competitive clusters and anchor synergies tailored to these categories.
                  </p>
                </div>

                {err && (
                  <div className="panel pad12 row g8 s13" style={{ background: 'var(--badSoft)', color: 'var(--bad)', borderRadius: 12 }}>
                    <Icon n="error-warning-line" s={18} />
                    <span>{err}</span>
                  </div>
                )}

                {/* Staggered Zig-Zag Rows of Rectangle Cards */}
                <div className="ob-zigzag-container">
                  {Array.from({ length: Math.ceil(CATEGORY_ITEMS.length / 2) }).map((_, rIdx) => {
                    const rowItems = CATEGORY_ITEMS.slice(rIdx * 2, rIdx * 2 + 2);
                    return (
                      <div key={rIdx} className="ob-zigzag-row">
                        {rowItems.map((cat) => {
                          const active = form.categories.includes(cat.key);
                          return (
                            <div
                              key={cat.key}
                              className={`ob-card ${active ? 'on' : ''}`}
                              onClick={() => toggleCategory(cat.key)}
                              role="checkbox"
                              aria-checked={active}
                              tabIndex={0}
                              onKeyDown={(e) => e.key === 'Enter' && toggleCategory(cat.key)}
                            >
                              <div className="ob-card-icon">
                                <Icon n={cat.icon} />
                              </div>
                              <div className="ob-card-body">
                                <span className="ob-card-title">{cat.name}</span>
                                <span className="ob-card-sub">{cat.desc}</span>
                              </div>
                              <div className="ob-card-check">
                                {active && <Icon n="check-line" s={14} />}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>

                <div className="ob-actions">
                  <button type="button" className="ob-btn out" onClick={goBack}>
                    <Icon n="arrow-left-line" s={16} /> Back
                  </button>
                  <button type="button" className="ob-btn ink" onClick={goNext}>
                    Continue ({form.categories.length} selected) <Icon n="arrow-right-line" s={16} />
                  </button>
                </div>
              </>
            )}

            {/* Step 4: Challenges checkboxes in small rectangle cards + top fillup */}
            {step === 4 && (
              <>
                <div className="ob-hero">
                  <span className="ob-badge">
                    <Icon n="compass-3-line" s={14} /> Expansion Hurdles
                  </span>
                  <h1 className="ob-title">What challenges do you face?</h1>
                  <p className="ob-sub">
                    Highlight the friction points you deal with so Karyakshetram surfaces the right sensitivity and risk analyses.
                  </p>
                </div>

                {err && (
                  <div className="panel pad12 row g8 s13" style={{ background: 'var(--badSoft)', color: 'var(--bad)', borderRadius: 12 }}>
                    <Icon n="error-warning-line" s={18} />
                    <span>{err}</span>
                  </div>
                )}

                {/* Top Fillup for custom challenges */}
                <div className="ob-inputs-card" style={{ padding: '24px 24px 20px', gap: 12 }}>
                  <div className="ob-field">
                    <label className="ob-label">Your biggest retail challenge right now</label>
                    <div className="ob-input-wrap">
                      <Icon n="chat-voice-line" s={18} c="var(--muted)" />
                      <input
                        autoFocus
                        value={form.challengesNote}
                        onChange={(e) => setForm({ ...form, challengesNote: e.target.value })}
                        placeholder="e.g. Finding high footfall locations with reasonable rent, avoiding cannibalising our stores..."
                      />
                    </div>
                  </div>
                  <span className="s12 muted">You can also select from the common industry challenges below:</span>
                </div>

                {/* Smaller size rectangle checkbox cards arranged in zig-zag rows */}
                <div className="ob-zigzag-container">
                  {Array.from({ length: Math.ceil(CHALLENGE_ITEMS.length / 2) }).map((_, rIdx) => {
                    const rowItems = CHALLENGE_ITEMS.slice(rIdx * 2, rIdx * 2 + 2);
                    return (
                      <div key={rIdx} className="ob-zigzag-row">
                        {rowItems.map((ch) => {
                          const active = form.challenges.includes(ch.label);
                          return (
                            <div
                              key={ch.id}
                              className={`ob-card sm ${active ? 'on' : ''}`}
                              onClick={() => toggleChallenge(ch.label)}
                              role="checkbox"
                              aria-checked={active}
                              tabIndex={0}
                              onKeyDown={(e) => e.key === 'Enter' && toggleChallenge(ch.label)}
                            >
                              <div className="ob-card-icon">
                                <Icon n={ch.icon} />
                              </div>
                              <div className="ob-card-body">
                                <span className="ob-card-title">{ch.label}</span>
                              </div>
                              <div className="ob-card-check">
                                {active && <Icon n="check-line" s={12} />}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>

                <div className="ob-actions">
                  <button type="button" className="ob-btn out" onClick={goBack}>
                    <Icon n="arrow-left-line" s={16} /> Back
                  </button>
                  <button type="button" className="ob-btn ink" onClick={goNext}>
                    Complete Setup <Icon n="sparkling-2-line" s={16} />
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
