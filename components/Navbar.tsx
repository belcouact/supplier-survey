import { Link, useNavigate } from 'react-router-dom';
import { User, LogIn, LogOut, Settings, Home, Sparkles } from 'lucide-react';

interface NavbarProps {
  user: any;
  isAdmin: boolean;
  onOpenAuth: () => void;
  onLogout: () => void;
  onChangePassword?: () => void;
}

export function Navbar({ user, isAdmin, onOpenAuth, onLogout, onChangePassword }: NavbarProps) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-white/80 backdrop-blur-md border-b border-white/20 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          <div className="flex items-center gap-2">
            <Link to="/" className="flex-shrink-0 flex items-center gap-2 group">
              <div className="p-1.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg text-white shadow-md group-hover:shadow-lg transition-all duration-300">
                <Sparkles size={20} className="fill-current" />
              </div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                Survey AI
              </span>
            </Link>
          </div>
          
          <div className="flex items-center space-x-2 md:space-x-6">
            
            {user && (
              <Link
                to="/"
                className="text-slate-500 hover:text-brand-600 flex items-center gap-2 text-sm font-semibold transition-colors px-3 py-2 rounded-lg hover:bg-slate-50"
              >
                <Home size={18} />
                <span className="hidden sm:inline">Home</span>
              </Link>
            )}

            {isAdmin && (
              <Link 
                to="/admin" 
                className="text-slate-500 hover:text-brand-600 flex items-center gap-2 text-sm font-semibold transition-colors px-3 py-2 rounded-lg hover:bg-slate-50"
              >
                <Settings size={18} />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
            )}

            {user ? (
              <div className="flex items-center gap-4 pl-4 border-l border-slate-200">
                <button 
                  onClick={onChangePassword}
                  className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-brand-600 transition-colors"
                  title="Change Password"
                >
                  <div className="w-8 h-8 rounded-full bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600">
                    <User size={16} />
                  </div>
                  <span className="hidden md:inline">{user.email}</span>
                </button>
                <button
                  onClick={onLogout}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                  title="Log Out"
                >
                  <LogOut size={20} />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenAuth}
                className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 text-sm font-bold"
              >
                <LogIn size={18} />
                <span className="hidden sm:inline">Sign In</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
