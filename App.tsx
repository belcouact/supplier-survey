import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { AuthModal } from './components/AuthModal';
import { AdminPage } from './pages/AdminPage';
import { SurveyPage } from './pages/SurveyPage';
import { HomePage } from './pages/HomePage';
import { supabase } from './services/supabaseClient';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [defaultAuthEmail, setDefaultAuthEmail] = useState('');

  // --- Auth Listener ---
  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      checkAdminStatus(session?.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      checkAdminStatus(session?.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAdminStatus = (currentUser: any) => {
    if (!currentUser) {
        setIsAdmin(false);
        return;
    }
    const email = currentUser.email;
    const role = currentUser.user_metadata?.role;
    
    if (email === 'admin@wlgore.com' || role === 'admin' || role === 'super_admin') {
      setIsAdmin(true);
    } else {
      setIsAdmin(false);
    }
  };

  const handleLoginSuccess = (userData: any) => {
    setUser(userData);
    checkAdminStatus(userData);
    
    // Redirect logic if admin just logged in
    const email = userData.email;
    const role = userData.user_metadata?.role;
    if (email === 'admin@wlgore.com' || role === 'admin' || role === 'super_admin') {
      const basePath = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
      // We can just navigate using window or router if we were inside context, but we are outside.
      // Actually, since we render Routes below, we don't strictly need to force reload unless we want to ensure state.
      // But typically React Router handles it if state updates.
      // Let's just let the state update trigger re-render and user can navigate or we can redirect if on home.
      if (window.location.pathname === '/' || window.location.pathname.endsWith('/')) {
         window.location.href = `${basePath}admin`;
      }
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAdmin(false);
    const basePath = import.meta.env.BASE_URL;
    window.location.href = basePath;
  };

  const handleOpenAdminAuth = () => {
    setDefaultAuthEmail('admin@wlgore.com');
    setIsAuthOpen(true);
  };

  const handleOpenAuth = () => {
    setDefaultAuthEmail('');
    setIsAuthOpen(true);
  };

  return (
    <Router basename={import.meta.env.BASE_URL}>
      <div className="min-h-screen bg-gray-50 text-slate-800 flex flex-col font-sans">
        <Navbar 
          user={user} 
          isAdmin={isAdmin}
          onOpenAuth={handleOpenAuth}
          onOpenAdminAuth={handleOpenAdminAuth}
          onLogout={handleLogout}
        />

        <AuthModal 
          isOpen={isAuthOpen} 
          onClose={() => setIsAuthOpen(false)}
          onLoginSuccess={handleLoginSuccess}
          defaultEmail={defaultAuthEmail}
        />

        <Routes>
          <Route path="/" element={<HomePage user={user} />} />
          <Route path="/:shortId" element={<SurveyPage user={user} />} />
          <Route 
            path="/admin" 
            element={isAdmin ? <AdminPage user={user} /> : <Navigate to="/" replace />} 
          />
        </Routes>
      </div>
    </Router>
  );
}
