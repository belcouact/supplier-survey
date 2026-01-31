import { useState, useEffect } from 'react';
import { SurveyForm } from '../components/SurveyForm';
import { Language, SurveySchema, SurveyAnswers, QuestionType } from '../types';
import { getSurveyResult, saveSurveyResult } from '../services/resultService';
import { getTemplates } from '../services/templateService';

interface SurveyPageProps {
  language: Language;
  user: any;
}

export function SurveyPage({ language, user }: SurveyPageProps) {
  const [survey, setSurvey] = useState<SurveySchema | null>(null);
  const [answers, setAnswers] = useState<SurveyAnswers>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [templateId, setTemplateId] = useState<string | null>(null);

  // Load Survey
  useEffect(() => {
    loadActiveSurvey();
  }, []);

  // Load User's Previous Answers if logged in
  useEffect(() => {
    if (user && templateId) {
      loadPreviousAnswers(templateId, user.id);
    }
  }, [user, templateId]);

  const loadActiveSurvey = async () => {
    setIsLoading(true);
    try {
      // 1. Check if there's an active template ID in localStorage (set by Admin)
      // In a real app, this would fetch from a 'settings' endpoint
      const activeId = localStorage.getItem('active_template_id');
      const activeSchemaStr = localStorage.getItem('active_template_schema');

      if (activeId && activeSchemaStr) {
        setTemplateId(activeId);
        setSurvey(JSON.parse(activeSchemaStr));
      } else {
        // Fallback: Fetch the most recent template
        const templates = await getTemplates();
        if (templates && templates.length > 0) {
          const latest = templates[0];
          setTemplateId(latest.id);
          setSurvey(latest.schema);
        }
      }
    } catch (err) {
      console.error('Failed to load survey', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPreviousAnswers = async (tId: string, uId: string) => {
    try {
      const result = await getSurveyResult(tId, uId);
      if (result && result.answers) {
        setAnswers(result.answers);
        // Optionally, could set 'formSubmitted' to true if we want to block re-submission
        // But user asked to "resume", so we allow editing.
      }
    } catch (err) {
      console.error('Failed to load previous answers', err);
    }
  };

  const handleAnswerChange = (qId: string, value: any, type: QuestionType) => {
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
    setIsSubmitting(true);

    try {
      // If user is logged in, save to Supabase
      if (user && templateId) {
        await saveSurveyResult(templateId, user.id, answers);
      } else {
        // If anonymous, we can't save to a user-linked row easily without a session.
        // But prompt asked to "save result to supabase survey result table upon user entry and press submit".
        // We'll create an anonymous record or require login?
        // "show a user creation... allow survey result loading and resuming".
        // This implies anonymous submission is allowed but resuming requires login.
        // We'll save with a generated UUID or 'anonymous' user_id if allowed.
        // For now, let's just log it if not logged in, or try to save as 'anonymous'.
        if (templateId) {
            // Attempt to save as anonymous if RLS allows it
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-gray-500 animate-pulse">Loading survey...</div>
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-4 text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">No Active Survey</h2>
        <p className="text-gray-600">Please ask the administrator to publish a survey.</p>
      </div>
    );
  }

  if (formSubmitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center animate-fade-in">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-3xl font-bold text-slate-900 mb-4">Survey Completed!</h2>
        <p className="text-lg text-slate-600 max-w-md">
          Thank you for your feedback. Your responses have been successfully recorded.
        </p>
        <button 
          onClick={() => setFormSubmitted(false)}
          className="mt-8 px-6 py-2 text-blue-600 font-medium hover:bg-blue-50 rounded-lg transition-colors"
        >
          Submit another response
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <SurveyForm 
        survey={survey}
        answers={answers}
        language={language}
        onAnswerChange={handleAnswerChange}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
