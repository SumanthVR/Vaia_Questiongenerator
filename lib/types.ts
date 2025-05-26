
export interface Framework {
  id: string;
  name: string;
  questionCount: number;
  description?: string;
}

export interface OriginalQuestion {
  text: string;
  framework: string;
  category?: string;
  ref?: string;
}

export interface Question {
  id: string;
  text: string;
  frameworks: string[];
  originalQuestions: OriginalQuestion[];
  emoji?: string;
  category?: string;
  ref?: string;
  timestamp?: string;
  generatedWithAI?: boolean; // Flag to indicate if the question was generated with AI
}

export interface GenerateQuestionsRequest {
  count: number;
  frameworks: string[];
}

export interface GenerateQuestionsResponse {
  questions: Question[];
}

export interface ApiQuestion {
  text: string;
  originalText: string;
  framework: string;
  category?: string;
  ref?: string;
  generated?: boolean;
  timestamp?: string;
}
