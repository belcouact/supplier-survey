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
    if (email === 'admin@wlgore.com') {
      setIsAdmin(true);
    } else {
      setIsAdmin(false);
    }
  };

  const handleLoginSuccess = (userData: any) => {
    setUser(userData);
    checkAdminStatus(userData.email);
    if (userData.email === 'admin@wlgore.com') {
      window.location.href = '/admin';
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAdmin(false);
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
