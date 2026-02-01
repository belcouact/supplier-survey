import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserResults } from '../services/resultService';
import { getTemplates } from '../services/templateService';
import { SurveyResult, SurveyTemplate } from '../types';
import { ClipboardList, Clock, AlertCircle } from 'lucide-react';

interface HomePageProps {
  user: any;
}

export function HomePage({ user }: HomePageProps) {
  const [participatedSurveys, setParticipatedSurveys] = useState<SurveyTemplate[]>([]);
  const [loading, setLoading] = useState(false);
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
      if (results.length > 0) {
        // Fetch all templates (optimization: could fetch only specific IDs if API supported it)
        const allTemplates = await getTemplates();
        const participatedIds = new Set(results.map(r => r.template_id));
        const filtered = allTemplates.filter(t => participatedIds.has(t.id));
        setParticipatedSurveys(filtered);
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
    // Navigate to survey page
    // If we have a short_id, use it, otherwise use ID (though router expects short_id usually)
    // We'll update router to handle both or just short_id.
    const id = survey.short_id || survey.id;
    navigate(`/${id}`);
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center animate-fade-in">
        <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mb-8 shadow-sm">
          <ClipboardList className="w-12 h-12 text-blue-600" />
        </div>
        <h1 className="text-4xl font-bold text-slate-900 mb-4">
          Welcome to Supplier Survey
        </h1>
        <p className="text-xl text-slate-600 max-w-2xl leading-relaxed">
          Please log in to view your survey history or access a survey directly via the link provided to you.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">My Surveys</h2>
      
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : participatedSurveys.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-slate-100">
          <p className="text-slate-500 text-lg">You haven't participated in any surveys yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {participatedSurveys.map(survey => {
            const expired = isExpired(survey.expiration_date);
            return (
              <div 
                key={survey.id}
                onClick={() => handleCardClick(survey)}
                className={`bg-white rounded-xl shadow-sm border border-slate-200 p-6 cursor-pointer transition-all hover:shadow-md hover:border-blue-300 relative group overflow-hidden`}
              >
                {/* Status Badge */}
                <div className={`absolute top-0 left-0 px-3 py-1 text-xs font-semibold rounded-br-lg ${
                  expired 
                    ? 'bg-red-100 text-red-700' 
                    : 'bg-green-100 text-green-700'
                }`}>
                  {expired ? 'Expired' : 'Active'}
                </div>

                <h3 className="text-lg font-bold text-slate-900 mt-4 mb-2 line-clamp-2">
                  {getText(survey.title)}
                </h3>
                
                <p className="text-slate-600 text-sm mb-4 line-clamp-3">
                  {getText(survey.description)}
                </p>

                <div className="flex items-center text-xs text-slate-500 mt-auto pt-4 border-t border-slate-100">
                  <Clock className="w-3 h-3 mr-1" />
                  <span>
                    {expired ? 'Review Only' : 'Click to Update'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
