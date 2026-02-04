import React, { useState } from 'react';
import { X, Mail, Lock, User } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: any) => void;
  defaultEmail?: string;
}

export function AuthModal({ isOpen, onClose, onLoginSuccess, defaultEmail }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState(defaultEmail || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('common_user');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (defaultEmail) {
        setEmail(defaultEmail);
        setIsLogin(true); // Usually if we pre-fill, we want login
    }
  }, [defaultEmail]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        if (data.user) {
          onLoginSuccess(data.user);
          onClose();
        }
      } else {
        if (password !== confirmPassword) {
            throw new Error("Passwords do not match");
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
                role: role
            }
          }
        });
        if (error) throw error;
        if (data.user) {
          // If auto-confirm is on, we can log them in. Otherwise, tell them to check email.
          // For this demo, we'll assume they can proceed or show a message.
          // Email sending is handled by Supabase settings, not client code.
          alert('Registration successful!');
          onLoginSuccess(data.user); // Optimistic login for demo flow if allowed
          onClose();
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative overflow-hidden animate-scale-in">
        {/* Decorative Top Bar */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-brand-500 to-primary-600"></div>
        
        <button 
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-full transition-colors"
        >
          <X size={24} />
        </button>

        <div className="text-center mb-8 mt-2">
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                {isLogin ? 'Welcome Back' : 'Create Account'}
            </h2>
            <p className="text-slate-500 mt-2">
                {isLogin ? 'Enter your credentials to access your account' : 'Join us to start creating surveys'}
            </p>
        </div>

        {error && (
          <div className="bg-rose-50 text-rose-600 px-4 py-3 rounded-xl mb-6 text-sm font-medium border border-rose-100 flex items-start">
             <span className="mr-2">•</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1">
            <label className="block text-sm font-bold text-slate-700 ml-1">Email</label>
            <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                type="text"
                required
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all outline-none font-medium"
                placeholder="name@example.com"
                />
            </div>
          </div>
          
          <div className="space-y-1">
            <label className="block text-sm font-bold text-slate-700 ml-1">Password</label>
            <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                type="password"
                required
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all outline-none font-medium"
                placeholder="••••••••"
                />
            </div>
          </div>

          {!isLogin && (
          <div className="space-y-1">
            <label className="block text-sm font-bold text-slate-700 ml-1">Confirm Password</label>
            <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all outline-none font-medium"
                placeholder="••••••••"
                />
            </div>
          </div>
          )}

          {!isLogin && (
            <div className="space-y-1">
              <label className="block text-sm font-bold text-slate-700 ml-1">Role</label>
              <div className="relative">
                 <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all outline-none font-medium appearance-none"
                >
                    <option value="common_user">Common User</option>
                </select>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-brand-600 to-primary-600 text-white py-3.5 rounded-xl font-bold shadow-lg hover:shadow-brand-500/30 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed transition-all mt-2"
          >
            {loading ? (
                <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                </span>
            ) : (isLogin ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-slate-500 text-sm">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-brand-600 font-bold hover:text-brand-700 hover:underline transition-colors"
            >
                {isLogin ? 'Sign Up' : 'Log In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
