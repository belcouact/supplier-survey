export enum Language {
  EN = 'en',
  SC = 'sc',
  TC = 'tc',
}

export type TranslationMatrix = {
  [key: string]: {
    [key in Language]: string;
  };
};

export type QuestionType = 'short_text' | 'long_text' | 'single_choice' | 'multiple_choice' | 'number';

export interface LocalizedText {
  en: string;
  sc: string;
  tc: string;
}

export interface SurveyOption {
  label: LocalizedText;
  value: string;
}

export interface SurveyQuestion {
  id: string;
  text: LocalizedText;
  type: QuestionType;
  options?: SurveyOption[]; // For single/multiple choice
  required?: boolean;
  placeholder?: LocalizedText;
}

export interface SurveySection {
  id: string;
  title: LocalizedText;
  questions: SurveyQuestion[];
}

export interface SurveySchema {
  id?: string;
  title: LocalizedText;
  description: LocalizedText;
  sections: SurveySection[];
}

// Generic container for answers to a dynamic form
export interface SurveyAnswers {
  [questionId: string]: string | string[] | number | boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface SurveyResult {
  id?: string;
  template_id: string;
  user_id: string; // 'anonymous' or UUID
  answers: SurveyAnswers;
  updated_at?: string;
}

export interface UserProfile {
  id: string;
  email: string;
}