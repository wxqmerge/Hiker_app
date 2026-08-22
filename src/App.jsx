import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import LoadingSpinner from './components/LoadingSpinner';
import Layout from './components/Layout';
import { useEffect, useState, lazy, Suspense } from 'react';
import { PageContextProvider } from './contexts/PageContext';
import { MonthContextProvider } from './contexts/MonthContext';
import { DayContextProvider } from './contexts/DayContext';

const Calendar = lazy(() => import('./pages/Calendar'));
const Home = lazy(() => import('./pages/Home'));
const TrailDetail = lazy(() => import('./pages/TrailDetail'));
const ScheduleBuilder = lazy(() => import('./pages/ScheduleBuilder'));

const PageLazy = ({ children }) => (
  <Suspense fallback={<LoadingSpinner />}>
    {children}
  </Suspense>
);
import { ensureScheduleWritable, request } from './api/client.js';
import { useToast } from './hooks/useToast';
import ToastContainer from './components/Toast.jsx';
import { setGroupConfig, getGroupName } from './utils/config';
import { storeApiKey } from './utils/apiKey';

function ApiKeySync() {
  const { search } = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(search);
    const key = params.get('apikey');
    if (key) {
      storeApiKey(key);
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

  useEffect(() => {
    request('/api/schedule/group').then(data => {
      if (data && data.name && data.hikeDays) {
        setGroupConfig({
          name: data.name,
          hikeDays: data.hikeDays
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
      <ApiKeySync />
      <PageContextProvider>
        <MonthContextProvider>
          <DayContextProvider>
          <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<PageLazy><Calendar /></PageLazy>} />
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
