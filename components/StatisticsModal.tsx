import React, { useMemo } from 'react';
import { X, PieChart as PieChartIcon, List } from 'lucide-react';
import { SurveySchema, SurveyResult, SurveyQuestion } from '../types';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface StatisticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  results: SurveyResult[];
  schema: SurveySchema;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1', '#a4de6c', '#d0ed57'];

export function StatisticsModal({ isOpen, onClose, results, schema }: StatisticsModalProps) {
  if (!isOpen) return null;

  const stats = useMemo(() => {
    const questionStats: Record<string, any> = {};

    schema.sections.forEach(section => {
      section.questions.forEach(question => {
        const answers = results.map(r => r.answers[question.id]).filter(a => a !== undefined && a !== null && a !== '');
        
        if (question.type === 'single_choice' || question.type === 'multiple_choice') {
          const counts: Record<string, number> = {};
          answers.forEach(ans => {
            if (Array.isArray(ans)) {
              ans.forEach(a => {
                counts[String(a)] = (counts[String(a)] || 0) + 1;
              });
            } else {
              counts[String(ans)] = (counts[String(ans)] || 0) + 1;
            }
          });

          // Map option values to labels if possible, or use value itself
          const data = Object.keys(counts).map(key => {
            const option = question.options?.find(opt => opt.value === key);
            return {
              name: option ? option.label : key,
              value: counts[key]
            };
          });
          
          questionStats[question.id] = { type: 'chart', data };
        } else {
          // For text inputs, just list them
          questionStats[question.id] = { type: 'list', data: answers };
        }
      });
    });

    return questionStats;
  }, [results, schema]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full h-full flex flex-col relative overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-blue-50 to-white">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
              <PieChartIcon size={24} />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Survey Statistics</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-gray-50">
          <div className="max-w-5xl mx-auto space-y-8">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-bold text-gray-800 mb-2">Overview</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                        <div className="text-sm text-blue-600 font-medium">Total Responses</div>
                        <div className="text-2xl font-bold text-blue-800">{results.length}</div>
                    </div>
                </div>
            </div>

            {schema.sections.map(section => (
              <div key={section.id} className="space-y-6">
                <h3 className="text-xl font-bold text-slate-800 border-b pb-2">{section.title}</h3>
                {section.questions.map(question => {
                   if (question.type === 'description') return null;
                   const stat = stats[question.id];
                   if (!stat) return null;

                   return (
                     <div key={question.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 break-inside-avoid">
                        <h4 className="font-semibold text-gray-800 mb-4 flex items-start gap-2">
                            <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded mt-0.5">{question.type.replace('_', ' ')}</span>
                            {question.text}
                        </h4>
                        
                        {stat.type === 'chart' ? (
                            <div className="h-[300px] w-full flex items-center justify-center">
                                {stat.data.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={stat.data}
                                                cx="50%"
                                                cy="50%"
                                                labelLine={false}
                                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                                outerRadius={100}
                                                fill="#8884d8"
                                                dataKey="value"
                                            >
                                                {stat.data.map((entry: any, index: number) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="text-gray-400 italic">No data available</div>
                                )}
                            </div>
                        ) : (
                            <div className="bg-gray-50 rounded-lg p-4 max-h-[300px] overflow-y-auto">
                                {stat.data.length > 0 ? (
                                    <ul className="space-y-2">
                                        {stat.data.map((ans: any, idx: number) => (
                                            <li key={idx} className="bg-white p-3 rounded border border-gray-100 text-sm text-gray-700 shadow-sm">
                                                {String(ans)}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="text-gray-400 italic">No responses yet</div>
                                )}
                            </div>
                        )}
                     </div>
                   );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 bg-white flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-100 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
