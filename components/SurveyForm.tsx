import React, { useState, useEffect } from 'react';
import { SurveySchema, SurveyAnswers, QuestionType, Language, LocalizedText } from '../types';
import { Check, ChevronRight, ChevronLeft } from 'lucide-react';

interface SurveyFormProps {
  survey: SurveySchema;
  answers: SurveyAnswers;
  language: Language;
  onAnswerChange: (qId: string, value: any, type: QuestionType) => void;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting?: boolean;
  readOnly?: boolean;
}

export function SurveyForm({ 
  survey, 
  answers, 
  language, 
  onAnswerChange, 
  onSubmit,
  isSubmitting = false,
  readOnly = false
}: SurveyFormProps) {
  const [currentStep, setCurrentStep] = useState(0);

  // Reset step if survey changes
  useEffect(() => {
    setCurrentStep(0);
  }, [survey.id]);

  const getText = (content: LocalizedText | string | undefined): string => {
    if (!content) return '';
    if (typeof content === 'string') return content;
    return content[language] || content.en || '';
  };

  const fontClass = language === Language.SC ? 'font-sc' : language === Language.TC ? 'font-tc' : 'font-sans';
  const totalSteps = survey.sections.length;
  const progress = Math.round(((currentStep + 1) / totalSteps) * 100);

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const tabsContainerRef = React.useRef<HTMLDivElement>(null);

  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabsContainerRef.current) {
        const scrollAmount = 200;
        const currentScroll = tabsContainerRef.current.scrollLeft;
        const newScroll = direction === 'right' ? currentScroll + scrollAmount : currentScroll - scrollAmount;
        
        tabsContainerRef.current.scrollTo({
            left: newScroll,
            behavior: 'smooth'
        });
    }
  };

  const currentSection = survey.sections[currentStep];

  if (!currentSection) {
    return <div className="text-center p-8 text-gray-500">No sections available in this survey.</div>;
  }

  return (
    <form onSubmit={onSubmit} className={`max-w-6xl mx-auto space-y-8 animate-fade-in ${fontClass}`}>
      
      {/* Header & Progress */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8 mb-8">
        <div className="text-center mb-8 space-y-2">
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
            {getText(survey.title)}
          </h1>
          <p className="text-lg text-slate-600 max-w-3xl mx-auto">
            {getText(survey.description)}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="max-w-3xl mx-auto">
          <div className="flex justify-between text-sm font-medium text-gray-500 mb-2">
            <span>Section {currentStep + 1} of {totalSteps}</span>
            <span>{progress}% Completed</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
            <div 
              className="bg-blue-600 h-3 rounded-full transition-all duration-500 ease-out" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        {/* Tabs / Stepper */}
        <div className="mt-8 flex items-center justify-center gap-2">
            <button 
                type="button"
                onClick={() => scrollTabs('left')}
                className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors flex-shrink-0"
            >
                <ChevronLeft size={20} />
            </button>

            <div 
                ref={tabsContainerRef}
                className="flex overflow-x-auto pb-2 gap-2 no-scrollbar scroll-smooth w-full md:w-auto px-1"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                <style>{`
                    .no-scrollbar::-webkit-scrollbar {
                        display: none;
                    }
                `}</style>
                {survey.sections.map((section, idx) => {
                    const isActive = idx === currentStep;
                    const isCompleted = idx < currentStep;
                    return (
                    <button
                        key={section.id}
                        type="button"
                        onClick={() => setCurrentStep(idx)}
                        className={`flex-shrink-0 flex items-center px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap
                        ${isActive 
                            ? 'bg-blue-600 text-white shadow-md' 
                            : isCompleted 
                            ? 'bg-blue-50 text-blue-700 hover:bg-blue-100' 
                            : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                        }`}
                    >
                        {isCompleted && <Check size={14} className="mr-1.5" />}
                        <span className="mr-2">{idx + 1}.</span>
                        {getText(section.title)}
                    </button>
                    );
                })}
            </div>

            <button 
                type="button"
                onClick={() => scrollTabs('right')}
                className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors flex-shrink-0"
            >
                <ChevronRight size={20} />
            </button>
        </div>
      </div>

      {/* Active Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all min-h-[400px]">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-100">
          <h2 className="text-2xl font-bold text-slate-800">{getText(currentSection.title)}</h2>
        </div>
        
        <div className="p-6 md:p-10 space-y-8">
          {currentSection.questions.map((q, qIdx) => (
            <div key={q.id} className="space-y-3 pb-6 border-b border-gray-100 last:border-0 last:pb-0">
              <label className="block text-lg font-semibold text-gray-800">
                <span className="text-gray-400 mr-3 text-base">{currentStep + 1}.{qIdx + 1}</span>
                {getText(q.text)}
                {q.required && <span className="text-red-500 ml-1">*</span>}
              </label>

              <div className="mt-3 ml-0 md:ml-8">
                {/* Text Inputs */}
                {(q.type === 'short_text' || q.type === 'number') && (
                  <input
                    type={q.type === 'number' ? 'number' : 'text'}
                    className="w-full max-w-2xl px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-gray-50 focus:bg-white disabled:bg-gray-100 disabled:text-gray-500"
                    placeholder={getText(q.placeholder)}
                    value={answers[q.id] as string || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => onAnswerChange(q.id, e.target.value, q.type)}
                    required={q.required}
                    disabled={readOnly}
                  />
                )}

                {/* Long Text */}
                {q.type === 'long_text' && (
                  <textarea
                    className="w-full max-w-3xl px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-gray-50 focus:bg-white min-h-[120px] disabled:bg-gray-100 disabled:text-gray-500"
                    placeholder={getText(q.placeholder)}
                    value={answers[q.id] as string || ''}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onAnswerChange(q.id, e.target.value, q.type)}
                    required={q.required}
                    disabled={readOnly}
                  />
                )}

                {/* Single Choice */}
                {q.type === 'single_choice' && (
                  <div className="space-y-3 max-w-3xl">
                    {q.options?.map((opt) => (
                      <label key={opt.value} className={`flex items-center p-4 rounded-xl border cursor-pointer transition-all group
                        ${answers[q.id] === opt.value 
                          ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-500' 
                          : 'border-gray-200 hover:bg-gray-50 hover:border-gray-300'}
                        ${readOnly ? 'cursor-default opacity-80' : ''}`}
                      >
                        <input
                          type="radio"
                          name={q.id}
                          value={opt.value}
                          checked={answers[q.id] === opt.value}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onAnswerChange(q.id, e.target.value, q.type)}
                          className="w-5 h-5 text-blue-600 border-gray-300 focus:ring-blue-500 disabled:text-gray-400"
                          required={q.required}
                          disabled={readOnly}
                        />
                        <span className={`ml-3 text-base ${answers[q.id] === opt.value ? 'text-blue-900 font-medium' : 'text-gray-700'}`}>
                          {getText(opt.label)}
                        </span>
                      </label>
                    ))}
                  </div>
                )}

                {/* Multiple Choice */}
                {q.type === 'multiple_choice' && (
                  <div className="space-y-3 max-w-3xl">
                    {q.options?.map((opt) => {
                      const isChecked = (answers[q.id] as string[] || []).includes(opt.value);
                      return (
                        <label key={opt.value} className={`flex items-center p-4 rounded-xl border cursor-pointer transition-all group
                          ${isChecked
                            ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-500' 
                            : 'border-gray-200 hover:bg-gray-50 hover:border-gray-300'}
                          ${readOnly ? 'cursor-default opacity-80' : ''}`}
                        >
                          <input
                            type="checkbox"
                            value={opt.value}
                            checked={isChecked}
                            onChange={() => onAnswerChange(q.id, opt.value, q.type)}
                            className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:text-gray-400"
                            disabled={readOnly}
                          />
                          <span className={`ml-3 text-base ${isChecked ? 'text-blue-900 font-medium' : 'text-gray-700'}`}>
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
      <div className="flex items-center justify-between pt-6 pb-12">
        <button
          type="button"
          onClick={handlePrev}
          disabled={currentStep === 0}
          className={`flex items-center px-6 py-3 rounded-xl font-medium transition-all
            ${currentStep === 0 
              ? 'text-gray-300 cursor-not-allowed' 
              : 'text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 shadow-sm hover:shadow'}`}
        >
          <ChevronLeft size={20} className="mr-2" />
          Previous
        </button>

        {currentStep < totalSteps - 1 ? (
          <button
            type="button"
            onClick={handleNext}
            className="flex items-center px-8 py-3 bg-blue-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl hover:bg-blue-700 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            Next Section
            <ChevronRight size={20} className="ml-2" />
          </button>
        ) : (
          !readOnly && (
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Survey'}
              <Check size={20} className="ml-2" />
            </button>
          )
        )}
      </div>
    </form>
  );
}
