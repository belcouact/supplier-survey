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
  const [isReset, setIsReset] = useState(false);
  const [email, setEmail] = useState(defaultEmail || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('common_user');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  React.useEffect(() => {
    if (defaultEmail) {
        setEmail(defaultEmail);
        setIsLogin(true);
        setIsReset(false);
    }
  }, [defaultEmail]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isReset) {
        // Construct the full URL to the app root (handles subdirectories like /apps/survey-gen/)
        const redirectUrl = window.location.origin + import.meta.env.BASE_URL;
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: redirectUrl,
        });
        if (error) throw error;
        setResetSent(true);
      } else if (isLogin) {
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
          alert('Registration successful!');
          onLoginSuccess(data.user);
          onClose();
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = (mode: 'login' | 'signup' | 'reset') => {
    setError(null);
    setResetSent(false);
    if (mode === 'reset') {
        setIsReset(true);
        setIsLogin(true);
    } else if (mode === 'login') {
        setIsReset(false);
        setIsLogin(true);
    } else {
        setIsReset(false);
        setIsLogin(false);
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
                {isReset ? 'Reset Password' : (isLogin ? 'Welcome Back' : 'Create Account')}
            </h2>
            <p className="text-slate-500 mt-2">
                {isReset 
                    ? 'Enter your email to receive reset instructions' 
                    : (isLogin ? 'Enter your credentials to access your account' : 'Join us to start creating surveys')}
            </p>
        </div>

        {error && (
          <div className="bg-rose-50 text-rose-600 px-4 py-3 rounded-xl mb-6 text-sm font-medium border border-rose-100 flex items-start">
             <span className="mr-2">•</span> {error}
          </div>
        )}

        {resetSent ? (
            <div className="bg-green-50 text-green-600 px-4 py-6 rounded-xl mb-6 text-center border border-green-100">
                <p className="font-bold mb-2">Check your email</p>
                <p className="text-sm">We've sent password reset instructions to <strong>{email}</strong></p>
                <button 
                    onClick={() => toggleMode('login')}
                    className="mt-4 text-brand-600 font-bold hover:underline"
                >
                    Back to Sign In
                </button>
            </div>
        ) : (
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
          
          {!isReset && (
          <div className="space-y-1">
            <div className="flex justify-between items-center ml-1">
                <label className="block text-sm font-bold text-slate-700">Password</label>
                {isLogin && (
                    <button 
                        type="button"
                        onClick={() => toggleMode('reset')}
                        className="text-xs font-medium text-brand-600 hover:text-brand-700 hover:underline"
                    >
                        Forgot password?
                    </button>
                )}
            </div>
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
          )}

          {!isLogin && !isReset && (
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

          {!isLogin && !isReset && (
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
            ) : (isReset ? 'Send Instructions' : (isLogin ? 'Sign In' : 'Create Account'))}
          </button>
        </form>
        )}

        {!resetSent && (
        <div className="mt-8 text-center">
          <p className="text-slate-500 text-sm">
            {isReset 
                ? <button onClick={() => toggleMode('login')} className="text-brand-600 font-bold hover:underline">Back to Sign In</button>
                : (isLogin 
                    ? <>Don't have an account? <button onClick={() => toggleMode('signup')} className="text-brand-600 font-bold hover:underline">Sign Up</button></>
                    : <>Already have an account? <button onClick={() => toggleMode('login')} className="text-brand-600 font-bold hover:underline">Log In</button></>
                  )
            }
          </p>
        </div>
        )}
      </div>
    </div>
  );
}
