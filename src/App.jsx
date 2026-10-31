import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import LoadingSpinner from './components/LoadingSpinner';
import Layout from './components/Layout';
import { useEffect, useState, lazy, Suspense } from 'react';
import { PageContextProvider } from './contexts/PageContext';
import { MonthContextProvider } from './contexts/MonthContext';
import { DayContextProvider } from './contexts/DayContext';

const Calendar = lazy(() => import('./pages/Calendar'));
const Descriptions = lazy(() => import('./pages/Descriptions'));
const Home = lazy(() => import('./pages/Home'));
const TrailDetail = lazy(() => import('./pages/TrailDetail'));
const ScheduleBuilder = lazy(() => import('./pages/ScheduleBuilder'));

const PageLazy = ({ children }) => (
  <Suspense fallback={<LoadingSpinner />}>
    {children}
  </Suspense>
);
import { ensureScheduleWritable, request, verifyAdminKey } from './api/client.js';
import { useToast } from './hooks/useToast';
import ToastContainer from './components/Toast.jsx';
import { setGroupConfig, getGroupName } from './utils/config';
import { storeApiKey, hasStoredApiKey, getStoredApiKey, isStoredApiKeyVerified, getApiKeyFromHash, removeApiKeyFromLocation, hasPendingApiKeyFromHash } from './utils/apiKey';
import SplashScreen from './components/SplashScreen';
import { hasVisited } from './utils/visited';

function ApiKeySync({ showToast }) {
  const { search } = useLocation();

  // A key restored from localStorage is re-verified against the server on
  // startup; the server may have rotated it since.
  useEffect(() => {
    const saved = getStoredApiKey();
    if (!saved || isStoredApiKeyVerified()) return;
    verifyAdminKey(saved)
      .then((result) => {
        if (result.valid) storeApiKey(saved, { verified: true });
        else storeApiKey('');
      })
      .catch(() => { /* server unreachable: keep the key for a later retry */ });
  }, []);

  useEffect(() => {
    const candidate = getApiKeyFromHash().trim();
    if (!candidate) return;

    let active = true;
    (async () => {
      try {
        const result = await verifyAdminKey(candidate);
        if (!active) return;

        if (result.valid) {
          storeApiKey(candidate, { verified: true });
          showToast('API key verified.', 'success');
          return;
        }

        storeApiKey('');
        if (result.reason === 'invalid') showToast('API key is invalid.', 'error');
        else if (result.reason === 'not-configured') showToast('Server has no admin API key configured.', 'error');
        else showToast(result.error || 'Could not verify the API key.', 'error');
      } catch (err) {
        if (!active) return;
        showToast(`Could not verify API key: ${err.message}`, 'error');
      } finally {
        if (active) removeApiKeyFromLocation();
      }
    })();

    return () => {
      active = false;
    };
  }, [showToast]);
  useEffect(() => {
    const params = new URLSearchParams(search);
    if (params.has('apikey')) {
      params.delete('apikey');
      const newSearch = params.toString();
      window.history.replaceState({}, '', newSearch ? `?${newSearch}` : window.location.pathname);
    }
  }, [search]);
  return null;
}

function App() {
  const showToast = useToast();
  const [isConfigLoaded, setIsConfigLoaded] = useState(!!getGroupName());
  const [showSplash, setShowSplash] = useState(() => {
    if (hasStoredApiKey() || hasPendingApiKeyFromHash()) return false;
    return !hasVisited();
  });

  useEffect(() => {
    request('/api/schedule/group').then(data => {
      if (data && data.name && data.hikeDays) {
        setGroupConfig({
          name: data.name,
          hikeDays: data.hikeDays,
          maxHikesPerDay: data.maxHikesPerDay ?? 3,
          minSpeedMph: data.minSpeedMph ?? 1.1,
          maxSpeedMph: data.maxSpeedMph ?? 2.2,
          isBikeTrip: data.isBikeTrip ?? false
        });
      } else {
        showToast('Server configuration missing', 'error');
      }
    }).catch(() => {
      showToast('Failed to connect to group server', 'error');
    }).finally(() => {
      setIsConfigLoaded(true);
    });
  }, [showToast]);

  useEffect(() => {
    request('/api/config').then(data => {
      document.title = data?.appName || 'hiker';
    }).catch(() => {
      document.title = 'hiker';
    });
  }, []);

  useEffect(() => {
    ensureScheduleWritable().then((result) => {
      if (result && !result.success) {
        const failed = result.results?.filter(r => !r.success);
        if (failed?.length) {
          showToast('Some exported_data files are not writable: ' + failed.map(r => r.file).join(', '), 'error');
        }
      }
    }).catch(() => {});
  }, [showToast]);

  if (!isConfigLoaded) {
    return <LoadingSpinner message="Loading group configuration..." />;
  }

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      {showSplash && <SplashScreen onDismiss={() => setShowSplash(false)} />}
      <ApiKeySync showToast={showToast} />
      <PageContextProvider>
        <MonthContextProvider>
          <DayContextProvider>
          <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<PageLazy><Calendar /></PageLazy>} />
            <Route path="/descriptions" element={<PageLazy><Descriptions /></PageLazy>} />
            <Route path="/browse" element={<PageLazy><Home /></PageLazy>} />
            <Route path="/trail/:id" element={<PageLazy><TrailDetail /></PageLazy>} />
            <Route path="/trails" element={<Navigate to="/browse" replace />} />
            <Route path="/schedule" element={<PageLazy><ScheduleBuilder /></PageLazy>} />
          </Route>
          </Routes>
          </DayContextProvider>
        </MonthContextProvider>
      </PageContextProvider>
      <ToastContainer />
    </BrowserRouter>
  );
}

export default App;
