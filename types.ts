export type QuestionType = 'short_text' | 'long_text' | 'single_choice' | 'multiple_choice' | 'number' | 'description';

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
  default_value?: string;
}

export interface SurveySection {
  id: string;
  title: string;
  questions: SurveyQuestion[];
}

export interface SurveySchema {
  id?: string;
  short_id?: string;
  title: string;
  description: string;
  sections: SurveySection[];
  expiration_date?: string;
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
  user_id: string | null; // null for anonymous, UUID for authenticated
  answers: SurveyAnswers;
  updated_at?: string;
}

export type UserRole = 'super_admin' | 'admin' | 'common_user';

export interface UserProfile {
  id: string;
  email: string;
  role?: UserRole;
  created_at?: string;
  last_sign_in_at?: string;
}

export interface SurveyTemplate {
  id: string;
  short_id?: string;
  title: string;
  description: string;
  schema: SurveySchema;
  created_at: string;
  is_active: boolean;
  expiration_date?: string;
}
