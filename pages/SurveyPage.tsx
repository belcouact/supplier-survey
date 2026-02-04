import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { SurveyForm } from '../components/SurveyForm';
import { SurveySchema, SurveyAnswers, QuestionType } from '../types';
import { getSurveyResult, saveSurveyResult } from '../services/resultService';
import { getTemplateByShortId } from '../services/templateService';
import { AlertCircle, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';

interface SurveyPageProps {
  user: any;
}

export function SurveyPage({ user }: SurveyPageProps) {
  const { shortId } = useParams<{ shortId: string }>();
  const [survey, setSurvey] = useState<SurveySchema | null>(null);
  const [answers, setAnswers] = useState<SurveyAnswers>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load Survey
  useEffect(() => {
    if (shortId) {
      loadSurvey(shortId);
    } else {
      setIsLoading(false);
      setError('No survey ID provided.');
    }
  }, [shortId]);

  // Load User's Previous Answers if logged in
  useEffect(() => {
    if (user && templateId) {
      loadPreviousAnswers(templateId, user.id);
    }
  }, [user, templateId]);

  const loadSurvey = async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const template = await getTemplateByShortId(id);
      
      if (template) {
        setTemplateId(template.id);
        setSurvey(template.schema);
        
        // Check expiration
        if (template.expiration_date) {
            const expDate = new Date(template.expiration_date);
            if (expDate < new Date()) {
                setReadOnly(true);
            }
        }
      } else {
        setError('Survey not found.');
      }
    } catch (err) {
      console.error('Failed to load survey', err);
      setError('Failed to load survey. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPreviousAnswers = async (tId: string, uId: string) => {
    try {
      const result = await getSurveyResult(tId, uId);
      if (result && result.answers) {
        setAnswers(result.answers);
      }
    } catch (err) {
      console.error('Failed to load previous answers', err);
    }
  };

  const handleAnswerChange = (qId: string, value: any, type: QuestionType) => {
    if (readOnly) return;
    
    setAnswers(prev => {
      const newAnswers = { ...prev };
      
      if (type === 'multiple_choice') {
        const currentArr = (newAnswers[qId] as string[]) || [];
        if (currentArr.includes(value)) {
          newAnswers[qId] = currentArr.filter(v => v !== value);
        } else {
          newAnswers[qId] = [...currentArr, value];
        }
      } else {
        newAnswers[qId] = value;
      }
      return newAnswers;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;

    setIsSubmitting(true);

    try {
      if (user && templateId) {
        await saveSurveyResult(templateId, user.id, answers);
      } else {
        if (templateId) {
             await saveSurveyResult(templateId, 'anonymous', answers);
        }
      }

      setFormSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('Submission error', err);
      alert('Failed to submit survey. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSave = async () => {
    if (readOnly) return;
    
    try {
      if (user && templateId) {
        await saveSurveyResult(templateId, user.id, answers, 'saved');
        // Toast notification would be better here
        alert('Progress saved successfully!');
      } else if (templateId) {
        await saveSurveyResult(templateId, 'anonymous', answers, 'saved');
        alert('Progress saved! Note: As an anonymous user, your progress is shared with other anonymous users. Please log in for a private session.');
      }
    } catch (err) {
      console.error('Save error', err);
      alert('Failed to save progress. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
        <Loader2 className="w-12 h-12 text-brand-600 animate-spin mb-4" />
        <div className="text-slate-500 font-medium">Loading survey...</div>
      </div>
    );
  }

  if (error || !survey) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center animate-fade-in">
        <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mb-6">
            <AlertTriangle className="w-10 h-10 text-rose-500" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Survey Unavailable</h2>
        <p className="text-slate-500 max-w-md">{error || 'The survey you are looking for could not be found.'}</p>
      </div>
    );
  }

  if (formSubmitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center animate-fade-in">
        <div className="w-24 h-24 bg-gradient-to-br from-green-100 to-emerald-50 rounded-full flex items-center justify-center mb-8 shadow-soft animate-scale-in">
          <CheckCircle2 className="w-12 h-12 text-green-600" />
        </div>
        <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-6 tracking-tight">Thank You!</h2>
        <p className="text-xl text-slate-600 max-w-lg leading-relaxed">
          Your feedback has been successfully recorded. We appreciate your time and contribution.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      {readOnly && (
        <div className="mb-8 bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start md:items-center text-amber-900 shadow-sm animate-fade-in">
            <AlertCircle className="w-6 h-6 mr-3 flex-shrink-0 mt-0.5 md:mt-0" />
            <span className="font-medium text-lg">This survey has expired. You are currently viewing it in <span className="font-bold">Read-Only</span> mode.</span>
        </div>
      )}
      
      <SurveyForm 
        survey={survey}
        answers={answers}
        onAnswerChange={handleAnswerChange}
        onSubmit={handleSubmit}
        onSave={handleSave}
        isSubmitting={isSubmitting}
        readOnly={readOnly}
      />
    </div>
  );
}
