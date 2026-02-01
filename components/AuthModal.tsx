import React, { useState } from 'react';
import { X } from 'lucide-react';
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
          alert('Registration successful! Please check your email for confirmation if required.');
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X size={24} />
        </button>

        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">
          {isLogin ? 'Welcome Back' : 'Create Account'}
        </h2>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email or Username</label>
            <input
              type="text"
              required
              value={email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
              >
                <option value="common_user">Common User</option>
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Processing...' : (isLogin ? 'Log In' : 'Sign Up')}
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-gray-600">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-blue-600 font-medium hover:underline"
          >
            {isLogin ? 'Sign Up' : 'Log In'}
          </button>
        </div>
      </div>
    </div>
  );
}
