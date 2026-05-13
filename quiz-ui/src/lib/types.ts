export type Oid = "A" | "B" | "C" | "D" | "E";

export interface QuizOption {
  id: string;
  quiz_id: string;
  oid: Oid;
  text: string;
}

export interface SubQuestion {
  question_id: number;
  question_text: string;
  answer: Oid;
}

export interface QuizAnalysis {
  id: string;
  quiz_id: string;
  point: string;
  discuss: string;
}

export interface QuizTag {
  id: string;
  quiz_id: string;
  user_id: string;
  value: string;
  type: "public" | "private";
  created_at: string;
}

export type QuizType = "A1" | "A2" | "A3" | "B" | "X";

export interface Quiz {
  id: string;
  type: QuizType;
  class: string;
  unit: string;
  question: string | null;
  main_question: string | null;
  answer: Oid | null;
  source: string | null;
  extracted_year: number | null;
  processed_at: string | null;
  created_at: string;
}

export interface QuizWithDetails extends Quiz {
  options: QuizOption[];
  options_map?: Record<string, QuizOption[]>;
  sub_questions?: SubQuestion[];
  analysis: QuizAnalysis | null;
  tags: QuizTag[];
}

export type QuizPractice = QuizWithDetails & {
  userAnswer?: Oid;
  subAnswers?: Record<number, Oid>;
};

export interface QuizFilterMeta {
  types: string[];
  classes: string[];
  units: string[];
  sources: string[];
  years: number[];
}

export interface QuizFilter {
  types?: string;
  classes?: string;
  units?: string;
  sources?: string;
  years?: string;
  search?: string;
  page?: number;
  limit?: number;
  sort_by?: string;
  order?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export type PaperStatus = "selecting" | "preview" | "practicing" | "completed";

export interface SelectedQuiz extends QuizPractice {
  selectedAt: number;
}

export interface QuizPaper {
  id: string;
  title: string;
  quiz_ids: string[];
  created_at: string;
}
