import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateSurvey, refineSurvey, getAvailableModels } from '../services/aiService';
import { saveSurveyTemplate, getTemplates, deleteTemplate, duplicateTemplate, updateTemplateTitle, setActiveTemplate, updateSurveyTemplate } from '../services/templateService';
import { getSurveyResultsByTemplate } from '../services/resultService';
import { Language, SurveySchema, SurveyQuestion, LocalizedText, ChatMessage, SurveyResult, SurveyTemplate } from '../types';
import { ArrowLeft, Save, Undo, Plus, Trash2, Edit2, MessageSquare, Check, X, Copy, ChevronLeft, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

interface AdminPageProps {
  language: Language;
}

export function AdminPage({ language }: AdminPageProps) {
  // --- State ---
  const [activeTab, setActiveTab] = useState<'create' | 'templates' | 'analytics'>('create');
  const [userContext, setUserContext] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [generatedSurvey, setGeneratedSurvey] = useState<SurveySchema | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<SurveyTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [showAIModal, setShowAIModal] = useState(false);

  // --- Analytics State ---
  const [selectedAnalyticsTemplateId, setSelectedAnalyticsTemplateId] = useState<string>('');
  const [analyticsResults, setAnalyticsResults] = useState<SurveyResult[]>([]);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  
  // --- Chat State ---
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const tabsContainerRef = useRef<HTMLDivElement>(null);

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

  // --- AI Model State ---
  const [selectedModel, setSelectedModel] = useState<string>('deepseek');
  const [availableModels, setAvailableModels] = useState<string[]>(['deepseek', 'gemini']);

  const handleSetActive = async (e: React.MouseEvent, templateId: string) => {
      e.stopPropagation();
      try {
          await setActiveTemplate(templateId);
          // Update local state to reflect change
          setTemplates(templates.map(t => ({
              ...t,
              is_active: t.id === templateId
          })));
      } catch (err) {
          alert('Failed to set active template');
          console.error(err);
      }
  };

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
          setSelectedAnalyticsTemplateId(templates[0].id);
      }
  }, [activeTab, templates]);

  useEffect(() => {
      if (selectedAnalyticsTemplateId) {
          loadAnalytics(selectedAnalyticsTemplateId);
      }
  }, [selectedAnalyticsTemplateId]);

  // --- Fetch Templates & Models ---
  useEffect(() => {
    loadTemplates();
    loadModels();
  }, []);

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

    try {
      const surveyData = await generateSurvey(userContext, selectedModel);
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

  const handleChatSubmit = async (e?: React.FormEvent) => {
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

  const handleSelectActiveTemplate = async (template: SurveyTemplate) => {
    try {
        await setActiveTemplate(template.id);
        setTemplates(templates.map(t => ({
            ...t,
            is_active: t.id === template.id
        })));
    } catch (err) {
        alert('Failed to set active template');
        console.error(err);
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
        const newTemplate = await duplicateTemplate(template);
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
  };

  const handleSaveHeader = () => {
    if (!generatedSurvey) return;
    pushToHistory();
    
    const newTitle: LocalizedText = typeof generatedSurvey.title === 'string'
        ? { en: tempHeaderTitle, sc: tempHeaderTitle, tc: tempHeaderTitle }
        : { ...generatedSurvey.title, [language]: tempHeaderTitle };

    const newDesc: LocalizedText = typeof generatedSurvey.description === 'string'
        ? { en: tempHeaderDesc, sc: tempHeaderDesc, tc: tempHeaderDesc }
        : { ...generatedSurvey.description, [language]: tempHeaderDesc };

    setGeneratedSurvey({
        ...generatedSurvey,
        title: newTitle,
        description: newDesc
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

  const handleStartEdit = (sectionId: string, currentTitle: LocalizedText | string) => {
    setEditingSectionId(sectionId);
    setTempSectionTitle(getText(currentTitle));
  };

  const handleSaveEdit = () => {
    if (!generatedSurvey || !editingSectionId) return;
    pushToHistory();
    const sections = generatedSurvey.sections.map(section => {
      if (section.id === editingSectionId) {
        const newTitle: LocalizedText = typeof section.title === 'string' 
            ? { en: tempSectionTitle, sc: tempSectionTitle, tc: tempSectionTitle }
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
        label: { ...newOptions[idx].label, [language]: value } 
    };
    if (!newOptions[idx].value || newOptions[idx].value === '') {
       newOptions[idx].value = value;
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
      if (editingTemplateId) {
          await updateSurveyTemplate(editingTemplateId, generatedSurvey);
          alert('Template updated successfully!');
      } else {
          await saveSurveyTemplate(generatedSurvey);
          alert('Template saved successfully!');
      }
      loadTemplates();
    } catch (err) {
      alert('Failed to save template.');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const fontClass = language === Language.SC ? 'font-sc' : language === Language.TC ? 'font-tc' : 'font-sans';

  return (
    <div className={`flex-1 px-4 md:px-8 pb-4 md:pb-8 pt-2 md:pt-4 overflow-y-auto ${fontClass} ${isChatOpen ? 'mr-80 md:mr-96' : ''}`}>
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
                  <div key={template.id} className={`bg-white p-6 rounded-xl border shadow-sm hover:shadow-md transition-shadow group relative ${template.is_active ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50/30' : 'border-gray-200'}`}>
                    {template.is_active && (
                        <div className="absolute top-0 left-0 bg-blue-500 text-white text-xs px-3 py-1 rounded-br-lg rounded-tl-xl font-bold uppercase tracking-wider z-20">
                            Active
                        </div>
                    )}
                    <div className="absolute top-4 right-4 flex gap-1 z-10">
                        <button 
                            onClick={(e) => handleDuplicateTemplate(e, template)}
                            className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-full transition-colors"
                            title="Duplicate Template"
                        >
                            <Copy size={18} />
                        </button>
                        <button 
                            onClick={(e) => handleDeleteTemplate(e, template.id)}
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
                        <button 
                            onClick={() => handleSelectActiveTemplate(template)}
                            disabled={template.is_active}
                            className={`flex-1 px-3 py-2 rounded text-sm font-medium flex items-center justify-center gap-1 transition-colors ${
                                template.is_active 
                                ? 'bg-green-100 text-green-700 cursor-default' 
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                        >
                            {template.is_active ? <Check size={14} /> : null}
                            {template.is_active ? 'Active' : 'Select as Active'}
                        </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}

            {activeTab === 'analytics' && (
                <div className="space-y-6">
                    {/* Template Selector */}
                    <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <label className="font-medium text-gray-700">Select Survey:</label>
                        <select 
                            value={selectedAnalyticsTemplateId}
                            onChange={(e) => setSelectedAnalyticsTemplateId(e.target.value)}
                            className="flex-1 p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
                                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                                    <h3 className="font-bold text-gray-800">Response History</h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 text-gray-500 font-medium">
                                            <tr>
                                                <th className="px-6 py-3">Respondent</th>
                                                <th className="px-6 py-3">Date</th>
                                                <th className="px-6 py-3">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {analyticsResults.map((result) => (
                                                <tr key={result.id} className="hover:bg-gray-50">
                                                    <td className="px-6 py-3 font-medium text-gray-900">
                                                        {result.user_id === 'anonymous' ? 'Anonymous User' : result.user_id}
                                                    </td>
                                                    <td className="px-6 py-3 text-gray-500">
                                                        {new Date(result.updated_at).toLocaleString()}
                                                    </td>
                                                    <td className="px-6 py-3">
                                                        <button className="text-blue-600 hover:underline">View Details</button>
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
                            onChange={(e) => setUserContext(e.target.value)}
                            maxLength={30000}
                            placeholder="e.g. I need to audit a fabric mill in Bangladesh producing organic cotton jersey. Focus on social compliance and water treatment capabilities."
                            className="w-full p-4 pb-8 text-gray-700 text-lg rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none min-h-[200px]"
                        />
                        <div className="absolute bottom-3 right-4 text-xs text-gray-400 font-medium bg-white px-2 rounded-md border border-gray-100 shadow-sm">
                            {userContext.length} / 30000 characters (~{Math.round(userContext.split(/\s+/).filter(w => w.length > 0).length)} words)
                        </div>
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
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors
                                ${isChatOpen 
                                    ? 'bg-blue-100 text-blue-700' 
                                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
                        >
                            <MessageSquare size={18} />
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
                        <>
                            <div className="relative inline-block">
                                <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
                                    {getText(generatedSurvey.title)}
                                </h1>
                            </div>
                            <div className="relative block">
                                <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                                    {getText(generatedSurvey.description)}
                                </p>
                            </div>
                            
                            <button 
                                onClick={handleStartEditHeader}
                                className="absolute top-0 right-0 md:right-20 opacity-0 group-hover/header:opacity-100 transition-opacity p-2 text-gray-400 hover:text-blue-600 bg-white/50 hover:bg-white rounded-full"
                                title="Edit Title & Description"
                            >
                                <Edit2 size={20} />
                            </button>
                        </>
                    )}
                </div>

                {/* Tabs Navigation */}
                <div className="mt-8 mb-6 flex items-center justify-center gap-2">
                    <button 
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
                        {generatedSurvey.sections.map((section, idx) => {
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
                        onClick={() => scrollTabs('right')}
                        className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors flex-shrink-0"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>

                {generatedSurvey.sections.map((section, sIdx) => (
                    sIdx === currentStep && (
                    <div key={section.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all hover:shadow-md group">
                         {/* Section Header */}
                         <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                            {editingSectionId === section.id ? (
                                <div className="flex items-center space-x-2 w-full">
                                    <input
                                        type="text"
                                        value={tempSectionTitle}
                                        onChange={(e) => setTempSectionTitle(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); }}
                                        className="flex-1 px-3 py-1 rounded border border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        autoFocus
                                    />
                                    <button onClick={handleSaveEdit} className="text-green-600 font-medium text-sm">Save</button>
                                    <button onClick={handleCancelEdit} className="text-gray-500 font-medium text-sm">Cancel</button>
                                </div>
                            ) : (
                                <h2 className="text-xl font-bold text-slate-800">{getText(section.title)}</h2>
                            )}

                            <div className="flex items-center space-x-2 ml-4">
                                <button type="button" onClick={() => handleMoveSection(sIdx, 'up')} disabled={sIdx === 0} className="p-1 hover:bg-gray-200 rounded">↑</button>
                                <button type="button" onClick={() => handleMoveSection(sIdx, 'down')} disabled={sIdx === generatedSurvey.sections.length - 1} className="p-1 hover:bg-gray-200 rounded">↓</button>
                                <button type="button" onClick={() => handleStartEdit(section.id, getText(section.title))} className="p-1 hover:bg-gray-200 text-blue-600"><Edit2 size={16} /></button>
                                <button type="button" onClick={() => handleDeleteSection(sIdx)} className="p-1 hover:bg-gray-200 text-red-600"><Trash2 size={16} /></button>
                            </div>
                         </div>

                         {/* Questions List */}
                         <div className="p-6 space-y-6">
                            {section.questions.map((q, qIdx) => (
                                <div key={q.id} className="relative group/q p-4 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200">
                                    {/* Question Edit Controls */}
                                    <div className="absolute right-2 top-2 opacity-0 group-hover/q:opacity-100 transition-opacity flex gap-2 z-10">
                                        <button 
                                            type="button"
                                            onClick={() => handleStartEditQuestion(q)} 
                                            className="p-1.5 bg-white text-blue-600 hover:text-blue-800 rounded shadow-sm border border-gray-200 text-xs font-medium flex items-center gap-1"
                                        >
                                            <Edit2 size={12} /> Edit
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => handleDeleteQuestion(section.id, q.id)} 
                                            className="p-1.5 bg-white text-red-600 hover:text-red-800 rounded shadow-sm border border-gray-200 text-xs font-medium flex items-center gap-1"
                                        >
                                            <Trash2 size={12} /> Delete
                                        </button>
                                    </div>

                                    {editingQuestionId === q.id && tempQuestion ? (
                                        <div className="space-y-4 bg-white p-4 rounded-lg border border-blue-200 shadow-sm">
                                            {/* Edit Form for Question - Simplified for brevity */}
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-gray-500 uppercase">Question Text</label>
                                                <input 
                                                    value={getText(tempQuestion.text)}
                                                    onChange={(e) => updateTempQuestion('text', { ...tempQuestion.text, [language]: e.target.value })}
                                                    className="w-full p-2 border rounded"
                                                />
                                            </div>
                                            
                                            {(tempQuestion.type === 'single_choice' || tempQuestion.type === 'multiple_choice') && (
                                                <div className="space-y-2 mt-4">
                                                    <label className="text-xs font-bold text-gray-500 uppercase">Options</label>
                                                    <div className="space-y-2">
                                                        {tempQuestion.options?.map((opt, oIdx) => (
                                                            <div key={oIdx} className="flex gap-2">
                                                                <input
                                                                    value={getText(opt.label)}
                                                                    onChange={(e) => updateTempOption(oIdx, e.target.value)}
                                                                    className="flex-1 p-2 border rounded text-sm"
                                                                    placeholder="Option text"
                                                                />
                                                                <button 
                                                                    onClick={() => removeTempOption(oIdx)}
                                                                    className="p-2 text-red-500 hover:bg-red-50 rounded border border-gray-200"
                                                                    title="Remove option"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        ))}
                                                        <button 
                                                            onClick={addTempOption}
                                                            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium mt-2"
                                                        >
                                                            <Plus size={16} /> Add Option
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex justify-end gap-2">
                                                <button onClick={handleCancelEditQuestion} className="px-3 py-1 bg-gray-100 rounded">Cancel</button>
                                                <button onClick={handleSaveQuestion} className="px-3 py-1 bg-blue-600 text-white rounded">Save</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <div className="flex items-baseline">
                                                <span className="text-gray-400 mr-2 text-sm font-semibold">{sIdx + 1}.{qIdx + 1}</span>
                                                <span className="font-medium text-gray-800">{getText(q.text)}</span>
                                                {q.required && <span className="text-red-500 ml-1">*</span>}
                                            </div>
                                            
                                            {/* Preview Options */}
                                            {(q.type === 'single_choice' || q.type === 'multiple_choice') && (
                                                <div className="mt-3 space-y-2 ml-6">
                                                    {q.options?.map((opt, oIdx) => (
                                                        <div key={oIdx} className="flex items-center text-sm text-gray-600">
                                                            <div className={`w-4 h-4 mr-3 border flex-shrink-0 flex items-center justify-center ${q.type === 'multiple_choice' ? 'rounded border-gray-300' : 'rounded-full border-gray-300'}`}>
                                                            </div>
                                                            <span>{getText(opt.label)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            
                                            {/* Preview Text Inputs */}
                                            {(q.type === 'short_text' || q.type === 'number') && (
                                                <div className="mt-3 ml-6">
                                                    <div className="w-full max-w-md h-10 border border-gray-200 rounded bg-gray-50/50"></div>
                                                </div>
                                            )}
                                            {q.type === 'long_text' && (
                                                <div className="mt-3 ml-6">
                                                    <div className="w-full max-w-md h-20 border border-gray-200 rounded bg-gray-50/50"></div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                         </div>
                    </div>
                    )
                ))}
            </div>
        )}

        {/* Chat Sidebar */}
        <div className={`fixed top-0 right-0 h-full w-80 md:w-96 bg-white shadow-2xl transform transition-transform duration-300 z-50 flex flex-col border-l border-gray-200 ${isChatOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <MessageSquare size={20} className="text-blue-600" />
                    Survey Assistant
                </h3>
                <button 
                    onClick={() => setIsChatOpen(false)}
                    className="p-1 hover:bg-gray-200 rounded-full text-gray-500"
                >
                    <X size={20} />
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
                {chatHistory.length === 0 ? (
                    <div className="text-center text-gray-400 mt-10 text-sm">
                        <p>Ask me to refine the survey!</p>
                        <p className="mt-2 text-xs">e.g., "Add a question about safety certifications"</p>
                    </div>
                ) : (
                    chatHistory.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm
                                ${msg.role === 'user' 
                                    ? 'bg-blue-600 text-white rounded-br-none' 
                                    : 'bg-white text-gray-700 border border-gray-200 rounded-bl-none'}`}
                            >
                                <div className={`prose prose-sm max-w-none break-words ${
                                msg.role === 'user' ? 'prose-invert text-white' : 'prose-slate text-gray-700'
                            }`}>
                                <ReactMarkdown>
                                    {msg.content}
                                </ReactMarkdown>
                            </div>
                            </div>
                        </div>
                    ))
                )}
                {isChatLoading && (
                    <div className="flex justify-start">
                        <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-none border border-gray-200 shadow-sm flex gap-1">
                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
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
                        placeholder="Type your instruction..."
                        disabled={isChatLoading || !generatedSurvey}
                        className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm"
                    />
                    <button 
                        type="submit"
                        disabled={!chatInput.trim() || isChatLoading || !generatedSurvey}
                        className="absolute right-2 top-2 p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors"
                    >
                        <ArrowLeft size={16} className="rotate-90" />
                    </button>
                </form>
            </div>
        </div>

      </div>
    </div>
  );
}

