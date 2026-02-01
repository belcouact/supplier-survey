import { useState, useEffect, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { generateSurvey, refineSurvey, getAvailableModels, analyzeSurveyResults, chatWithSurveyResults } from '../services/aiService';
import { saveSurveyTemplate, getTemplates, deleteTemplate, duplicateTemplate, updateSurveyTemplate } from '../services/templateService';
import { getSurveyResultsByTemplate } from '../services/resultService';
import { getAllUsers, updateUserRole, deleteUser } from '../services/userService';
import { exportSurveyResultsToCSV } from '../utils/helpers';
import { SurveySchema, SurveyQuestion, ChatMessage, SurveyResult, SurveyTemplate, UserProfile, UserRole } from '../types';
import { ArrowLeft, Save, Undo, Plus, Trash2, Edit2, MessageSquare, Check, X, Copy, Share2, Sparkles, Download, Brain } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface AdminPageProps {
  user: any;
}

export function AdminPage({ user }: AdminPageProps) {
  // --- State ---
  const [activeTab, setActiveTab] = useState<'create' | 'templates' | 'analytics' | 'users'>('create');
  const [userContext, setUserContext] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [generatedSurvey, setGeneratedSurvey] = useState<SurveySchema | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<SurveyTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [showAIModal, setShowAIModal] = useState(false);
  const [shareSurvey, setShareSurvey] = useState<SurveyTemplate | null>(null);

  // --- Analysis State ---
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [showResultChat, setShowResultChat] = useState(false);
  const [resultChatHistory, setResultChatHistory] = useState<ChatMessage[]>([]);
  const [resultChatInput, setResultChatInput] = useState('');
  const [isResultChatLoading, setIsResultChatLoading] = useState(false);
  const resultChatEndRef = useRef<HTMLDivElement>(null);

  // --- User Management State ---
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);

  useEffect(() => {
    if (user) {
        const role = user.user_metadata?.role;
        const email = user.email;
        if (email === 'admin@wlgore.com' || role === 'super_admin') {
            setIsSuperAdmin(true);
        } else {
            setIsSuperAdmin(false);
        }
    }
  }, [user]);

  useEffect(() => {
    if ((activeTab === 'users' && isSuperAdmin) || activeTab === 'analytics') {
        loadUsers();
    }
  }, [activeTab, isSuperAdmin]);

  const loadUsers = async () => {
    setIsLoadingUsers(true);
    try {
        const data = await getAllUsers();
        setUsers(data);
    } catch (err) {
        console.error(err);
    } finally {
        setIsLoadingUsers(false);
    }
  };

  const handleAnalyzeResults = async () => {
    const template = templates.find(t => String(t.id) === selectedAnalyticsTemplateId);
    if (!template) return;
    
    setIsAnalyzing(true);
    try {
        // We might want to filter results or limit them if there are too many
        const result = await analyzeSurveyResults(template, analyticsResults, selectedModel);
        setAnalysisResult(result);
        setShowAnalysisModal(true);
    } catch (err) {
        console.error(err);
        alert('Failed to analyze results');
    } finally {
        setIsAnalyzing(false);
    }
  };

  const handleResultChatSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!resultChatInput.trim() || isResultChatLoading) return;

    const template = templates.find(t => String(t.id) === selectedAnalyticsTemplateId);
    if (!template) return;

    const userMessage = resultChatInput;
    setResultChatInput('');
    setIsResultChatLoading(true);

    const newHistory: ChatMessage[] = [
        ...resultChatHistory,
        { role: 'user', content: userMessage }
    ];
    setResultChatHistory(newHistory);

    try {
        const response = await chatWithSurveyResults(template, analyticsResults, userMessage, resultChatHistory, selectedModel);
        
        setResultChatHistory([
            ...newHistory,
            { role: 'assistant', content: response }
        ]);
    } catch (err) {
        console.error(err);
        setResultChatHistory([
            ...newHistory,
            { role: 'assistant', content: 'Sorry, I encountered an error analyzing the results.' }
        ]);
    } finally {
        setIsResultChatLoading(false);
    }
  };

  useEffect(() => {
    if (resultChatEndRef.current) {
        resultChatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [resultChatHistory, showResultChat]);

  const handleUpdateRole = async (newRole: UserRole) => {
    if (!selectedUser) return;
    try {
        await updateUserRole(selectedUser.id, newRole);
        setUsers(users.map(u => u.id === selectedUser.id ? { ...u, role: newRole } : u));
        setSelectedUser({ ...selectedUser, role: newRole });
        alert('Role updated successfully');
    } catch (err) {
        alert('Failed to update role');
        console.error(err);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    if (window.confirm(`Are you sure you want to delete user ${selectedUser.email}? This action cannot be undone.`)) {
        try {
            await deleteUser(selectedUser.id);
            setUsers(users.filter(u => u.id !== selectedUser.id));
            setIsUserModalOpen(false);
            setSelectedUser(null);
        } catch (err) {
            alert('Failed to delete user');
            console.error(err);
        }
    }
  };

  // --- Analytics State ---
  const [selectedAnalyticsTemplateId, setSelectedAnalyticsTemplateId] = useState<string>('');
  const [analyticsResults, setAnalyticsResults] = useState<SurveyResult[]>([]);
  const [viewingResult, setViewingResult] = useState<SurveyResult | null>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  
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
  const [pastHistory, setPastHistory] = useState<SurveySchema[]>([]);
  const [currentStep, setCurrentStep] = useState(0);

  // --- Renaming State (Moved to Edit View) ---
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [tempHeaderTitle, setTempHeaderTitle] = useState('');
  const [tempHeaderDesc, setTempHeaderDesc] = useState('');
  const [tempExpirationDate, setTempExpirationDate] = useState('');

  // --- AI Model State ---
  const [selectedModel, setSelectedModel] = useState<string>('deepseek');
  const [availableModels, setAvailableModels] = useState<string[]>(['deepseek', 'gemini']);



  const loadAnalytics = async (templateId: string) => {
      if (!templateId) return;
      setIsLoadingAnalytics(true);
      try {
          const results = await getSurveyResultsByTemplate(templateId);
          setAnalyticsResults(results);
      } catch (err) {
          console.error('Failed to load analytics', err);
      } finally {
          setIsLoadingAnalytics(false);
      }
  };

  useEffect(() => {
      if (activeTab === 'analytics' && templates.length > 0 && !selectedAnalyticsTemplateId) {
          setSelectedAnalyticsTemplateId(String(templates[0].id));
      }
  }, [activeTab, templates]);

  useEffect(() => {
      if (selectedAnalyticsTemplateId) {
          loadAnalytics(selectedAnalyticsTemplateId);
      }
  }, [selectedAnalyticsTemplateId]);

  // --- Fetch Templates & Models ---
  useEffect(() => {
    if (user) {
      loadTemplates();
    }
    loadModels();
  }, [user, isSuperAdmin]);

  const loadModels = async () => {
    try {
        const models = await getAvailableModels();
        if (models && models.length > 0) {
            setAvailableModels(models);
            // Ensure selected model is in the list, otherwise select the first one
            if (!models.includes(selectedModel)) {
                setSelectedModel(models[0]);
            }
        }
    } catch (err) {
        console.error('Failed to load models', err);
    }
  };

  useEffect(() => {
    if (isChatOpen && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isChatOpen]);

  // --- Auto-Welcome Message for AI Chat ---
  useEffect(() => {
    if (isChatOpen && chatHistory.length === 0) {
        setChatHistory([
            { role: 'assistant', content: "Hello! I'm here to help you refine your survey. You can ask me to add new questions, modify existing ones, or translate to another language. What would you like to do?" }
        ]);
    }
  }, [isChatOpen]);

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
    setEditingSectionId(null);
    setEditingQuestionId(null);
  };

  // --- Helper: Get Localized Text (Legacy Support) ---
  const getText = (content: any): string => {
    if (!content) return '';
    if (typeof content === 'string') return content;
    // Fallback for legacy multilingual data structure { en: "...", sc: "...", tc: "..." }
    return content.en || Object.values(content)[0] as string || '';
  };

  const renderAnswer = (question: SurveyQuestion, answer: any) => {
    if (answer === undefined || answer === null || answer === '') return <span className="text-gray-400 italic">No answer</span>;

    if (question.type === 'single_choice' || question.type === 'multiple_choice') {
        if (Array.isArray(answer)) {
            return answer.map(val => {
                const opt = question.options?.find(o => o.value === val);
                return opt ? getText(opt.label) : val;
            }).join(', ');
        } else {
            const opt = question.options?.find(o => o.value === answer);
            return opt ? getText(opt.label) : answer;
        }
    }
    
    if (typeof answer === 'boolean') return answer ? 'Yes' : 'No';
    return String(answer);
  };

  // --- AI Generation Logic ---
  const handleGenerate = async () => {
    if (!userContext.trim()) return;
    
    setIsGenerating(true);
    setError(null);
    setGeneratedSurvey(null);

    try {
      const surveyData = await generateSurvey(userContext, selectedModel);
      
      // Ensure expiration date (default to 30 days from now)
      if (!surveyData.expiration_date) {
          const date = new Date();
          date.setDate(date.getDate() + 30);
          surveyData.expiration_date = date.toISOString();
      }

      setGeneratedSurvey(surveyData);
      
      setChatHistory([
        { role: 'user', content: userContext },
        { role: 'assistant', content: "I've generated the survey based on your request. Feel free to ask for any adjustments!" }
      ]);
      
      setShowAIModal(false);
    } catch (err: any) {
      console.error("Generation Error:", err);
      setError(`Failed to generate survey. Error: ${err.message || 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleChatSubmit = async (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || !generatedSurvey) return;

    const userMsg = chatInput;
    setChatInput('');
    setIsChatLoading(true);

    const newHistory: ChatMessage[] = [...chatHistory, { role: 'user', content: userMsg }];
    setChatHistory(newHistory);

    try {
        const result = await refineSurvey(generatedSurvey, userMsg, chatHistory, selectedModel);
        
        if (result.updatedSurvey) {
            pushToHistory();
            setGeneratedSurvey(result.updatedSurvey);
        }
        
        setChatHistory([
            ...newHistory, 
            { role: 'assistant', content: result.responseMessage }
        ]);
    } catch (err) {
        console.error(err);
        setChatHistory([
            ...newHistory, 
            { role: 'assistant', content: "Sorry, I encountered an error while processing your request. Please try again." }
        ]);
    } finally {
        setIsChatLoading(false);
    }
  };

  const handleLoadTemplate = (template: any) => {
    if (template.schema) {
      setGeneratedSurvey(template.schema);
      setEditingTemplateId(template.id);
      setChatHistory([]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };



  const handleDeleteTemplate = async (e: React.MouseEvent, templateId: string) => {
    e.stopPropagation(); // Prevent opening the template
    if (window.confirm('Are you sure you want to delete this template? This action cannot be undone.')) {
        try {
            await deleteTemplate(templateId);
            setTemplates(templates.filter(t => t.id !== templateId));
        } catch (err) {
            alert('Failed to delete template');
            console.error(err);
        }
    }
  };

  const handleDuplicateTemplate = async (e: React.MouseEvent, template: SurveyTemplate) => {
    e.stopPropagation();
    try {
        const newTemplate = await duplicateTemplate(template, user.id);
        setTemplates([newTemplate, ...templates]);
    } catch (err) {
        alert('Failed to duplicate template');
        console.error(err);
    }
  };

  const handleStartEditHeader = () => {
    if (!generatedSurvey) return;
    setIsEditingHeader(true);
    setTempHeaderTitle(getText(generatedSurvey.title));
    setTempHeaderDesc(getText(generatedSurvey.description));
    setTempExpirationDate(generatedSurvey.expiration_date ? new Date(generatedSurvey.expiration_date).toISOString().split('T')[0] : '');
  };

  const handleSaveHeader = () => {
    if (!generatedSurvey) return;
    pushToHistory();
    
    setGeneratedSurvey({
        ...generatedSurvey,
        title: tempHeaderTitle,
        description: tempHeaderDesc,
        expiration_date: tempExpirationDate ? new Date(tempExpirationDate).toISOString() : undefined
    });
    setIsEditingHeader(false);
  };

  const handleCancelHeader = () => {
    setIsEditingHeader(false);
  };

  // --- Section Management ---
  const handleMoveSection = (index: number, direction: 'up' | 'down') => {
    if (!generatedSurvey) return;
    pushToHistory();
    const sections = [...generatedSurvey.sections];
    
    if (direction === 'up' && index > 0) {
      [sections[index], sections[index - 1]] = [sections[index - 1], sections[index]];
      if (index === currentStep) setCurrentStep(index - 1);
      else if (index - 1 === currentStep) setCurrentStep(index);
    } else if (direction === 'down' && index < sections.length - 1) {
      [sections[index], sections[index + 1]] = [sections[index + 1], sections[index]];
      if (index === currentStep) setCurrentStep(index + 1);
      else if (index + 1 === currentStep) setCurrentStep(index);
    }
    
    setGeneratedSurvey({ ...generatedSurvey, sections });
  };

  const handleDeleteSection = (index: number) => {
    if (!generatedSurvey) return;
    if (!window.confirm('Are you sure you want to delete this section?')) return;
    
    pushToHistory();
    const sections = generatedSurvey.sections.filter((_, i) => i !== index);
    setGeneratedSurvey({ ...generatedSurvey, sections });
    
    if (index < currentStep) {
        setCurrentStep(currentStep - 1);
    } else if (currentStep >= sections.length) {
        setCurrentStep(Math.max(0, sections.length - 1));
    }
  };

  const handleStartEdit = (sectionId: string, currentTitle: any) => {
    setEditingSectionId(sectionId);
    setTempSectionTitle(getText(currentTitle));
  };

  const handleSaveEdit = () => {
    if (!generatedSurvey || !editingSectionId) return;
    pushToHistory();
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

  // --- Question Editing ---
  const handleStartEditQuestion = (question: SurveyQuestion) => {
    setEditingQuestionId(question.id);
    setTempQuestion(JSON.parse(JSON.stringify(question)));
  };

  const handleSaveQuestion = () => {
    if (!generatedSurvey || !editingQuestionId || !tempQuestion) return;
    pushToHistory();
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

  const updateTempOption = (idx: number, value: string) => {
    if (!tempQuestion || !tempQuestion.options) return;
    const newOptions = [...tempQuestion.options];
    newOptions[idx] = { 
        ...newOptions[idx], 
        label: value 
    };
    if (!newOptions[idx].value || newOptions[idx].value === '') {
       newOptions[idx].value = value;
    }
    setTempQuestion({ ...tempQuestion, options: newOptions });
  };

  const addTempOption = () => {
    if (!tempQuestion) return;
    const newOptions = [...(tempQuestion.options || []), { 
        label: 'New Option', 
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
      if (editingTemplateId) {
          const updatedData = await updateSurveyTemplate(editingTemplateId, generatedSurvey);
          // Manually update local state to ensure it reflects immediately
          if (updatedData && updatedData.length > 0) {
              setTemplates(prev => prev.map(t => t.id === editingTemplateId ? updatedData[0] : t));
          }
          alert('Template updated successfully!');
      } else {
          await saveSurveyTemplate(generatedSurvey);
          alert('Template saved successfully!');
      }
      await loadTemplates();
    } catch (err) {
      alert('Failed to save template.');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`flex-1 px-4 md:px-8 pb-4 md:pb-8 pt-2 md:pt-4 overflow-y-auto font-sans ${isChatOpen ? 'mr-80 md:mr-96' : ''}`}>
      <div className="max-w-7xl mx-auto">
        
        {/* State: Template List */}
        {!generatedSurvey && !isGenerating && (
          <div className="space-y-8 animate-fade-in">
            <div className="text-center py-8">
              <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-gray-500 mt-2">Manage templates and generate new surveys</p>
            </div>

            {/* Tabs */}
            <div className="flex justify-center border-b border-gray-200 mb-8">
                <button
                    onClick={() => setActiveTab('create')}
                    className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
                        activeTab === 'create' 
                        ? 'border-blue-600 text-blue-600' 
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                    Create
                </button>
                <button
                    onClick={() => setActiveTab('analytics')}
                    className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
                        activeTab === 'analytics' 
                        ? 'border-blue-600 text-blue-600' 
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                    Analytics
                </button>
                {isSuperAdmin && (
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
                            activeTab === 'users' 
                            ? 'border-blue-600 text-blue-600' 
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        Users
                    </button>
                )}
            </div>

            {activeTab === 'create' && (
                isLoadingTemplates ? (
                  <div className="text-center py-12 text-gray-400">Loading templates...</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     {/* Create New Card */}
                     <div 
                        onClick={() => setShowAIModal(true)}
                        className="bg-blue-50 p-6 rounded-xl border-2 border-dashed border-blue-200 hover:border-blue-400 hover:bg-blue-100 transition-all cursor-pointer flex flex-col items-center justify-center min-h-[200px]"
                     >
                        <Plus size={48} className="text-blue-500 mb-2" />
                        <span className="text-lg font-bold text-blue-600">Create New with AI</span>
                     </div>

                    {templates.map((template) => (
                  <div key={template.id} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow group relative">
                    <div className="absolute top-4 right-4 flex gap-1 z-10">
                        <button 
                            onClick={(e) => { e.stopPropagation(); setShareSurvey(template); }}
                            className="p-2 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-full transition-colors"
                            title="Share Survey"
                            disabled={!template.short_id}
                        >
                            <Share2 size={18} />
                        </button>
                        <button 
                            onClick={(e) => handleDuplicateTemplate(e, template)}
                            className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-full transition-colors"
                            title="Duplicate Template"
                        >
                            <Copy size={18} />
                        </button>
                        <button 
                            onClick={(e) => handleDeleteTemplate(e, String(template.id))}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                            title="Delete Template"
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>

                    <h3 className="text-xl font-bold text-gray-800 pr-28">{template.title}</h3>
                    
                    <p className="text-gray-500 mt-2 line-clamp-2 text-sm">{template.description}</p>
                    <div className="mt-4 flex justify-between items-center text-xs text-gray-400">
                        <span>{new Date(template.created_at).toLocaleDateString()}</span>
                    </div>
                    
                    <div className="mt-4 flex gap-2">
                        <button 
                            onClick={() => handleLoadTemplate(template)}
                            className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm font-medium"
                        >
                            Edit / Preview
                        </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}

            {activeTab === 'analytics' && (
                <div className="space-y-6">
                    {/* Template Selector */}
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <label className="font-medium text-gray-700 whitespace-nowrap">Select Survey:</label>
                        <select 
                            value={selectedAnalyticsTemplateId}
                            onChange={(e) => setSelectedAnalyticsTemplateId(e.target.value)}
                            className="w-full md:flex-1 p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        >
                            {templates.map(t => (
                                <option key={t.id} value={t.id}>{t.title}</option>
                            ))}
                        </select>
                    </div>

                    {isLoadingAnalytics ? (
                        <div className="text-center py-12 text-gray-400">Loading analytics...</div>
                    ) : analyticsResults.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-200 border-dashed">
                            No responses found for this survey.
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                                    <h3 className="text-gray-500 text-sm font-medium uppercase">Total Responses</h3>
                                    <p className="text-4xl font-bold text-gray-900 mt-2">{analyticsResults.length}</p>
                                </div>
                                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                                    <h3 className="text-gray-500 text-sm font-medium uppercase">Last Response</h3>
                                    <p className="text-xl font-bold text-gray-900 mt-2">
                                        {new Date(Math.max(...analyticsResults.map(r => new Date(r.updated_at).getTime()))).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>

                            {/* Detailed Results */}
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                                    <h3 className="font-bold text-gray-800">Response History</h3>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => setShowResultChat(true)}
                                            disabled={analyticsResults.length === 0}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-indigo-200 rounded-lg text-sm font-medium text-indigo-700 hover:bg-indigo-50 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                            title="Chat with AI about results"
                                        >
                                            <MessageSquare size={16} />
                                            Chat with AI
                                        </button>
                                        <button 
                                            onClick={() => {
                                                const template = templates.find(t => String(t.id) === selectedAnalyticsTemplateId);
                                                const userEmailMap = users.reduce((acc, u) => ({ ...acc, [u.id]: u.email }), {} as Record<string, string>);
                                                if (template) exportSurveyResultsToCSV(analyticsResults, template, userEmailMap);
                                            }}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                            disabled={analyticsResults.length === 0}
                                            title="Download results as CSV"
                                        >
                                            <Download size={16} />
                                            Export CSV
                                        </button>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 text-gray-500 font-medium">
                                            <tr>
                                                <th className="px-6 py-3">ID/Email</th>
                                                <th className="px-6 py-3">Submit Date</th>
                                                <th className="px-6 py-3">Actions</th>
                                                <th className="px-6 py-3">Analysis</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {analyticsResults.map((result) => (
                                                <tr key={result.id} className="hover:bg-gray-50">
                                                    <td className="px-6 py-3 font-medium text-gray-900">
                                                        {!result.user_id || result.user_id === 'anonymous' 
                                                            ? 'Anonymous' 
                                                            : (users.find(u => u.id === result.user_id)?.email || result.user_id)}
                                                    </td>
                                                    <td className="px-6 py-3 text-gray-500">
                                                        {new Date(result.updated_at).toLocaleString()}
                                                    </td>
                                                    <td className="px-6 py-3">
                                                        <button 
                                                            onClick={() => setViewingResult(result)}
                                                            className="text-blue-600 hover:underline"
                                                        >
                                                            View Details
                                                        </button>
                                                    </td>
                                                    <td className="px-6 py-3">
                                                        <button 
                                                            onClick={handleAnalyzeResults}
                                                            disabled={isAnalyzing}
                                                            className={`flex items-center gap-2 px-3 py-1.5 bg-white border border-purple-200 rounded-lg text-xs font-medium text-purple-700 hover:bg-purple-50 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${isAnalyzing ? 'animate-pulse' : ''}`}
                                                            title="Analyze results with AI"
                                                        >
                                                            <Brain size={14} />
                                                            {isAnalyzing ? 'Analyzing...' : 'Analyze'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'users' && isSuperAdmin && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                        <h3 className="font-bold text-gray-800">User Management</h3>
                        <button 
                            onClick={loadUsers} 
                            className="p-2 hover:bg-gray-200 rounded-full text-gray-500 transition-colors"
                            title="Refresh Users"
                        >
                            <Undo size={16} className="rotate-0" />
                        </button>
                    </div>
                    
                    {isLoadingUsers ? (
                         <div className="text-center py-12 text-gray-400">Loading users...</div>
                    ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-500 font-medium">
                                <tr>
                                    <th className="px-6 py-3">Email</th>
                                    <th className="px-6 py-3">Role</th>
                                    <th className="px-6 py-3">Created At</th>
                                    <th className="px-6 py-3">Last Login</th>
                                    <th className="px-6 py-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {users.map((u) => (
                                    <tr key={u.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-3 font-medium text-gray-900">{u.email}</td>
                                        <td className="px-6 py-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                u.role === 'super_admin' ? 'bg-purple-100 text-purple-700' :
                                                u.role === 'admin' ? 'bg-blue-100 text-blue-700' :
                                                'bg-gray-100 text-gray-700'
                                            }`}>
                                                {u.role === 'super_admin' ? 'Super Admin' : 
                                                 u.role === 'admin' ? 'Admin' : 'Common User'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 text-gray-500">
                                            {u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}
                                        </td>
                                        <td className="px-6 py-3 text-gray-500">
                                            {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : 'Never'}
                                        </td>
                                        <td className="px-6 py-3">
                                            <button
                                                onClick={() => { setSelectedUser(u); setIsUserModalOpen(true); }}
                                                className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-medium transition-colors"
                                            >
                                                Manage
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    )}
                </div>
            )}
            
            {/* User Management Modal */}
            {isUserModalOpen && selectedUser && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
                        <button 
                            onClick={() => { setIsUserModalOpen(false); setSelectedUser(null); }}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                        >
                            <X size={24} />
                        </button>
                        
                        <h2 className="text-xl font-bold text-gray-900 mb-1">Manage User</h2>
                        <p className="text-sm text-gray-500 mb-6">{selectedUser.email}</p>
                        
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Change Role</label>
                                <select
                                    value={selectedUser.role || 'common_user'}
                                    onChange={(e) => handleUpdateRole(e.target.value as UserRole)}
                                    disabled={selectedUser.email === 'admin@wlgore.com'} 
                                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                >
                                    <option value="common_user">Common User</option>
                                    <option value="admin">Admin</option>
                                    <option value="super_admin">Super Admin</option>
                                </select>
                                <p className="text-xs text-gray-500 mt-1">Select a new role to update immediately.</p>
                            </div>

                            <div className="pt-4 border-t border-gray-100">
                                <h3 className="text-sm font-bold text-red-600 mb-2">Danger Zone</h3>
                                <p className="text-xs text-gray-500 mb-3">Deleting a user is permanent and cannot be undone.</p>
                                <button
                                    onClick={handleDeleteUser}
                                    disabled={selectedUser.email === 'admin@wlgore.com'}
                                    className={`w-full py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                                        selectedUser.email === 'admin@wlgore.com'
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        : 'bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700'
                                    }`}
                                >
                                    <Trash2 size={16} />
                                    Delete User
                                </button>
                            </div>
                        </div>
                    </div>
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
                        <X size={24} />
                    </button>
                    
                    <div className="text-center mb-8">
                        <h2 className="text-3xl font-bold text-slate-900">AI Survey Generator</h2>
                        <p className="text-gray-600 mt-2">Describe your needs and let AI craft a detailed survey. This may take a few minutes. </p>
                    </div>

                    <div className="flex justify-center mb-6">
                        <div className="bg-gray-100 p-1 rounded-lg flex gap-1 flex-wrap justify-center">
                            {availableModels.map((model) => (
                                <button
                                    key={model}
                                    onClick={() => setSelectedModel(model)}
                                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                                        selectedModel === model 
                                        ? 'bg-white text-blue-600 shadow-sm' 
                                        : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    {model === 'gpt-4o' ? 'GPT-4o' : model.charAt(0).toUpperCase() + model.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="relative mb-6">
                        <textarea
                            value={userContext}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val.length > 30000) {
                                    alert('Character limit exceeded (30,000 characters max). Please shorten your text.');
                                    return;
                                }
                                setUserContext(val);
                            }}
                            placeholder="e.g. I need to audit a fabric mill in Bangladesh producing organic cotton jersey. Focus on social compliance and water treatment capabilities."
                            className="w-full p-4 pb-8 text-gray-700 text-lg rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none min-h-[200px]"
                        />
                    </div>
                    
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
                                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]'}`}
                        >
                            {isGenerating ? 'Generating...' : 'Generate Survey'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* State: Editing Survey */}
        {generatedSurvey && (
            <div className="animate-fade-in space-y-6 pb-20">
                {/* Control Bar */}
                <div className="sticky top-0 z-40 bg-white shadow-md border-b border-gray-200 mb-6 -mx-4 md:-mx-8 px-4 md:px-8 py-3">
                  <div className="max-w-7xl mx-auto flex flex-wrap gap-3 justify-between items-center">
                    <button 
                        onClick={() => {
                            setGeneratedSurvey(null);
                            setEditingTemplateId(null);
                        }}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100"
                    >
                        <ArrowLeft size={20} />
                        Back
                    </button>

                    <div className="flex gap-2">
                        <button 
                            onClick={handleUndo}
                            disabled={pastHistory.length === 0}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors
                                ${pastHistory.length === 0 
                                    ? 'text-gray-300 cursor-not-allowed' 
                                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
                            title="Undo last change"
                        >
                            <Undo size={18} />
                            <span className="hidden sm:inline">Undo</span>
                        </button>

                        <button 
                            onClick={() => setIsChatOpen(!isChatOpen)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all shadow-sm
                                ${isChatOpen 
                                    ? 'bg-purple-100 text-purple-700 border border-purple-200' 
                                    : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:shadow-md hover:scale-[1.02] active:scale-[0.98]'}`}
                        >
                            <Sparkles size={18} className={isChatOpen ? "" : "animate-pulse"} />
                            Refine with AI
                        </button>

                        <button 
                            onClick={handleSaveTemplate}
                            disabled={isSaving}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium shadow-sm"
                        >
                            <Save size={18} />
                            {isSaving ? 'Saving...' : 'Save Template'}
                        </button>
                    </div>
                  </div>
                </div>

                {/* Survey Editor (Simplified for brevity - assumes similar structure to original App.tsx but using the state here) */}
                <div className="text-center mb-10 space-y-2 relative group/header">
                    {isEditingHeader ? (
                        <div className="max-w-2xl mx-auto space-y-4 p-4 bg-white rounded-lg border border-blue-200 shadow-sm">
                            <input
                                type="text"
                                value={tempHeaderTitle}
                                onChange={(e) => setTempHeaderTitle(e.target.value)}
                                className="w-full text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight text-center border-b border-gray-300 focus:border-blue-500 focus:outline-none pb-2"
                                placeholder="Survey Title"
                            />
                            <textarea
                                value={tempHeaderDesc}
                                onChange={(e) => setTempHeaderDesc(e.target.value)}
                                className="w-full text-lg text-slate-600 text-center border rounded p-2 focus:border-blue-500 focus:outline-none resize-none"
                                rows={3}
                                placeholder="Survey Description"
                            />
                            <div className="flex flex-col items-center gap-1 mt-2">
                                <label className="text-sm font-medium text-gray-700">Expiration Date (Optional)</label>
                                <input
                                    type="date"
                                    value={tempExpirationDate}
                                    onChange={(e) => setTempExpirationDate(e.target.value)}
                                    className="border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                            </div>
                            <div className="flex justify-center gap-2">
                                <button onClick={handleSaveHeader} className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded text-sm font-medium">
                                    <Check size={16} /> Save
                                </button>
                                <button onClick={handleCancelHeader} className="flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-600 rounded text-sm font-medium hover:bg-gray-200">
                                    <X size={16} /> Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="relative">
                             <div className="relative inline-block">
                                <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
                                    {getText(generatedSurvey.title)}
                                </h1>
                                <button 
                                    onClick={handleStartEditHeader}
                                    className="absolute -right-8 top-1 p-1 text-gray-300 hover:text-blue-500 opacity-0 group-hover/header:opacity-100 transition-opacity"
                                >
                                    <Edit2 size={18} />
                                </button>
                             </div>
                             <p className="text-lg text-slate-600 max-w-3xl mx-auto mt-2">
                                {getText(generatedSurvey.description)}
                             </p>
                             {generatedSurvey.expiration_date && (
                                <p className="text-sm text-orange-600 mt-2 font-medium bg-orange-50 inline-block px-3 py-1 rounded-full border border-orange-100">
                                    Expires: {new Date(generatedSurvey.expiration_date).toLocaleDateString()}
                                </p>
                             )}
                        </div>
                    )}
                </div>

                {/* Progress Bar (Visual only for Admin) */}
                <div className="flex justify-center mb-8">
                    <div className="flex items-center space-x-2">
                        {generatedSurvey.sections.map((_, idx) => (
                            <div 
                                key={idx}
                                className={`h-2 rounded-full transition-all duration-300 cursor-pointer
                                    ${idx === currentStep ? 'w-8 bg-blue-600' : 'w-2 bg-gray-300 hover:bg-blue-300'}`}
                                onClick={() => setCurrentStep(idx)}
                            />
                        ))}
                    </div>
                </div>

                {/* Current Section */}
                {generatedSurvey.sections[currentStep] && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8 relative group/section">
                        {/* Section Header */}
                        <div className="flex justify-between items-start mb-6 border-b border-gray-100 pb-4">
                            <div className="flex-1">
                                {editingSectionId === generatedSurvey.sections[currentStep].id ? (
                                    <div className="flex gap-2 items-center">
                                        <input
                                            type="text"
                                            value={tempSectionTitle}
                                            onChange={(e) => setTempSectionTitle(e.target.value)}
                                            className="flex-1 text-xl font-bold text-gray-800 border-b-2 border-blue-500 focus:outline-none px-1"
                                            autoFocus
                                        />
                                        <button onClick={handleSaveEdit} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check size={20} /></button>
                                        <button onClick={handleCancelEdit} className="p-1 text-red-500 hover:bg-red-50 rounded"><X size={20} /></button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 group/title">
                                        <h2 className="text-2xl font-bold text-gray-800">
                                            {getText(generatedSurvey.sections[currentStep].title)}
                                        </h2>
                                        <button 
                                            onClick={() => handleStartEdit(generatedSurvey.sections[currentStep].id, generatedSurvey.sections[currentStep].title)}
                                            className="p-1 text-gray-300 hover:text-blue-500 opacity-0 group-hover/title:opacity-100 transition-opacity"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-1 ml-4">
                                <button 
                                    onClick={() => handleMoveSection(currentStep, 'up')}
                                    disabled={currentStep === 0}
                                    className="p-1 text-gray-400 hover:text-blue-600 disabled:opacity-30"
                                >
                                    <ArrowLeft size={20} className="rotate-90" />
                                </button>
                                <button 
                                    onClick={() => handleMoveSection(currentStep, 'down')}
                                    disabled={currentStep === generatedSurvey.sections.length - 1}
                                    className="p-1 text-gray-400 hover:text-blue-600 disabled:opacity-30"
                                >
                                    <ArrowLeft size={20} className="-rotate-90" />
                                </button>
                                <button 
                                    onClick={() => handleDeleteSection(currentStep)}
                                    className="p-1 text-gray-400 hover:text-red-500 ml-2"
                                >
                                    <Trash2 size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Questions List */}
                        <div className="space-y-6">
                            {generatedSurvey.sections[currentStep].questions.map((q) => (
                                <div key={q.id} className="relative group/question border border-transparent hover:border-blue-100 rounded-xl p-4 transition-all hover:bg-blue-50/30">
                                    {editingQuestionId === q.id ? (
                                        // Edit Mode Question
                                        <div className="bg-white p-4 rounded-xl border-2 border-blue-200 shadow-lg space-y-4">
                                            <div className="flex justify-between items-center mb-2">
                                                <h4 className="font-bold text-blue-600 text-sm uppercase">Edit Question</h4>
                                                <button onClick={handleCancelEditQuestion}><X size={18} className="text-gray-400 hover:text-gray-600" /></button>
                                            </div>
                                            
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Question Text</label>
                                                <input
                                                    type="text"
                                                    value={getText(tempQuestion?.text)}
                                                    onChange={(e) => updateTempQuestion('text', e.target.value)}
                                                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                                />
                                            </div>

                                            <div className="flex gap-4">
                                                <div className="flex-1">
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Type</label>
                                                    <select
                                                        value={tempQuestion?.type}
                                                        onChange={(e) => updateTempQuestion('type', e.target.value)}
                                                        className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                                    >
                                                        <option value="short_text">Short Text</option>
                                                        <option value="long_text">Long Text</option>
                                                        <option value="number">Number</option>
                                                        <option value="single_choice">Single Choice</option>
                                                        <option value="multiple_choice">Multiple Choice</option>
                                                        <option value="description">Description</option>
                                                    </select>
                                                </div>
                                                <div className="flex items-end pb-2">
                                                    <label className="flex items-center gap-2 cursor-pointer select-none">
                                                        <input
                                                            type="checkbox"
                                                            checked={tempQuestion?.required}
                                                            onChange={(e) => updateTempQuestion('required', e.target.checked)}
                                                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                                        />
                                                        <span className="text-sm font-medium text-gray-700">Required</span>
                                                    </label>
                                                </div>
                                            </div>

                                            {(tempQuestion?.type === 'single_choice' || tempQuestion?.type === 'multiple_choice') && (
                                                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Options</label>
                                                    <div className="space-y-2">
                                                        {tempQuestion?.options?.map((opt, idx) => (
                                                            <div key={idx} className="flex gap-2">
                                                                <input
                                                                    type="text"
                                                                    value={getText(opt.label)}
                                                                    onChange={(e) => updateTempOption(idx, e.target.value)}
                                                                    className="flex-1 p-1.5 border rounded text-sm"
                                                                    placeholder={`Option ${idx + 1}`}
                                                                />
                                                                <button 
                                                                    onClick={() => removeTempOption(idx)}
                                                                    className="text-red-400 hover:text-red-600 p-1"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        ))}
                                                        <button 
                                                            onClick={addTempOption}
                                                            className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 mt-2"
                                                        >
                                                            <Plus size={14} /> Add Option
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {tempQuestion?.type === 'description' && (
                                                <div className="mt-4">
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description Content</label>
                                                    <textarea
                                                        value={getText(tempQuestion?.default_value) || getText(tempQuestion?.placeholder)}
                                                        onChange={(e) => {
                                                            updateTempQuestion('default_value', e.target.value);
                                                            // Also update placeholder for backward compatibility if needed
                                                            updateTempQuestion('placeholder', e.target.value);
                                                        }}
                                                        className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none min-h-[100px]"
                                                        placeholder="Enter the description text here..."
                                                    />
                                                </div>
                                            )}

                                            <div className="pt-2 flex justify-end gap-2">
                                                <button 
                                                    onClick={handleSaveQuestion}
                                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 shadow-sm"
                                                >
                                                    Save Changes
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        // View Mode Question
                                        <div className="flex gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-baseline gap-2 mb-2">
                                                    <span className="text-sm font-bold text-gray-400">Q{generatedSurvey.sections[currentStep].questions.indexOf(q) + 1}</span>
                                                    <h3 className="font-semibold text-gray-900 text-lg">
                                                        {getText(q.text)}
                                                        {q.required && <span className="text-red-500 ml-1">*</span>}
                                                    </h3>
                                                </div>
                                                
                                                {/* Question Preview */}
                                                <div className="pl-6 opacity-60 pointer-events-none">
                                                    {q.type === 'short_text' && (
                                                        <div className="h-10 border rounded-lg bg-gray-50"></div>
                                                    )}
                                                    {q.type === 'long_text' && (
                                                        <div className="h-24 border rounded-lg bg-gray-50"></div>
                                                    )}
                                                    {(q.type === 'single_choice' || q.type === 'multiple_choice') && (
                                                        <div className="space-y-2">
                                                            {q.options?.map((opt, i) => (
                                                                <div key={i} className="flex items-center gap-2">
                                                                    <div className={`w-4 h-4 border ${q.type === 'single_choice' ? 'rounded-full' : 'rounded'} bg-white`}></div>
                                                                    <span className="text-gray-600">{getText(opt.label)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {q.type === 'description' && (
                                                        <div className="text-gray-600 leading-relaxed whitespace-pre-wrap text-sm border-l-4 border-gray-300 pl-4 py-2 bg-gray-50 rounded-r-lg">
                                                            {getText(q.default_value) || getText(q.placeholder) || <span className="text-gray-400 italic">No description text</span>}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex flex-col gap-1 opacity-0 group-hover/question:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => handleStartEditQuestion(q)}
                                                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit2 size={18} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDeleteQuestion(generatedSurvey.sections[currentStep].id, q.id)}
                                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Add Question Button */}
                        <div className="mt-8 pt-6 border-t border-gray-100 flex justify-center">
                            {/* <button className="flex items-center gap-2 px-4 py-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg font-medium transition-colors">
                                <Plus size={20} />
                                Add Question
                            </button> */}
                            <p className="text-sm text-gray-400 italic">Use "Refine with AI" to add more questions or sections.</p>
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* Floating Chat Interface */}
        {generatedSurvey && (
            <div className={`fixed right-0 top-0 bottom-0 w-80 md:w-96 bg-white shadow-2xl transform transition-transform duration-300 z-[60] flex flex-col border-l border-gray-200
                ${isChatOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                
                <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                    <div className="flex items-center gap-2 text-gray-700">
                        <MessageSquare size={20} className="text-blue-600" />
                        <h3 className="font-bold">AI Assistant</h3>
                    </div>
                    <button onClick={() => setIsChatOpen(false)} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
                    {chatHistory.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] rounded-2xl p-3 text-sm shadow-sm
                                ${msg.role === 'user' 
                                    ? 'bg-blue-600 text-white rounded-br-none' 
                                    : 'bg-white text-gray-700 border border-gray-200 rounded-bl-none'}`}>
                                {msg.role === 'user' ? (
                                    <p className="whitespace-pre-wrap">{msg.content}</p>
                                ) : (
                                    <div className="prose prose-sm max-w-none prose-blue [&>:first-child]:mt-0 [&>:last-child]:mb-0">
                                        <ReactMarkdown>
                                            {msg.content}
                                        </ReactMarkdown>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {isChatLoading && (
                        <div className="flex justify-start">
                            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-none p-3 shadow-sm">
                                <div className="flex gap-1">
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                <div className="p-4 bg-white border-t border-gray-200">
                    <form onSubmit={handleChatSubmit} className="relative">
                        <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder="Type instructions..."
                            className="w-full pl-4 pr-12 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-sm"
                        />
                        <button 
                            type="submit"
                            disabled={!chatInput.trim() || isChatLoading}
                            className="absolute right-2 top-2 p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                        >
                            <ArrowLeft size={16} className="rotate-180" /> {/* Send Icon */}
                        </button>
                    </form>
                    <p className="text-xs text-center text-gray-400 mt-2">
                        AI can update the survey structure or content.
                    </p>
                </div>
            </div>
        )}

        {/* Viewing Result Modal */}
        {viewingResult && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
                <div className="bg-white w-full h-full shadow-2xl overflow-hidden flex flex-col relative">
                     <button 
                        onClick={() => setViewingResult(null)}
                        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10 bg-white rounded-full p-1"
                    >
                        <X size={24} />
                    </button>
                    
                    <div className="p-6 border-b border-gray-200 bg-gray-50">
                        <h2 className="text-xl font-bold text-gray-900">Response Details</h2>
                        <div className="flex gap-4 mt-2 text-sm text-gray-500">
                            <span>User: {viewingResult.user_id === 'anonymous' ? 'Anonymous' : viewingResult.user_id}</span>
                            <span>Email: {users.find(u => u.id === viewingResult.user_id)?.email || '-'}</span>
                            <span>Submit Date: {new Date(viewingResult.updated_at).toLocaleString()}</span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8">
                        {templates.find(t => String(t.id) === selectedAnalyticsTemplateId)?.schema.sections.map((section) => (
                            <div key={section.id} className="border-b border-gray-100 pb-6 last:border-0">
                                <h3 className="font-bold text-lg text-gray-800 mb-4 bg-blue-50 inline-block px-3 py-1 rounded-lg">
                                    {getText(section.title)}
                                </h3>
                                <div className="space-y-0 divide-y divide-gray-100">
                                    {section.questions.map((q) => (
                                        <div key={q.id} className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4">
                                            <div className="text-sm font-medium text-gray-500">
                                                {getText(q.text)}
                                            </div>
                                            <div className="text-gray-900 font-medium break-words">
                                                {renderAnswer(q, viewingResult.answers[q.id])}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {/* Share Modal */}
        {shareSurvey && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
                    <button 
                        onClick={() => setShareSurvey(null)}
                        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                    >
                        <X size={24} />
                    </button>
                    
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Share Survey</h2>
                    <p className="text-sm text-gray-500 mb-6">
                        Scan the QR code or copy the link below to share this survey with others.
                    </p>

                    <div className="flex flex-col items-center gap-6 mb-6">
                        <div className="bg-white p-4 rounded-xl shadow-md border border-gray-100">
                            <QRCodeCanvas 
                                value={`https://study-llm.me/apps/survey-gen/${shareSurvey.short_id}`} 
                                size={200}
                                level="H"
                            />
                        </div>
                        <div className="w-full flex gap-2">
                            <input 
                                type="text" 
                                readOnly
                                value={`https://study-llm.me/apps/survey-gen/${shareSurvey.short_id}`}
                                className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none"
                            />
                            <button 
                                onClick={() => {
                                    navigator.clipboard.writeText(`https://study-llm.me/apps/survey-gen/${shareSurvey.short_id}`);
                                    alert('Link copied to clipboard!');
                                }}
                                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                            >
                                Copy
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Analysis Modal */}
        {showAnalysisModal && (
            <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
                <div className="bg-white w-full h-full flex flex-col relative overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-purple-50 to-white">
                        <div className="flex items-center gap-3">
                            <div className="bg-purple-100 p-2 rounded-lg text-purple-600">
                                <Brain size={24} />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900">AI Analysis Report</h2>
                        </div>
                        <button 
                            onClick={() => setShowAnalysisModal(false)}
                            className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                        <div className="prose prose-slate max-w-none prose-headings:font-bold prose-headings:text-gray-800 prose-p:text-gray-600 prose-li:text-gray-600 prose-strong:text-gray-900 mx-auto container">
                            <ReactMarkdown>{analysisResult || ''}</ReactMarkdown>
                        </div>
                    </div>

                    <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                        <button
                            onClick={() => setShowAnalysisModal(false)}
                            className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium shadow-sm"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Result Chat Sidebar */}
        {showResultChat && (
            <div className="fixed inset-0 z-[90] flex justify-end bg-black/20 backdrop-blur-[1px] animate-fade-in">
                <div className="w-full max-w-md h-full bg-white shadow-2xl flex flex-col animate-slide-in-right">
                    <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-indigo-50">
                        <div className="flex items-center gap-2 text-indigo-800 font-bold">
                            <Sparkles size={20} />
                            <h3>Chat with AI Analyst</h3>
                        </div>
                        <button 
                            onClick={() => setShowResultChat(false)}
                            className="p-1 text-gray-500 hover:bg-white/50 rounded-full transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
                        {resultChatHistory.length === 0 && (
                            <div className="text-center py-8 text-gray-500 text-sm">
                                <div className="w-12 h-12 bg-indigo-100 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <MessageSquare size={24} />
                                </div>
                                <p>Ask questions about the survey results.</p>
                                <p className="mt-1">e.g., "What are the common compliance issues?"</p>
                            </div>
                        )}
                        {resultChatHistory.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] p-3 rounded-xl text-sm ${
                                    msg.role === 'user' 
                                    ? 'bg-indigo-600 text-white rounded-br-none' 
                                    : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm'
                                }`}>
                                <div className={`prose prose-sm max-w-none ${msg.role === 'user' ? 'prose-invert' : ''}`}>
                                    <ReactMarkdown>
                                        {msg.content}
                                    </ReactMarkdown>
                                </div>
                                </div>
                            </div>
                        ))}
                        {isResultChatLoading && (
                            <div className="flex justify-start">
                                <div className="bg-white border border-gray-200 p-3 rounded-xl rounded-bl-none shadow-sm flex items-center gap-2">
                                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        )}
                        <div ref={resultChatEndRef} />
                    </div>

                    <div className="p-4 bg-white border-t border-gray-200">
                        <form onSubmit={handleResultChatSubmit} className="relative">
                            <input
                                type="text"
                                value={resultChatInput}
                                onChange={(e) => setResultChatInput(e.target.value)}
                                placeholder="Ask about the results..."
                                disabled={isResultChatLoading}
                                className="w-full pl-4 pr-10 py-3 bg-gray-100 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 rounded-xl transition-all outline-none"
                            />
                            <button 
                                type="submit"
                                disabled={!resultChatInput.trim() || isResultChatLoading}
                                className="absolute right-2 top-2 p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                            >
                                <ArrowLeft size={16} className="rotate-180" />
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        )}

      </div>
    </div>
  );
}
