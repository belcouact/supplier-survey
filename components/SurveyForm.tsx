import React, { useState, useEffect, useRef } from 'react';
import { SurveySchema, SurveyAnswers, QuestionType } from '../types';
import { Check, ChevronRight, ChevronLeft, Save, HelpCircle } from 'lucide-react';

interface SurveyFormProps {
  survey: SurveySchema;
  answers: SurveyAnswers;
  onAnswerChange: (qId: string, value: any, type: QuestionType) => void;
  onSubmit: (e: React.FormEvent) => void;
  onSave?: () => void;
  isSubmitting?: boolean;
  readOnly?: boolean;
}

export function SurveyForm({ 
  survey, 
  answers, 
  onAnswerChange, 
  onSubmit,
  onSave,
  isSubmitting = false,
  readOnly = false
}: SurveyFormProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const sectionRef = useRef<HTMLDivElement>(null);

  // Reset step if survey changes
  useEffect(() => {
    setCurrentStep(0);
  }, [survey.id]);

  const getText = (content: any): string => {
    if (!content) return '';
    if (typeof content === 'string') return content;
    return content.en || Object.values(content)[0] as string || '';
  };

  const totalSteps = survey.sections.length;
  const progress = Math.round(((currentStep + 1) / totalSteps) * 100);

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setDirection('forward');
      setCurrentStep(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setDirection('backward');
      setCurrentStep(prev => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const currentSection = survey.sections[currentStep];

  if (!currentSection) {
    return <div className="text-center p-12 text-slate-400 font-medium">No sections available in this survey.</div>;
  }

  return (
    <form onSubmit={onSubmit} className="max-w-5xl mx-auto font-sans pb-24">
      
      {/* Header Card */}
      <div className="bg-white rounded-3xl shadow-soft border border-slate-100 p-8 md:p-10 mb-8 animate-fade-in relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-400 via-brand-500 to-primary-500"></div>
        <div className="text-center space-y-4 mb-8">
          <h1 className="text-3xl md:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
            {getText(survey.title)}
          </h1>
          <p className="text-lg md:text-xl text-slate-500 max-w-3xl mx-auto leading-relaxed">
            {getText(survey.description)}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            <span>Step {currentStep + 1} of {totalSteps}</span>
            <span>{progress}% Completed</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-brand-600 h-2 rounded-full transition-all duration-700 ease-in-out shadow-[0_0_10px_rgba(124,58,237,0.5)]" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        {/* Step Indicators */}
        <div className="mt-8 flex justify-center gap-2 overflow-x-auto pb-2 no-scrollbar mask-gradient">
           {survey.sections.map((section, idx) => {
              const isActive = idx === currentStep;
              const isCompleted = idx < currentStep;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => {
                    setDirection(idx > currentStep ? 'forward' : 'backward');
                    setCurrentStep(idx);
                  }}
                  className={`group flex items-center px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 whitespace-nowrap flex-shrink-0
                    ${isActive 
                      ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200 shadow-sm' 
                      : isCompleted 
                      ? 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200' 
                      : 'bg-white text-slate-400 border border-transparent hover:bg-slate-50'
                    }`}
                >
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center mr-2 text-xs font-bold transition-colors
                    ${isActive ? 'bg-brand-600 text-white' : isCompleted ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-400'}
                  `}>
                    {isCompleted ? <Check size={14} /> : idx + 1}
                  </span>
                  {getText(section.title)}
                </button>
              );
            })}
        </div>
      </div>

      {/* Active Section */}
      <div 
        key={currentSection.id}
        className={`bg-white rounded-3xl shadow-soft border border-slate-100 overflow-hidden min-h-[400px] animate-slide-up`}
      >
        <div className="bg-slate-50/50 px-8 py-6 border-b border-slate-100 flex items-center">
            <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center font-bold text-xl mr-4 shadow-sm">
                {currentStep + 1}
            </div>
            <h2 className="text-2xl font-bold text-slate-800">{getText(currentSection.title)}</h2>
        </div>
        
        <div className="p-8 md:p-12 space-y-12">
          {currentSection.questions.map((q, qIdx) => (
            <div key={q.id} className="space-y-4 animate-fade-in" style={{ animationDelay: `${qIdx * 0.1}s` }}>
              <div className="flex flex-col md:flex-row md:items-start gap-4">
                  <span className="flex-shrink-0 text-sm font-bold text-slate-400 mt-1.5 uppercase tracking-wide">
                      Q{currentStep + 1}.{qIdx + 1}
                  </span>
                  <div className="flex-1 space-y-2">
                    <label className="block text-xl font-semibold text-slate-800 leading-snug">
                        {getText(q.text)}
                        {q.required && <span className="text-rose-500 ml-1.5 text-lg" title="Required">*</span>}
                    </label>
                    {q.type === 'description' && (
                        <div className="text-slate-600 leading-relaxed whitespace-pre-wrap bg-slate-50 p-4 rounded-xl border border-slate-100 text-base">
                            {getText(q.default_value) || getText(q.placeholder)}
                        </div>
                    )}
                  </div>
              </div>

              <div className="md:ml-12">
                {/* Text Inputs */}
                {(q.type === 'short_text' || q.type === 'number') && (
                  <div className="relative group max-w-2xl">
                    <input
                      type={q.type === 'number' ? 'number' : 'text'}
                      className="w-full px-5 py-4 rounded-xl border border-slate-200 bg-white text-slate-800 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all outline-none placeholder:text-slate-300 font-medium"
                      placeholder={getText(q.placeholder)}
                      value={answers[q.id] as string || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => onAnswerChange(q.id, e.target.value, q.type)}
                      required={q.required}
                      disabled={readOnly}
                    />
                  </div>
                )}

                {/* Long Text */}
                {q.type === 'long_text' && (
                  <div className="relative group max-w-3xl">
                    <textarea
                      className="w-full px-5 py-4 rounded-xl border border-slate-200 bg-white text-slate-800 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all outline-none placeholder:text-slate-300 min-h-[160px] font-medium resize-y"
                      placeholder={getText(q.placeholder)}
                      value={answers[q.id] as string || ''}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onAnswerChange(q.id, e.target.value, q.type)}
                      required={q.required}
                      disabled={readOnly}
                    />
                  </div>
                )}

                {/* Single Choice */}
                {q.type === 'single_choice' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-4xl">
                    {q.options?.map((opt) => (
                      <label key={opt.value} className={`relative flex items-center p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200 group overflow-hidden
                        ${answers[q.id] === opt.value 
                          ? 'bg-brand-50/50 border-brand-500 shadow-sm' 
                          : 'border-slate-100 hover:border-brand-200 hover:bg-slate-50'}
                        ${readOnly ? 'cursor-default opacity-80' : ''}`}
                      >
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-4 transition-colors flex-shrink-0
                            ${answers[q.id] === opt.value ? 'border-brand-600' : 'border-slate-300 group-hover:border-brand-300'}`}>
                            {answers[q.id] === opt.value && <div className="w-2.5 h-2.5 rounded-full bg-brand-600" />}
                        </div>
                        <input
                          type="radio"
                          name={q.id}
                          value={opt.value}
                          checked={answers[q.id] === opt.value}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onAnswerChange(q.id, e.target.value, q.type)}
                          className="sr-only"
                          required={q.required}
                          disabled={readOnly}
                        />
                        <span className={`text-base font-medium ${answers[q.id] === opt.value ? 'text-brand-900' : 'text-slate-600'}`}>
                          {getText(opt.label)}
                        </span>
                      </label>
                    ))}
                  </div>
                )}

                {/* Multiple Choice */}
                {q.type === 'multiple_choice' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-4xl">
                    {q.options?.map((opt) => {
                      const isChecked = (answers[q.id] as string[] || []).includes(opt.value);
                      return (
                        <label key={opt.value} className={`relative flex items-center p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200 group
                          ${isChecked
                            ? 'bg-brand-50/50 border-brand-500 shadow-sm' 
                            : 'border-slate-100 hover:border-brand-200 hover:bg-slate-50'}
                          ${readOnly ? 'cursor-default opacity-80' : ''}`}
                        >
                           <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center mr-4 transition-colors flex-shrink-0
                            ${isChecked ? 'border-brand-600 bg-brand-600' : 'border-slate-300 group-hover:border-brand-300'}`}>
                            {isChecked && <Check size={14} className="text-white" />}
                        </div>
                          <input
                            type="checkbox"
                            value={opt.value}
                            checked={isChecked}
                            onChange={() => onAnswerChange(q.id, opt.value, q.type)}
                            className="sr-only"
                            disabled={readOnly}
                          />
                          <span className={`text-base font-medium ${isChecked ? 'text-brand-900' : 'text-slate-600'}`}>
                            {getText(opt.label)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-200 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] z-50 md:static md:bg-transparent md:border-none md:shadow-none md:p-0 md:pt-8 md:mt-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
            <button
            type="button"
            onClick={handlePrev}
            disabled={currentStep === 0}
            className={`flex-1 md:flex-none flex items-center justify-center px-6 py-4 rounded-2xl font-bold transition-all
                ${currentStep === 0 
                ? 'text-slate-300 cursor-not-allowed' 
                : 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:shadow-md active:scale-95'}`}
            >
            <ChevronLeft size={20} className="mr-2" />
            <span className="hidden sm:inline">Previous Step</span>
            <span className="inline sm:hidden">Prev</span>
            </button>

            <div className="flex gap-4 flex-1 md:flex-none justify-end">
                {!readOnly && onSave && (
                <button
                    type="button"
                    onClick={onSave}
                    className="flex items-center justify-center px-6 py-4 rounded-2xl font-bold text-brand-700 bg-brand-50 border border-brand-200 hover:bg-brand-100 hover:shadow-md transition-all active:scale-95"
                    title="Save Progress"
                >
                    <Save size={20} className="md:mr-2" />
                    <span className="hidden md:inline">Save</span>
                </button>
                )}

                {currentStep < totalSteps - 1 ? (
                <button
                    type="button"
                    onClick={handleNext}
                    className="flex-1 md:flex-none flex items-center justify-center px-8 py-4 bg-brand-600 text-white rounded-2xl font-bold shadow-lg hover:shadow-brand-500/30 hover:bg-brand-700 transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-95 min-w-[140px]"
                >
                    <span className="hidden sm:inline">Next Step</span>
                    <span className="inline sm:hidden">Next</span>
                    <ChevronRight size={20} className="ml-2" />
                </button>
                ) : (
                !readOnly && (
                    <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 md:flex-none flex items-center justify-center px-8 py-4 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-2xl font-bold shadow-lg hover:shadow-green-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed min-w-[140px]"
                    >
                    {isSubmitting ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                            <span>Sending...</span>
                        </>
                    ) : (
                        <>
                            <span>Submit Survey</span>
                            <Check size={20} className="ml-2" />
                        </>
                    )}
                    </button>
                )
                )}
            </div>
        </div>
      </div>
    </form>
  );
}
