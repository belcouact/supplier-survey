import React from 'react';
import { SurveySchema, SurveyAnswers, QuestionType, Language, LocalizedText } from '../types';

interface SurveyFormProps {
  survey: SurveySchema;
  answers: SurveyAnswers;
  language: Language;
  onAnswerChange: (qId: string, value: any, type: QuestionType) => void;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting?: boolean;
}

export function SurveyForm({ 
  survey, 
  answers, 
  language, 
  onAnswerChange, 
  onSubmit,
  isSubmitting = false
}: SurveyFormProps) {

  const getText = (content: LocalizedText | string | undefined): string => {
    if (!content) return '';
    if (typeof content === 'string') return content;
    return content[language] || content.en || '';
  };

  const fontClass = language === Language.SC ? 'font-sc' : language === Language.TC ? 'font-tc' : 'font-sans';

  return (
    <form onSubmit={onSubmit} className={`max-w-3xl mx-auto space-y-8 animate-fade-in ${fontClass}`}>
      {/* Header */}
      <div className="text-center mb-10 space-y-2">
        <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
          {getText(survey.title)}
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          {getText(survey.description)}
        </p>
      </div>

      {/* Sections */}
      {survey.sections.map((section, sIdx) => (
        <div key={section.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all hover:shadow-md">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-100">
            <h2 className="text-xl font-bold text-slate-800">{getText(section.title)}</h2>
          </div>
          
          <div className="p-6 space-y-6">
            {section.questions.map((q, qIdx) => (
              <div key={q.id} className="space-y-3">
                <label className="block text-base font-semibold text-gray-800">
                  <span className="text-gray-400 mr-2 text-sm">{sIdx + 1}.{qIdx + 1}</span>
                  {getText(q.text)}
                  {q.required && <span className="text-red-500 ml-1">*</span>}
                </label>

                <div className="mt-2">
                  {/* Text Inputs */}
                  {(q.type === 'short_text' || q.type === 'number') && (
                    <input
                      type={q.type === 'number' ? 'number' : 'text'}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-gray-50 focus:bg-white"
                      placeholder={getText(q.placeholder)}
                      value={answers[q.id] as string || ''}
                      onChange={(e) => onAnswerChange(q.id, e.target.value, q.type)}
                      required={q.required}
                    />
                  )}

                  {/* Long Text */}
                  {q.type === 'long_text' && (
                    <textarea
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-gray-50 focus:bg-white min-h-[120px]"
                      placeholder={getText(q.placeholder)}
                      value={answers[q.id] as string || ''}
                      onChange={(e) => onAnswerChange(q.id, e.target.value, q.type)}
                      required={q.required}
                    />
                  )}

                  {/* Single Choice */}
                  {q.type === 'single_choice' && (
                    <div className="space-y-2">
                      {q.options?.map((opt) => (
                        <label key={opt.value} className="flex items-center p-3 rounded-lg border border-gray-200 hover:bg-blue-50 hover:border-blue-200 cursor-pointer transition-all group">
                          <input
                            type="radio"
                            name={q.id}
                            value={opt.value}
                            checked={answers[q.id] === opt.value}
                            onChange={(e) => onAnswerChange(q.id, e.target.value, q.type)}
                            className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                            required={q.required}
                          />
                          <span className="ml-3 text-gray-700 group-hover:text-blue-700">{getText(opt.label)}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* Multiple Choice */}
                  {q.type === 'multiple_choice' && (
                    <div className="space-y-2">
                      {q.options?.map((opt) => (
                        <label key={opt.value} className="flex items-center p-3 rounded-lg border border-gray-200 hover:bg-blue-50 hover:border-blue-200 cursor-pointer transition-all group">
                          <input
                            type="checkbox"
                            value={opt.value}
                            checked={(answers[q.id] as string[] || []).includes(opt.value)}
                            onChange={() => onAnswerChange(q.id, opt.value, q.type)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="ml-3 text-gray-700 group-hover:text-blue-700">{getText(opt.label)}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Submit Button */}
      <div className="pt-6 pb-12">
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full md:w-auto md:min-w-[200px] px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-lg font-bold rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed mx-auto block"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Survey'}
        </button>
      </div>
    </form>
  );
}
