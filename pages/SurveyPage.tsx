import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { SurveyForm } from '../components/SurveyForm';
import { Language, SurveySchema, SurveyAnswers, QuestionType } from '../types';
import { getSurveyResult, saveSurveyResult } from '../services/resultService';
import { getTemplateByShortId } from '../services/templateService';
import { AlertCircle } from 'lucide-react';

interface SurveyPageProps {
  language: Language;
  user: any;
}

export function SurveyPage({ language, user }: SurveyPageProps) {
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-gray-500 animate-pulse">Loading survey...</div>
      </div>
    );
  }

  if (error || !survey) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-4 text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Error</h2>
        <p className="text-gray-600">{error || 'Survey not found.'}</p>
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
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      {readOnly && (
        <div className="max-w-6xl mx-auto mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center text-amber-800">
            <AlertCircle className="w-5 h-5 mr-2" />
            <span className="font-medium">This survey has expired. You are viewing it in Read-Only mode.</span>
        </div>
      )}
      
      <SurveyForm 
        survey={survey}
        answers={answers}
        language={language}
        onAnswerChange={handleAnswerChange}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        readOnly={readOnly}
      />
    </div>
  );
}
