import React, { useState, useEffect } from 'react';
import { generateSurvey } from './services/aiService';
import { saveSurveyTemplate } from './services/templateService';
import { Language, SurveySchema, SurveyAnswers, QuestionType } from './types';

export default function App() {
  // --- State ---
  const [language, setLanguage] = useState<Language>(Language.EN);
  const [userContext, setUserContext] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [generatedSurvey, setGeneratedSurvey] = useState<SurveySchema | null>(null);
  const [answers, setAnswers] = useState<SurveyAnswers>({});
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Editing State ---
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [tempSectionTitle, setTempSectionTitle] = useState('');

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

  // --- Section Management ---
  const handleMoveSection = (index: number, direction: 'up' | 'down') => {
    if (!generatedSurvey) return;
    const sections = [...generatedSurvey.sections];
    
    if (direction === 'up' && index > 0) {
      [sections[index], sections[index - 1]] = [sections[index - 1], sections[index]];
    } else if (direction === 'down' && index < sections.length - 1) {
      [sections[index], sections[index + 1]] = [sections[index + 1], sections[index]];
    }
    
    setGeneratedSurvey({ ...generatedSurvey, sections });
  };

  const handleDeleteSection = (index: number) => {
    if (!generatedSurvey) return;
    if (!window.confirm('Are you sure you want to delete this section?')) return;
    
    const sections = generatedSurvey.sections.filter((_, i) => i !== index);
    setGeneratedSurvey({ ...generatedSurvey, sections });
  };

  const handleStartEdit = (sectionId: string, currentTitle: string) => {
    setEditingSectionId(sectionId);
    setTempSectionTitle(currentTitle);
  };

  const handleSaveEdit = () => {
    if (!generatedSurvey || !editingSectionId) return;
    
    const sections = generatedSurvey.sections.map(section => {
      if (section.id === editingSectionId) {
        return { ...section, title: tempSectionTitle };
      }
      return section;
    });
    
    setGeneratedSurvey({ ...generatedSurvey, sections });
    setEditingSectionId(null);
    setTempSectionTitle('');
  };

  const handleCancelEdit = () => {
    setEditingSectionId(null);
    setTempSectionTitle('');
  };

  const handleSaveTemplate = async () => {
    if (!generatedSurvey) return;
    
    try {
      setIsSaving(true);
      await saveSurveyTemplate(generatedSurvey);
      alert('Template saved successfully!');
      // Optional: Redirect or reset
    } catch (err) {
      alert('Failed to save template. Please check console for details.');
    } finally {
      setIsSaving(false);
    }
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
                    {/* Section Header with Controls */}
                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                      {editingSectionId === section.id ? (
                        <div className="flex items-center space-x-2 w-full">
                          <input
                            type="text"
                            value={tempSectionTitle}
                            onChange={(e) => setTempSectionTitle(e.target.value)}
                            className="flex-1 px-3 py-1 rounded border border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                          />
                          <button onClick={handleSaveEdit} className="text-green-600 hover:text-green-800 font-medium text-sm">Save</button>
                          <button onClick={handleCancelEdit} className="text-gray-500 hover:text-gray-700 font-medium text-sm">Cancel</button>
                        </div>
                      ) : (
                        <h2 className="text-xl font-bold text-slate-800">{section.title}</h2>
                      )}
                      
                      {/* Controls */}
                      <div className="flex items-center space-x-2 ml-4">
                        <button 
                          type="button"
                          onClick={() => handleMoveSection(sIdx, 'up')}
                          disabled={sIdx === 0}
                          className={`p-1 rounded hover:bg-gray-200 ${sIdx === 0 ? 'text-gray-300' : 'text-gray-600'}`}
                          title="Move Up"
                        >
                          ↑
                        </button>
                        <button 
                          type="button"
                          onClick={() => handleMoveSection(sIdx, 'down')}
                          disabled={sIdx === generatedSurvey.sections.length - 1}
                          className={`p-1 rounded hover:bg-gray-200 ${sIdx === generatedSurvey.sections.length - 1 ? 'text-gray-300' : 'text-gray-600'}`}
                          title="Move Down"
                        >
                          ↓
                        </button>
                        <button 
                          type="button"
                          onClick={() => handleStartEdit(section.id, section.title)}
                          className="p-1 rounded hover:bg-gray-200 text-blue-600"
                          title="Edit Title"
                        >
                          ✎
                        </button>
                        <button 
                          type="button"
                          onClick={() => handleDeleteSection(sIdx)}
                          className="p-1 rounded hover:bg-red-100 text-red-600"
                          title="Delete Section"
                        >
                          🗑
                        </button>
                      </div>
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
                    type="button"
                    onClick={handleSaveTemplate}
                    disabled={isSaving}
                    className={`px-8 py-3 bg-gradient-to-r from-green-600 to-teal-600 text-white font-bold rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all transform focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 flex items-center space-x-2 ${isSaving ? 'opacity-75 cursor-wait' : ''}`}
                  >
                    {isSaving ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Saving Template...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg>
                        <span>Save as Template</span>
                      </>
                    )}
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