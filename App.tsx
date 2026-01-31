import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { AuthModal } from './components/AuthModal';
import { AdminPage } from './pages/AdminPage';
import { SurveyPage } from './pages/SurveyPage';
import { supabase } from './services/supabaseClient';
import { Language } from './types';

export default function App() {
  const [language, setLanguage] = useState<Language>(Language.EN);
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // --- Auto-detect Language ---
  useEffect(() => {
    const browserLang = navigator.language.toLowerCase();
    if (browserLang.includes('zh-tw') || browserLang.includes('zh-hk')) {
      setLanguage(Language.TC);
    } else if (browserLang.includes('zh')) {
      setLanguage(Language.SC);
    } else {
      setLanguage(Language.EN);
    }
  }, []);

  // --- Auth Listener ---
  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      checkAdminStatus(session?.user?.email);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      checkAdminStatus(session?.user?.email);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAdminStatus = (email?: string) => {
    // For this demo, we can simulate admin via a specific email or local state
    // The prompt asked for "default user name: admin, and password: admin"
    // Since Supabase Auth usually requires email, we'll handle the "admin/admin" login separately in AuthModal
    // and set a local state.
    // If the user logs in via Supabase with an email like 'admin@example.com', we could treat them as admin too.
    // But primarily, we rely on the manual "Admin Login" flow if it's separate, 
    // OR we just set isAdmin=true if the user object has a specific flag.
    
    // However, the prompt implies a specific credential for admin.
    // We will handle this by checking if the user object has a special metadata flag or if we just manually set it.
  };

  const handleLoginSuccess = (userData: any) => {
    // If the user object is our special "Admin" mock object
    if (userData.isAdmin) {
      setIsAdmin(true);
      setUser(userData); // Mock user
    } else {
      setUser(userData);
      setIsAdmin(false);
    }
  };

  const handleLogout = async () => {
    if (isAdmin && user?.email === 'admin') {
      setIsAdmin(false);
      setUser(null);
    } else {
      await supabase.auth.signOut();
      setUser(null);
      setIsAdmin(false);
    }
    window.location.href = '/';
  };

  return (
    <Router>
      <div className="min-h-screen bg-gray-50 text-slate-800 flex flex-col font-sans">
        <Navbar 
          user={user} 
          isAdmin={isAdmin}
          onOpenAuth={() => setIsAuthOpen(true)}
          onLogout={handleLogout}
        />

        <AuthModal 
          isOpen={isAuthOpen} 
          onClose={() => setIsAuthOpen(false)}
          onLoginSuccess={handleLoginSuccess}
        />

        <Routes>
          {/* Landing Page: Survey Taker View */}
          <Route path="/" element={<SurveyPage language={language} user={user} />} />
          
          {/* Admin Page: Protected */}
          <Route 
            path="/admin" 
            element={isAdmin ? <AdminPage language={language} /> : <Navigate to="/" replace />} 
          />
        </Routes>
      </div>
    </Router>
  );
}
