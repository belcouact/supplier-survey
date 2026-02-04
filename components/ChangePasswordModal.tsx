import React, { useState } from 'react';
import { X, Lock } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;
      
      setSuccess(true);
      setPassword('');
      setConfirmPassword('');
      setTimeout(() => {
          onClose();
          setSuccess(false);
      }, 2000);

    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative overflow-hidden animate-scale-in">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-brand-500 to-primary-600"></div>
        
        <button 
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-full transition-colors"
        >
          <X size={24} />
        </button>

        <div className="text-center mb-8 mt-2">
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                Change Password
            </h2>
            <p className="text-slate-500 mt-2">
                Enter your new password below
            </p>
        </div>

        {error && (
          <div className="bg-rose-50 text-rose-600 px-4 py-3 rounded-xl mb-6 text-sm font-medium border border-rose-100 flex items-start">
             <span className="mr-2">•</span> {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 text-green-600 px-4 py-3 rounded-xl mb-6 text-sm font-medium border border-green-100 flex items-start">
             <span className="mr-2">•</span> Password updated successfully!
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1">
            <label className="block text-sm font-bold text-slate-700 ml-1">New Password</label>
            <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                type="password"
                required
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all outline-none font-medium"
                placeholder="••••••••"
                minLength={6}
                />
            </div>
          </div>

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
                minLength={6}
                />
            </div>
          </div>

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
            ) : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
