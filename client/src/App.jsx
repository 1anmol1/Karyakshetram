import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './lib/state.jsx';
import { AppShell } from './components/Layout.jsx';
import Landing from './pages/Landing.jsx';
import Auth from './pages/Auth.jsx';
import Onboarding from './pages/Onboarding.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Location from './pages/Location.jsx';
import Cannibalisation from './pages/Cannibalisation.jsx';
import Compare from './pages/Compare.jsx';
import Check from './pages/Check.jsx';
import Portfolio from './pages/Portfolio.jsx';
import Trust from './pages/Trust.jsx';
import Profile from './pages/Profile.jsx';
import Saved from './pages/Saved.jsx';
import Guide from './pages/Guide.jsx';
import NotFound from './pages/NotFound.jsx';

function Splash() { return <div className="col ac jc" style={{ minHeight: '100vh' }}><div className="logo">Karyakshetram<i>.</i></div><div className="s13 muted" style={{ marginTop: 8 }}>Loading…</div></div>; }

function RequireAuth({ children, onboarded = true }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <Splash />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (onboarded && !user.profile?.completed) return <Navigate to="/onboarding" replace />;
  return children;
}
function PublicOnly({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <Splash />;
  if (user) return <Navigate to={user.profile?.completed ? '/app' : '/onboarding'} replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicOnly><Landing /></PublicOnly>} />
      <Route path="/login" element={<PublicOnly><Auth mode="login" /></PublicOnly>} />
      <Route path="/signup" element={<PublicOnly><Auth mode="signup" /></PublicOnly>} />
      <Route path="/trust" element={<Trust />} />
      <Route path="/guide" element={<Guide />} />
      <Route path="/onboarding" element={<RequireAuth onboarded={false}><Onboarding /></RequireAuth>} />
      <Route path="/onboarding/:step" element={<RequireAuth onboarded={false}><Onboarding /></RequireAuth>} />
      <Route element={<RequireAuth><AppShell /></RequireAuth>}>
        <Route path="/app" element={<Dashboard />} />
        <Route path="/location/:cellId" element={<Location />} />
        <Route path="/cannibalisation" element={<Cannibalisation />} />
        <Route path="/cannibalisation/:cellId" element={<Cannibalisation />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/check" element={<Check />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/saved" element={<Saved />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
