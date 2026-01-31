import React, { useState, useEffect } from 'react';
import { generateSurvey } from './services/aiService';
import { Language, SurveySchema, SurveyAnswers, QuestionType } from './types';

export default function App() {
  // --- State ---
  const [language, setLanguage] = useState<Language>(Language.EN);
  const [userContext, setUserContext] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSurvey, setGeneratedSurvey] = useState<SurveySchema | null>(null);
  const [answers, setAnswers] = useState<SurveyAnswers>({});
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Auto-detect Language ---
  useEffect(() => {
    const browserLang = navigator.language.toLowerCase();
    if (browserLang.includes('zh-tw') || browserLang.includes('zh-hk')) {
      setLanguage(Language.TC);
    } else if (browserLang.includes('zh')) {
      setLanguage(Language.SC);
    } else {
      setLanguage(Language.EN);
    }
  }, []);

  // --- AI Generation Logic ---
  const handleGenerate = async () => {
    if (!userContext.trim()) return;
    
    setIsGenerating(true);
    setError(null);
    setGeneratedSurvey(null);
    setAnswers({});
    setFormSubmitted(false);

    try {
      const langName = language === Language.EN ? 'English' : language === Language.SC ? 'Simplified Chinese' : 'Traditional Chinese';
      
      const surveyData = await generateSurvey(userContext, langName);
      setGeneratedSurvey(surveyData);

    } catch (err: any) {
      console.error("Generation Error:", err);
      // More friendly error message
      setError(`Failed to generate survey. Error: ${err.message || 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // --- Form Handling ---
  const handleAnswerChange = (qId: string, value: any, type: QuestionType) => {
    setAnswers(prev => {
      const newAnswers = { ...prev };
      
      if (type === 'multiple_choice') {
        // Handle checkbox array logic
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitted(true);
    console.log("Submitted Answers:", answers);
    // Scroll to top to see success message
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- UI Components ---
  
  const fontClass = language === Language.SC ? 'font-sc' : language === Language.TC ? 'font-tc' : 'font-sans';

  return (
    <div className={`min-h-screen bg-gray-50 text-slate-800 ${fontClass}`}>
      
      {/* Header / Nav */}
      <nav className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50 flex justify-between items-center shadow-sm">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
            AI
          </div>
          <span className="font-semibold text-lg hidden sm:block">SurveyGen</span>
        </div>

        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
          {(['en', 'sc', 'tc'] as Language[]).map((lang) => (
            <button
              key={lang}
              onClick={() => setLanguage(lang)}
              className={`px-3 py-1 rounded-md text-xs sm:text-sm font-medium transition-all ${
                language === lang ? 'bg-white text-blue-600 shadow' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {lang === Language.EN && 'EN'}
              {lang === Language.SC && '简体'}
              {lang === Language.TC && '繁體'}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-8">
        
        {/* State: Landing / Input */}
        {!generatedSurvey && !isGenerating && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 animate-fade-in-up">
            <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight">
              Build Expert Supplier Surveys <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                in Seconds
              </span>
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl">
              Describe your supplier, industry, and goals. Our AI will craft a comprehensive, professional vetting questionnaire tailored to your needs.
            </p>

            <div className="w-full max-w-2xl bg-white p-2 rounded-2xl shadow-xl border border-gray-100 transform transition-all hover:scale-[1.01]">
              <textarea
                value={userContext}
                onChange={(e) => setUserContext(e.target.value)}
                placeholder="e.g. I need to audit a fabric mill in Bangladesh producing organic cotton jersey. Focus on social compliance and water treatment capabilities."
                className="w-full p-4 text-gray-700 text-lg rounded-xl focus:outline-none resize-none min-h-[120px]"
              />
              <div className="flex justify-between items-center px-4 pb-2">
                 <span className="text-xs text-gray-400 uppercase tracking-wide font-semibold">
                    Powered by Gemini 2.5
                 </span>
                 <button
                  onClick={handleGenerate}
                  disabled={!userContext.trim()}
                  className={`px-6 py-2.5 rounded-xl font-semibold text-white transition-all transform flex items-center space-x-2
                    ${!userContext.trim() 
                      ? 'bg-gray-300 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0'}`}
                >
                  <span>Generate Survey</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>

            {error && (
              <div className="text-red-500 bg-red-50 px-4 py-2 rounded-lg border border-red-100">
                {error}
              </div>
            )}
          </div>
        )}

        {/* State: Loading */}
        {isGenerating && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-6">
            <div className="relative w-20 h-20">
              <div className="absolute top-0 left-0 w-full h-full border-4 border-blue-200 rounded-full animate-ping opacity-75"></div>
              <div className="absolute top-0 left-0 w-full h-full border-4 border-t-blue-600 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-xl font-semibold text-slate-800">Designing your survey...</h3>
              <p className="text-gray-500">Analyzing industry standards for: <span className="italic">"{userContext.slice(0, 30)}..."</span></p>
            </div>
          </div>
        )}

        {/* State: Generated Survey */}
        {generatedSurvey && (
          <div className="animate-fade-in">
            {/* Control Bar */}
            <div className="flex justify-between items-center mb-6">
              <button 
                onClick={() => setGeneratedSurvey(null)}
                className="text-gray-500 hover:text-gray-800 flex items-center text-sm font-medium"
              >
                ← Create New
              </button>
              {!formSubmitted && (
                 <span className="text-sm bg-blue-50 text-blue-700 px-3 py-1 rounded-full border border-blue-100">
                   Preview Mode
                 </span>
              )}
            </div>

            {formSubmitted ? (
              <div className="text-center bg-white p-12 rounded-2xl shadow-sm border border-green-100">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Survey Completed!</h2>
                <p className="text-gray-600 mb-6">Thank you for submitting your responses. The data has been captured.</p>
                <button 
                  onClick={() => setFormSubmitted(false)}
                  className="text-blue-600 font-medium hover:underline"
                >
                  Edit Responses
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Title Card */}
                <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200 border-t-4 border-t-blue-600">
                  <h1 className="text-3xl font-bold text-slate-900 mb-2">{generatedSurvey.title}</h1>
                  <p className="text-gray-600 text-lg leading-relaxed">{generatedSurvey.description}</p>
                </div>

                {/* Sections */}
                {generatedSurvey.sections.map((section, sIdx) => (
                  <div key={section.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-100">
                      <h2 className="text-xl font-bold text-slate-800">{section.title}</h2>
                    </div>
                    
                    <div className="p-6 space-y-8">
                      {section.questions.map((q) => (
                        <div key={q.id} className="space-y-3">
                          <label className="block text-base font-semibold text-gray-800">
                            {q.text}
                            {q.required && <span className="text-red-500 ml-1">*</span>}
                          </label>

                          {/* Render Input Based on Type */}
                          <div className="mt-2">
                            {q.type === 'short_text' && (
                              <input 
                                type="text"
                                required={q.required}
                                placeholder={q.placeholder}
                                value={answers[q.id] as string || ''}
                                onChange={(e) => handleAnswerChange(q.id, e.target.value, q.type)}
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                              />
                            )}

                            {q.type === 'long_text' && (
                              <textarea 
                                required={q.required}
                                placeholder={q.placeholder}
                                rows={3}
                                value={answers[q.id] as string || ''}
                                onChange={(e) => handleAnswerChange(q.id, e.target.value, q.type)}
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                              />
                            )}

                            {q.type === 'number' && (
                              <input 
                                type="number"
                                required={q.required}
                                placeholder={q.placeholder}
                                value={answers[q.id] as string || ''}
                                onChange={(e) => handleAnswerChange(q.id, e.target.value, q.type)}
                                className="w-full md:w-1/2 px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                              />
                            )}

                            {q.type === 'single_choice' && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {q.options?.map((opt) => (
                                  <label 
                                    key={opt.value} 
                                    className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${
                                      answers[q.id] === opt.value 
                                        ? 'border-blue-500 bg-blue-50 text-blue-700' 
                                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                    }`}
                                  >
                                    <input 
                                      type="radio" 
                                      name={q.id}
                                      value={opt.value}
                                      required={q.required}
                                      checked={answers[q.id] === opt.value}
                                      onChange={(e) => handleAnswerChange(q.id, opt.value, q.type)}
                                      className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                                    />
                                    <span className="ml-2 text-sm font-medium">{opt.label}</span>
                                  </label>
                                ))}
                              </div>
                            )}

                            {q.type === 'multiple_choice' && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {q.options?.map((opt) => {
                                  const isChecked = (answers[q.id] as string[] || []).includes(opt.value);
                                  return (
                                    <label 
                                      key={opt.value} 
                                      className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${
                                        isChecked
                                          ? 'border-blue-500 bg-blue-50 text-blue-700' 
                                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                      }`}
                                    >
                                      <input 
                                        type="checkbox" 
                                        name={q.id}
                                        value={opt.value}
                                        checked={isChecked}
                                        onChange={() => handleAnswerChange(q.id, opt.value, q.type)}
                                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                                      />
                                      <span className="ml-2 text-sm font-medium">{opt.label}</span>
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
                ))}

                <div className="flex justify-end pt-6 pb-20">
                  <button
                    type="submit"
                    className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all transform focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Submit Survey Response
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </main>
    </div>
  );
}