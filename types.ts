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

export interface SurveyOption {
  label: string;
  value: string;
}

export interface SurveyQuestion {
  id: string;
  text: string;
  type: QuestionType;
  options?: SurveyOption[]; // For single/multiple choice
  required?: boolean;
  placeholder?: string;
}

export interface SurveySection {
  id: string;
  title: string;
  questions: SurveyQuestion[];
}

export interface SurveySchema {
  title: string;
  description: string;
  sections: SurveySection[];
}

// Generic container for answers to a dynamic form
export interface SurveyAnswers {
  [questionId: string]: string | string[] | number | boolean;
}