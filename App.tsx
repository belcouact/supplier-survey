import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { AuthModal } from './components/AuthModal';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { AdminPage } from './pages/AdminPage';
import { SurveyPage } from './pages/SurveyPage';
import { HomePage } from './pages/HomePage';
import { supabase } from './services/supabaseClient';
import { getUserRole } from './services/userService';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [defaultAuthEmail, setDefaultAuthEmail] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // --- Auth Listener ---
  useEffect(() => {
    // Check active session
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
        await checkAdminStatus(session?.user);
      } catch (error) {
        console.error('Error checking auth session:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      checkAdminStatus(session?.user);

      if (event === 'PASSWORD_RECOVERY') {
        setIsChangePasswordOpen(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAdminStatus = async (currentUser: any) => {
    if (!currentUser) {
        setIsAdmin(false);
        return;
    }
    const email = currentUser.email;
    
    // Check user_roles table first
    const dbRole = await getUserRole(currentUser.id);
    
    // Fallback to metadata if no DB role found (for legacy support or race conditions)
    const metaRole = currentUser.user_metadata?.role;
    
    if (dbRole === 'admin' || dbRole === 'super_admin' || metaRole === 'admin' || metaRole === 'super_admin') {
      setIsAdmin(true);
    } else {
      setIsAdmin(false);
    }
  };

  const handleLoginSuccess = async (userData: any) => {
    setUser(userData);
    await checkAdminStatus(userData);
    
    // Redirect logic if admin just logged in
    const email = userData.email;
    const dbRole = await getUserRole(userData.id);
    const metaRole = userData.user_metadata?.role;
    
    if (dbRole === 'admin' || dbRole === 'super_admin' || metaRole === 'admin' || metaRole === 'super_admin') {
      const basePath = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
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

  const handleOpenAuth = () => {
    setDefaultAuthEmail('');
    setIsAuthOpen(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <Router basename={import.meta.env.BASE_URL}>
      <div className="min-h-screen text-slate-800 flex flex-col font-sans">
        <Navbar 
          user={user} 
          isAdmin={isAdmin}
          onOpenAuth={handleOpenAuth}
          onLogout={handleLogout}
          onChangePassword={() => setIsChangePasswordOpen(true)}
        />

        <AuthModal 
          isOpen={isAuthOpen} 
          onClose={() => setIsAuthOpen(false)}
          onLoginSuccess={handleLoginSuccess}
          defaultEmail={defaultAuthEmail}
        />

        <ChangePasswordModal 
          isOpen={isChangePasswordOpen} 
          onClose={() => setIsChangePasswordOpen(false)} 
        />

        <div className="flex-grow pt-20">
          <Routes>
            <Route path="/" element={<HomePage user={user} />} />
            <Route path="/:shortId" element={<SurveyPage user={user} />} />
            <Route 
              path="/admin" 
              element={isAdmin ? <AdminPage user={user} /> : <Navigate to="/" replace />} 
            />
          </Routes>
        </div>
      </div>
    </Router>
  );
}
