import React, { useState, useEffect, useRef } from 'react';
import { generateSurvey, chatWithAI } from './services/aiService';
import { saveSurveyTemplate, getTemplates } from './services/templateService';
import { Language, SurveySchema, SurveyAnswers, QuestionType, SurveyQuestion, SurveyOption, LocalizedText, ChatMessage } from './types';

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
  const [templates, setTemplates] = useState<any[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [showAIModal, setShowAIModal] = useState(false);

  // --- Chat State ---
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- Editing State ---
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [tempSectionTitle, setTempSectionTitle] = useState('');
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [tempQuestion, setTempQuestion] = useState<SurveyQuestion | null>(null);

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

  // --- Fetch Templates ---
  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    if (isChatOpen && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isChatOpen]);

  const loadTemplates = async () => {
    try {
      setIsLoadingTemplates(true);
      const data = await getTemplates();
      setTemplates(data || []);
    } catch (err) {
      console.error('Failed to load templates', err);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  // --- Helper: History Management ---
  const pushToHistory = () => {
    if (generatedSurvey) {
      setPastHistory(prev => [...prev, generatedSurvey]);
    }
  };

  const handleUndo = () => {
    if (pastHistory.length === 0) return;
    const newHistory = [...pastHistory];
    const previousState = newHistory.pop();
    setGeneratedSurvey(previousState || null);
    setPastHistory(newHistory);
    // Reset editing states to avoid conflicts
    setEditingSectionId(null);
    setEditingQuestionId(null);
  };

  // --- Helper: Get Localized Text ---
  const getText = (content: LocalizedText | string | undefined): string => {
    if (!content) return '';
    if (typeof content === 'string') return content;
    return content[language] || content.en || '';
  };

  // --- AI Generation Logic ---
  const handleGenerate = async () => {
    if (!userContext.trim()) return;
    
    setIsGenerating(true);
    setError(null);
    setGeneratedSurvey(null);
    setAnswers({});
    setFormSubmitted(false);

    try {
      // Now generates all 3 languages
      const surveyData = await generateSurvey(userContext);
      setGeneratedSurvey(surveyData);
      
      // Initialize Chat History
      setChatHistory([
        { role: 'user', content: userContext },
        { role: 'assistant', content: "I've generated the survey based on your request. Feel free to ask for any adjustments!" }
      ]);
      
      setShowAIModal(false); // Close modal on success
    } catch (err: any) {
      console.error("Generation Error:", err);
      setError(`Failed to generate survey. Error: ${err.message || 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleChatSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || !generatedSurvey) return;

    const userMsg = chatInput;
    setChatInput('');
    setIsChatLoading(true);

    // 1. Update UI with user message
    const newHistory: ChatMessage[] = [...chatHistory, { role: 'user', content: userMsg }];
    setChatHistory(newHistory);

    try {
        // 2. Call AI to refine the survey
        // We use the specialized refineSurvey function which handles context injection
        // We pass chatHistory (excluding current message) as context
        pushToHistory(); // Save state before AI update
        const updatedSurvey = await refineSurvey(generatedSurvey, userMsg, chatHistory);
        setGeneratedSurvey(updatedSurvey);
        
        // 3. Update history with success message
        setChatHistory([
            ...newHistory, 
            { role: 'assistant', content: "I've updated the survey based on your request." }
        ]);
    } catch (err) {
        console.error(err);
        setChatHistory([
            ...newHistory, 
            { role: 'assistant', content: "Sorry, I encountered an error while updating the survey. Please try again." }
        ]);
    } finally {
        setIsChatLoading(false);
    }
  };

  const handleLoadTemplate = (template: any) => {
    if (template.schema) {
      setGeneratedSurvey(template.schema);
      setAnswers({});
      setFormSubmitted(false);
      setChatHistory([]); // Reset chat for template
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // --- Form Handling ---
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitted(true);
    console.log("Submitted Answers:", answers);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- Section Management ---
  const handleMoveSection = (index: number, direction: 'up' | 'down') => {
    if (!generatedSurvey) return;
    pushToHistory();
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
    
    pushToHistory();
    const sections = generatedSurvey.sections.filter((_, i) => i !== index);
    setGeneratedSurvey({ ...generatedSurvey, sections });
  };

  const handleStartEdit = (sectionId: string, currentTitle: LocalizedText | string) => {
    setEditingSectionId(sectionId);
    setTempSectionTitle(getText(currentTitle));
  };

  const handleSaveEdit = () => {
    if (!generatedSurvey || !editingSectionId) return;
    
    const sections = generatedSurvey.sections.map(section => {
      if (section.id === editingSectionId) {
        // Update only the current language
        const newTitle = typeof section.title === 'string' 
            ? tempSectionTitle 
            : { ...section.title, [language]: tempSectionTitle };
        return { ...section, title: newTitle };
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

  // --- Question Editing ---
  const handleStartEditQuestion = (question: SurveyQuestion) => {
    setEditingQuestionId(question.id);
    setTempQuestion(JSON.parse(JSON.stringify(question)));
  };

  const handleSaveQuestion = () => {
    if (!generatedSurvey || !editingQuestionId || !tempQuestion) return;

    const sections = generatedSurvey.sections.map(section => {
      const questions = section.questions.map(q => {
        if (q.id === editingQuestionId) {
          return tempQuestion;
        }
        return q;
      });
      return { ...section, questions };
    });

    setGeneratedSurvey({ ...generatedSurvey, sections });
    setEditingQuestionId(null);
    setTempQuestion(null);
  };

  const handleCancelEditQuestion = () => {
    setEditingQuestionId(null);
    setTempQuestion(null);
  };

  const handleDeleteQuestion = (sectionId: string, questionId: string) => {
    if (!generatedSurvey) return;
    if (!window.confirm('Are you sure you want to delete this question?')) return;

    pushToHistory();
    const sections = generatedSurvey.sections.map(section => {
      if (section.id === sectionId) {
        return {
          ...section,
          questions: section.questions.filter(q => q.id !== questionId)
        };
      }
      return section;
    });

    setGeneratedSurvey({ ...generatedSurvey, sections });
  };

  const updateTempQuestion = (field: keyof SurveyQuestion, value: any) => {
    if (!tempQuestion) return;
    setTempQuestion({ ...tempQuestion, [field]: value });
  };

  // Specialized updaters for localized fields
  const updateTempQuestionText = (value: string) => {
    if (!tempQuestion) return;
    setTempQuestion({
        ...tempQuestion,
        text: { ...tempQuestion.text, [language]: value }
    });
  };

  const updateTempQuestionPlaceholder = (value: string) => {
    if (!tempQuestion) return;
    const currentPlaceholder = tempQuestion.placeholder || { en: '', sc: '', tc: '' };
    setTempQuestion({
        ...tempQuestion,
        placeholder: { ...currentPlaceholder, [language]: value }
    });
  };

  const updateTempOption = (idx: number, value: string) => {
    if (!tempQuestion || !tempQuestion.options) return;
    const newOptions = [...tempQuestion.options];
    // Update label for current language
    newOptions[idx] = { 
        ...newOptions[idx], 
        label: { ...newOptions[idx].label, [language]: value } 
    };
    
    // Auto-update value if empty (using the current language label as base)
    if (!newOptions[idx].value || newOptions[idx].value === '') {
       newOptions[idx].value = value; // Value stays string
    }
    setTempQuestion({ ...tempQuestion, options: newOptions });
  };

  const addTempOption = () => {
    if (!tempQuestion) return;
    const newOptions = [...(tempQuestion.options || []), { 
        label: { en: 'New Option', sc: '新选项', tc: '新選項' }, 
        value: `opt_${Date.now()}` 
    }];
    setTempQuestion({ ...tempQuestion, options: newOptions });
  };

  const removeTempOption = (idx: number) => {
    if (!tempQuestion || !tempQuestion.options) return;
    const newOptions = tempQuestion.options.filter((_, i) => i !== idx);
    setTempQuestion({ ...tempQuestion, options: newOptions });
  };

  const handleSaveTemplate = async () => {
    if (!generatedSurvey) return;
    try {
      setIsSaving(true);
      await saveSurveyTemplate(generatedSurvey);
      alert('Template saved successfully!');
      loadTemplates(); // Refresh list
    } catch (err) {
      alert('Failed to save template. Please check console for details.');
    } finally {
      setIsSaving(false);
    }
  };

  // --- UI Components ---
  const fontClass = language === Language.SC ? 'font-sc' : language === Language.TC ? 'font-tc' : 'font-sans';

  return (
    <div className={`min-h-screen bg-gray-50 text-slate-800 ${fontClass} flex flex-col`}>
      
      {/* Header / Nav */}
      <nav className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50 flex justify-between items-center shadow-sm">
        <div className="flex items-center space-x-4">
          <div 
            className="flex items-center space-x-2 cursor-pointer"
            onClick={() => setGeneratedSurvey(null)}
          >
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
              AI
            </div>
            <span className="font-semibold text-lg hidden sm:block">SurveyGen</span>
          </div>

          <button 
             onClick={() => setShowAIModal(true)}
             className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-2"
          >
             <span>✨ Create with AI</span>
          </button>
          
          <button 
             onClick={() => { setGeneratedSurvey(null); loadTemplates(); }}
             className="px-3 py-1.5 text-gray-600 hover:text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-2"
          >
             <span className="text-lg">📋</span>
             <span className="hidden sm:inline">Templates</span>
          </button>
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

      <main className="flex-1 flex overflow-hidden">
        
        {/* Main Content Area */}
        <div className={`flex-1 overflow-y-auto p-4 md:p-8 transition-all ${isChatOpen ? 'mr-80 md:mr-96' : ''}`}>
           <div className="max-w-4xl mx-auto">
                {/* State: Template List (Home) */}
                {!generatedSurvey && !isGenerating && (
                <div className="space-y-8 animate-fade-in">
                    <div className="text-center py-8">
                        <h1 className="text-3xl font-bold text-gray-900">Survey Templates</h1>
                        <p className="text-gray-500 mt-2">Select a template to start or create a new one with AI</p>
                    </div>

                    {isLoadingTemplates ? (
                        <div className="text-center py-12 text-gray-400">Loading templates...</div>
                    ) : templates.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
                            <p className="text-gray-500">No templates found. Create your first survey with AI!</p>
                            <button 
                                onClick={() => setShowAIModal(true)}
                                className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                Create with AI
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {templates.map((template) => (
                                <div 
                                    key={template.id} 
                                    onClick={() => handleLoadTemplate(template)}
                                    className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
                                >
                                    <h3 className="text-xl font-bold text-gray-800 group-hover:text-blue-600 transition-colors">
                                        {template.title}
                                    </h3>
                                    <p className="text-gray-500 mt-2 line-clamp-2 text-sm">
                                        {template.description}
                                    </p>
                                    <div className="mt-4 flex justify-between items-center text-xs text-gray-400">
                                        <span>{new Date(template.created_at).toLocaleDateString()}</span>
                                        <span className="bg-gray-100 px-2 py-1 rounded text-gray-600">
                                            Multilingual
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                )}

                {/* State: AI Generation Modal */}
                {showAIModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8 relative">
                            <button 
                                onClick={() => setShowAIModal(false)}
                                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                            >
                                ✕
                            </button>
                            
                            <div className="text-center mb-8">
                                <h2 className="text-3xl font-bold text-slate-900">AI Survey Generator</h2>
                                <p className="text-gray-600 mt-2">Describe your needs and let AI craft a multilingual survey.</p>
                            </div>

                            <textarea
                                value={userContext}
                                onChange={(e) => setUserContext(e.target.value)}
                                placeholder="e.g. I need to audit a fabric mill in Bangladesh producing organic cotton jersey. Focus on social compliance and water treatment capabilities."
                                className="w-full p-4 text-gray-700 text-lg rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none min-h-[150px] mb-6"
                            />
                            
                            {error && (
                                <div className="mb-6 text-red-500 bg-red-50 px-4 py-2 rounded-lg border border-red-100 text-sm">
                                    {error}
                                </div>
                            )}

                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setShowAIModal(false)}
                                    className="px-6 py-2.5 rounded-xl font-medium text-gray-600 hover:bg-gray-100"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleGenerate}
                                    disabled={!userContext.trim() || isGenerating}
                                    className={`px-6 py-2.5 rounded-xl font-semibold text-white transition-all flex items-center gap-2
                                        ${!userContext.trim() || isGenerating
                                        ? 'bg-gray-300 cursor-not-allowed' 
                                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-lg hover:-translate-y-0.5'}`}
                                >
                                    {isGenerating ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>Generating...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Generate Survey</span>
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" />
                                            </svg>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* State: Generated Survey */}
                {generatedSurvey && (
                <div className="animate-fade-in">
                    {/* Control Bar */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                        <button 
                            onClick={() => setGeneratedSurvey(null)}
                            className="text-gray-500 hover:text-gray-800 flex items-center text-sm font-medium"
                        >
                            ← Back to Templates
                        </button>
                        <div className="flex gap-3 flex-wrap">
                            <button 
                                onClick={() => setIsChatOpen(!isChatOpen)}
                                className={`text-sm px-4 py-2 rounded-lg border shadow-sm flex items-center gap-2 transition-colors
                                    ${isChatOpen ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
                            >
                                <span className="text-lg">💬</span>
                                {isChatOpen ? 'Close Assistant' : 'Refine with AI'}
                            </button>

                            <button 
                                onClick={handleUndo}
                                disabled={pastHistory.length === 0}
                                className="text-sm bg-white text-gray-700 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <span className="text-lg">↩️</span>
                                Undo
                            </button>

                            <button 
                                onClick={handleSaveTemplate}
                                disabled={isSaving}
                                className="text-sm bg-white text-gray-700 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 shadow-sm flex items-center gap-2"
                            >
                                {isSaving ? 'Saving...' : '💾 Save as Template'}
                            </button>
                            {!formSubmitted && (
                                <span className="text-sm bg-blue-50 text-blue-700 px-3 py-2 rounded-lg border border-blue-100 flex items-center">
                                Preview Mode
                                </span>
                            )}
                        </div>
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
                        <h1 className="text-3xl font-bold text-slate-900 mb-2">{getText(generatedSurvey.title)}</h1>
                        <p className="text-gray-600 text-lg leading-relaxed">{getText(generatedSurvey.description)}</p>
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
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleSaveEdit();
                                      }
                                    }}
                                    className="flex-1 px-3 py-1 rounded border border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    autoFocus
                                />
                                <button type="button" onClick={handleSaveEdit} className="text-green-600 hover:text-green-800 font-medium text-sm">Save</button>
                                <button type="button" onClick={handleCancelEdit} className="text-gray-500 hover:text-gray-700 font-medium text-sm">Cancel</button>
                                </div>
                            ) : (
                                <h2 className="text-xl font-bold text-slate-800">{getText(section.title)}</h2>
                            )}
                            
                            {/* Controls */}
                            <div className="flex items-center space-x-2 ml-4">
                                <button 
                                type="button"
                                onClick={() => handleMoveSection(sIdx, 'up')}
                                disabled={sIdx === 0}
                                className={`p-1 rounded hover:bg-gray-200 ${sIdx === 0 ? 'text-gray-300' : 'text-gray-600'}`}
                                >
                                ↑
                                </button>
                                <button 
                                type="button"
                                onClick={() => handleMoveSection(sIdx, 'down')}
                                disabled={sIdx === generatedSurvey.sections.length - 1}
                                className={`p-1 rounded hover:bg-gray-200 ${sIdx === generatedSurvey.sections.length - 1 ? 'text-gray-300' : 'text-gray-600'}`}
                                >
                                ↓
                                </button>
                                <button 
                                type="button"
                                onClick={() => handleStartEdit(section.id, getText(section.title))}
                                className="p-1 rounded hover:bg-gray-200 text-blue-600"
                                >
                                ✎
                                </button>
                                <button 
                                type="button"
                                onClick={() => handleDeleteSection(sIdx)}
                                className="p-1 rounded hover:bg-red-100 text-red-600"
                                >
                                🗑
                                </button>
                            </div>
                            </div>
                            
                            <div className="p-6 space-y-8">
                            {section.questions.map((q) => (
                                <div key={q.id} className="space-y-3 relative group">
                                {editingQuestionId === q.id && tempQuestion ? (
                                    <div className="bg-blue-50 p-6 rounded-lg border border-blue-200 space-y-4 animate-fade-in">
                                        {/* Question Text */}
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                                Question Text ({language.toUpperCase()})
                                            </label>
                                            <input 
                                                type="text" 
                                                value={getText(tempQuestion.text)} 
                                                onChange={(e) => updateTempQuestionText(e.target.value)}
                                                className="w-full px-3 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                                            />
                                        </div>
                                        
                                        {/* Type & Required */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 mb-1">Type</label>
                                                <select 
                                                    value={tempQuestion.type}
                                                    onChange={(e) => updateTempQuestion('type', e.target.value)}
                                                    className="w-full px-3 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                                >
                                                    <option value="short_text">Short Text</option>
                                                    <option value="long_text">Long Text</option>
                                                    <option value="single_choice">Single Choice</option>
                                                    <option value="multiple_choice">Multiple Choice</option>
                                                    <option value="number">Number</option>
                                                </select>
                                            </div>
                                            <div className="flex items-center mt-6">
                                                <input 
                                                    type="checkbox"
                                                    id={`req-${q.id}`}
                                                    checked={tempQuestion.required || false}
                                                    onChange={(e) => updateTempQuestion('required', e.target.checked)}
                                                    className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                                />
                                                <label htmlFor={`req-${q.id}`} className="ml-2 text-sm text-gray-700 font-medium">Required Response</label>
                                            </div>
                                        </div>

                                        {/* Placeholder */}
                                        {(tempQuestion.type === 'short_text' || tempQuestion.type === 'long_text' || tempQuestion.type === 'number') && (
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                                Placeholder ({language.toUpperCase()})
                                            </label>
                                            <input 
                                                type="text" 
                                                value={getText(tempQuestion.placeholder)} 
                                                onChange={(e) => updateTempQuestionPlaceholder(e.target.value)}
                                                className="w-full px-3 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                                            />
                                        </div>
                                        )}

                                        {/* Options (if choice) */}
                                        {(tempQuestion.type === 'single_choice' || tempQuestion.type === 'multiple_choice') && (
                                            <div className="bg-white p-4 rounded border border-gray-200">
                                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                    Options ({language.toUpperCase()})
                                                </label>
                                                <div className="space-y-2">
                                                    {tempQuestion.options?.map((opt, idx) => (
                                                        <div key={idx} className="flex gap-2 items-center">
                                                            <input 
                                                                value={getText(opt.label)}
                                                                onChange={(e) => updateTempOption(idx, e.target.value)}
                                                                className="flex-1 px-3 py-1.5 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                                                placeholder="Option Label"
                                                            />
                                                            <button 
                                                                onClick={() => removeTempOption(idx)} 
                                                                className="text-red-500 hover:text-red-700 p-1"
                                                            >
                                                                ✕
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                                <button 
                                                    onClick={addTempOption} 
                                                    className="mt-3 text-sm text-blue-600 font-medium hover:text-blue-800 flex items-center"
                                                >
                                                    + Add Option
                                                </button>
                                            </div>
                                        )}
                                        
                                        {/* Actions */}
                                        <div className="flex justify-end gap-3 mt-4 pt-2 border-t border-blue-200">
                                            <button 
                                                type="button"
                                                onClick={handleCancelEditQuestion} 
                                                className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50"
                                            >
                                                Cancel
                                            </button>
                                            <button 
                                                type="button"
                                                onClick={handleSaveQuestion} 
                                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 shadow-sm"
                                            >
                                                Save Changes
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="group relative p-4 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200">
                                    <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 z-10">
                                        <button 
                                            type="button"
                                            onClick={() => handleStartEditQuestion(q)} 
                                            className="p-1.5 bg-white text-blue-600 hover:text-blue-800 rounded shadow-sm border border-gray-200 text-xs font-medium flex items-center gap-1"
                                        >
                                            ✎ Edit
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => handleDeleteQuestion(section.id, q.id)} 
                                            className="p-1.5 bg-white text-red-600 hover:text-red-800 rounded shadow-sm border border-gray-200 text-xs font-medium flex items-center gap-1"
                                        >
                                            🗑 Delete
                                        </button>
                                    </div>

                                    <label className="block text-base font-semibold text-gray-800 pr-16 mb-2">
                                        {getText(q.text)}
                                        {q.required && <span className="text-red-500 ml-1">*</span>}
                                    </label>

                                    {/* Render Input Based on Type */}
                                    <div className="mt-1">
                                        {q.type === 'short_text' && (
                                        <input 
                                            type="text" 
                                            className="w-full border-b border-gray-300 focus:border-blue-500 outline-none py-2 bg-transparent transition-colors"
                                            placeholder={getText(q.placeholder)}
                                            value={answers[q.id] as string || ''}
                                            onChange={(e) => handleAnswerChange(q.id, e.target.value, 'short_text')}
                                        />
                                        )}

                                        {q.type === 'long_text' && (
                                        <textarea 
                                            className="w-full border border-gray-300 rounded-lg p-3 focus:border-blue-500 outline-none h-24 bg-white/50 focus:bg-white transition-colors"
                                            placeholder={getText(q.placeholder)}
                                            value={answers[q.id] as string || ''}
                                            onChange={(e) => handleAnswerChange(q.id, e.target.value, 'long_text')}
                                        />
                                        )}

                                        {q.type === 'number' && (
                                        <input 
                                            type="number" 
                                            className="w-full md:w-1/3 border-b border-gray-300 focus:border-blue-500 outline-none py-2 bg-transparent transition-colors"
                                            placeholder={getText(q.placeholder)}
                                            value={answers[q.id] as number || ''}
                                            onChange={(e) => handleAnswerChange(q.id, e.target.value, 'number')}
                                        />
                                        )}

                                        {(q.type === 'single_choice' || q.type === 'multiple_choice') && q.options && (
                                        <div className="space-y-3 mt-3">
                                            {q.options.map((opt, i) => {
                                            const isSelected = q.type === 'single_choice' 
                                                ? answers[q.id] === opt.value
                                                : (answers[q.id] as string[])?.includes(opt.value);

                                            return (
                                                <label 
                                                key={i} 
                                                className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${
                                                    isSelected
                                                    ? 'border-blue-500 bg-blue-50 text-blue-700' 
                                                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                                }`}
                                                >
                                                <input 
                                                    type={q.type === 'single_choice' ? 'radio' : 'checkbox'} 
                                                    name={q.id}
                                                    value={opt.value}
                                                    checked={isSelected || false}
                                                    onChange={() => handleAnswerChange(q.id, opt.value, q.type)}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                                                />
                                                <span className="ml-2 text-sm font-medium">{getText(opt.label)}</span>
                                                </label>
                                            );
                                            })}
                                        </div>
                                        )}
                                    </div>
                                    </div>
                                )}
                                </div>
                            ))}
                            </div>
                        </div>
                        ))}

                        <div className="flex justify-end pt-6 pb-20">
                        <button
                            type="submit"
                            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                        >
                            Submit Survey
                        </button>
                        </div>
                    </form>
                    )}
                </div>
                )}
           </div>
        </div>

        {/* Chat Sidebar */}
        {generatedSurvey && (
          <div className={`fixed inset-y-0 right-0 w-80 md:w-96 bg-white shadow-2xl transform transition-transform duration-300 z-40 flex flex-col border-l border-gray-200 ${isChatOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <span>💬</span>
                    AI Assistant
                </h3>
                <button onClick={() => setIsChatOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                    ✕
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
                {chatHistory.length === 0 && (
                    <div className="text-center text-gray-400 text-sm mt-8">
                        No messages yet. Ask AI to refine the survey!
                    </div>
                )}
                {chatHistory.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                            msg.role === 'user' 
                                ? 'bg-blue-600 text-white rounded-br-none' 
                                : 'bg-white border border-gray-200 text-gray-700 rounded-bl-none shadow-sm'
                        }`}>
                            {msg.content}
                        </div>
                    </div>
                ))}
                {isChatLoading && (
                    <div className="flex justify-start">
                         <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm flex items-center gap-2">
                             <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                             <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                             <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                         </div>
                    </div>
                )}
                <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleChatSubmit} className="p-4 bg-white border-t border-gray-200">
                <div className="flex gap-2">
                    <input 
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="e.g. Add a section on Cyber Security..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        disabled={isChatLoading}
                    />
                    <button 
                        type="submit" 
                        disabled={!chatInput.trim() || isChatLoading}
                        className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                    </button>
                </div>
            </form>
          </div>
        )}

      </main>
    </div>
  );
}
