import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserResults } from '../services/resultService';
import { getTemplates } from '../services/templateService';
import { getUserRole } from '../services/userService';
import { SurveyResult, SurveyTemplate } from '../types';
import { ClipboardList, Clock, ArrowRight, CheckCircle2, LayoutGrid, List as ListIcon, Mail, Loader2, Check } from 'lucide-react';
import { sendEmail } from '../services/emailService';
import { RequestAccessModal } from '../components/RequestAccessModal';

interface HomePageProps {
  user: any;
}

export function HomePage({ user }: HomePageProps) {
  const [participatedSurveys, setParticipatedSurveys] = useState<SurveyTemplate[]>([]);
  const [availableSurveys, setAvailableSurveys] = useState<SurveyTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [surveyIdInput, setSurveyIdInput] = useState('');
  const [canCreate, setCanCreate] = useState(false);
  const [requestingAccess, setRequestingAccess] = useState(false);
  const [accessRequested, setAccessRequested] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      loadParticipatedSurveys();
    }
  }, [user]);

  const loadParticipatedSurveys = async () => {
    setLoading(true);
    try {
      const results = await getUserResults(user.id);
      const role = await getUserRole(user.id);
      
      const effectiveRole = role === 'super_admin' ? 'super_admin' : (role || 'common_user');
      setCanCreate(effectiveRole === 'admin' || effectiveRole === 'super_admin');

      const allTemplates = await getTemplates(user.id, effectiveRole);
      setAvailableSurveys(allTemplates || []);

      if (results.length > 0) {
        const participatedIds = new Set(results.map(r => String(r.template_id)));
        const filtered = (allTemplates || []).filter(t => participatedIds.has(String(t.id)) || participatedIds.has(String(t.short_id)));
        setParticipatedSurveys(filtered);
      } else {
        setParticipatedSurveys([]);
      }
    } catch (err) {
      console.error('Failed to load surveys', err);
    } finally {
      setLoading(false);
    }
  };

  const isExpired = (dateStr?: string) => {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  };

  const getText = (content: any): string => {
    if (!content) return '';
    if (typeof content === 'string') return content;
    return content.en || Object.values(content)[0] as string || '';
  };

  const handleCardClick = (survey: SurveyTemplate) => {
    const id = survey.short_id || survey.id;
    navigate(`/${id}`);
  };

  const renderSurveyList = (surveys: SurveyTemplate[], isParticipated: boolean) => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {surveys.map((survey, idx) => {
          const expired = isExpired(survey.expiration_date);
          return (
            <div 
              key={survey.id}
              onClick={() => handleCardClick(survey)}
              className="group bg-white rounded-3xl shadow-soft border border-slate-100 p-8 cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-brand-200 relative overflow-hidden"
              style={{ animationDelay: `${idx * 0.1}s` }}
            >
              <div className={`absolute top-0 right-0 px-4 py-2 text-xs font-bold rounded-bl-2xl ${
                expired 
                  ? 'bg-red-50 text-red-600' 
                  : isParticipated ? 'bg-brand-50 text-brand-600' : 'bg-emerald-50 text-emerald-600'
              }`}>
                {expired ? 'EXPIRED' : isParticipated ? 'PARTICIPATED' : 'ACTIVE'}
              </div>

              <div className="mb-6">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-colors ${
                    isParticipated ? 'bg-green-50 group-hover:bg-green-100' : 'bg-brand-50 group-hover:bg-brand-100'
                }`}>
                    {isParticipated ? (
                        <CheckCircle2 className="w-6 h-6 text-green-600" />
                    ) : (
                        <ClipboardList className="w-6 h-6 text-brand-600" />
                    )}
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3 line-clamp-2 leading-tight group-hover:text-brand-700 transition-colors">
                  {getText(survey.title)}
                </h3>
                <p className="text-slate-500 text-sm line-clamp-3 leading-relaxed">
                  {getText(survey.description)}
                </p>
              </div>

              <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                <div className="flex items-center text-xs text-slate-400 font-medium">
                  <Clock className="w-3.5 h-3.5 mr-1.5" />
                  <span>{expired ? (isParticipated ? 'Review Only' : 'Closed') : (isParticipated ? 'Update Response' : 'Open for submissions')}</span>
                </div>
                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-brand-600 group-hover:text-white transition-all">
                    <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-start pt-20 md:pt-24 min-h-[calc(100vh-80px)] p-6 relative overflow-hidden">
        {/* Decorative Background Elements */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse-slow"></div>
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-primary-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
        
        <div className="w-full max-w-4xl mx-auto text-center z-10 space-y-12 animate-fade-in">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight animate-slide-up-delay">
            <span className="block text-slate-900 mb-2">The New Survey,</span>
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 pb-2">
              Powered by AI
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-slate-600 max-w-2xl mx-auto leading-loose animate-slide-up-delay" style={{ animationDelay: '0.4s' }}>
            Experience the future of data collection. Seamless, intelligent, and efficient.
          </p>

          <div className="w-full max-w-md mx-auto mt-16 animate-slide-up-delay" style={{ animationDelay: '0.6s' }}>
            <div className="glass-panel p-1.5 rounded-2xl shadow-2xl flex items-center gap-2 transform transition-all focus-within:scale-105 duration-300">
              <input 
                  type="text" 
                  value={surveyIdInput}
                  onChange={(e) => setSurveyIdInput(e.target.value)}
                  placeholder="Enter Survey Code"
                  className="flex-1 px-5 py-3 bg-transparent border-none text-lg text-slate-800 placeholder-slate-400 focus:ring-0 outline-none w-full"
              />
              <button 
                  onClick={() => {
                      if (surveyIdInput.trim()) {
                          window.location.href = `https://study-llm.me/apps/survey-gen/${surveyIdInput.trim()}`;
                      }
                  }}
                  disabled={!surveyIdInput.trim()}
                  className="px-6 py-3 bg-brand-600 text-white font-bold rounded-xl hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-brand-500/30 flex items-center gap-2"
              >
                  Start
                  <ArrowRight className="w-5 h-5" />
              </button>
            </div>
            <p className="mt-6 text-sm text-slate-500 font-medium">
              Have a code? Enter it above to begin instantly.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleRequestAccess = async (justification: string) => {
    if (requestingAccess || accessRequested) return;
    
    setRequestingAccess(true);
    try {
      const response = await sendEmail({
        recipients: ['aluo@wlgore.com'],
        subject: 'Request Access to Create Survey',
        body: `Hello,\n\nI would like to request access to create surveys for the Supplier Survey App.\n\nMy Email: ${user.email}\nUser ID: ${user.id}\n\nJustification:\n${justification}`,
        userId: user.id,
        fromName: user.email || 'Supplier Survey User'
      });

      if (response.success) {
        setAccessRequested(true);
        setShowAccessModal(false);
      } else {
        alert('Failed to send request: ' + response.error);
      }
    } catch (err) {
      console.error(err);
      alert('An unexpected error occurred.');
    } finally {
      setRequestingAccess(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10 animate-fade-in">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">Survey participation</h2>
          <p className="text-slate-500 mt-2 text-lg">Manage and track your survey participation.</p>
        </div>
        
        {!canCreate && (
            <button 
                onClick={() => setShowAccessModal(true)}
                disabled={requestingAccess || accessRequested}
                className={`flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 transition-all text-sm font-bold group self-start md:self-auto
                  ${accessRequested 
                    ? 'bg-green-50 text-green-600 border-green-200 cursor-default' 
                    : 'hover:text-brand-600 hover:border-brand-200 hover:shadow-sm'
                  }
                  ${requestingAccess ? 'opacity-70 cursor-wait' : ''}
                `}
            >
                <div className={`p-1.5 rounded-lg transition-colors
                  ${accessRequested 
                    ? 'bg-green-100 text-green-600' 
                    : 'bg-slate-50 text-slate-400 group-hover:bg-brand-50 group-hover:text-brand-500'
                  }
                `}>
                    {requestingAccess ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : accessRequested ? (
                      <Check size={18} />
                    ) : (
                      <Mail size={18} />
                    )}
                </div>
                <span>
                  {requestingAccess 
                    ? 'Sending Request...' 
                    : accessRequested 
                      ? 'Request Sent' 
                      : 'Request Creator Access'
                  }
                </span>
            </button>
        )}
      </div>
      
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
          <p className="text-brand-600 font-medium animate-pulse">Loading your surveys...</p>
        </div>
      ) : participatedSurveys.length === 0 ? (
        <div className="space-y-12 animate-slide-up">
          <div className="text-center py-16 bg-white rounded-3xl shadow-soft border border-slate-100/50">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <ClipboardList className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">No History Found</h3>
            <p className="text-slate-500 text-lg max-w-md mx-auto">You haven't participated in any surveys yet. Check out the available ones below!</p>
          </div>

          {availableSurveys.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-8">
                <div className="h-8 w-1 bg-brand-500 rounded-full"></div>
                <h3 className="text-2xl font-bold text-slate-800">Available Surveys</h3>
              </div>
              
              {renderSurveyList(availableSurveys, false)}
            </div>
          )}
        </div>
      ) : (
        <div className="animate-slide-up">
            {renderSurveyList(participatedSurveys, true)}
        </div>
      )}
      
      <RequestAccessModal 
        isOpen={showAccessModal} 
        onClose={() => setShowAccessModal(false)}
        onSubmit={handleRequestAccess}
        isLoading={requestingAccess}
      />
    </div>
  );
}
