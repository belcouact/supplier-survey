import { Link, useNavigate } from 'react-router-dom';
import { User, LogIn, LogOut, Settings, ClipboardList, Globe } from 'lucide-react';
import { Language } from '../types';

interface NavbarProps {
  user: any;
  isAdmin: boolean;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  onOpenAuth: () => void;
  onLogout: () => void;
}

export function Navbar({ user, isAdmin, language, onLanguageChange, onOpenAuth, onLogout }: NavbarProps) {
  const navigate = useNavigate();

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center gap-2">
            <Link to="/" className="flex-shrink-0 flex items-center gap-2">
              <ClipboardList className="text-blue-600" size={28} />
              <span className="text-xl font-bold text-slate-800">Survey App</span>
            </Link>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Language Switcher */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button 
                onClick={() => onLanguageChange(Language.EN)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${language === Language.EN ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                EN
              </button>
              <button 
                onClick={() => onLanguageChange(Language.SC)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${language === Language.SC ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                简
              </button>
              <button 
                onClick={() => onLanguageChange(Language.TC)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${language === Language.TC ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                繁
              </button>
            </div>

            {isAdmin && (
              <Link 
                to="/admin" 
                className="text-gray-600 hover:text-blue-600 flex items-center gap-1 text-sm font-medium"
              >
                <Settings size={18} />
                <span className="hidden sm:inline">Admin</span>
              </Link>
            )}

            {user ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <User size={18} />
                  <span className="hidden md:inline">{user.email}</span>
                </div>
                <button
                  onClick={onLogout}
                  className="p-2 text-gray-500 hover:text-red-600 transition-colors"
                  title="Log Out"
                >
                  <LogOut size={20} />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenAuth}
                className="flex items-center gap-2 bg-blue-50 text-blue-600 px-3 py-1.5 rounded-md hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <LogIn size={18} />
                <span className="hidden sm:inline">Login</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
