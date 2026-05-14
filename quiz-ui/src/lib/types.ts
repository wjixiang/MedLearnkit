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

export interface PublicPaper {
  id: string;
  title: string;
  description: string | null;
  quiz_ids: string[];
  quiz_count: number;
  source: string | null;
  tags: string[];
  created_at: string;
}

export interface UserPaper {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  quiz_ids: string[];
  quiz_count: number;
  created_at: string;
}

export interface PracticeRecord {
  id: string;
  user_id: string;
  quiz_id: string;
  quiz_type: string;
  quiz_class: string;
  user_answer: string | null;
  is_correct: boolean;
  time_spent_seconds: number;
  created_at: string;
}

export interface CreatePracticeRecordRequest {
  quiz_id: string;
  quiz_type: string;
  quiz_class: string;
  user_answer: string | null;
  is_correct: boolean;
  time_spent_seconds: number;
}

export interface PaperRecord {
  id: string;
  user_id: string;
  paper_id: string;
  score: number | null;
  total_questions: number;
  correct_count: number;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface PaperAnswer {
  id: string;
  paper_record_id: string;
  quiz_id: string;
  user_answer: string | null;
  is_correct: boolean;
  time_spent_seconds: number;
  order_index: number;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  username: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  username?: string;
}

export interface UpdateProfileRequest {
  username?: string;
  avatar_url?: string;
}

// Practice statistics types

export interface ClassBreakdown {
  quiz_class: string;
  count: number;
  correct_count: number;
}

export interface DailyPracticeStats {
  date: string;
  total_count: number;
  correct_count: number;
  accuracy: number;
  avg_time_seconds: number;
  by_class: ClassBreakdown[];
}

export interface TypeBreakdown {
  quiz_type: string;
  count: number;
  correct_count: number;
}

export interface SourceBreakdown {
  source: string;
  count: number;
  correct_count: number;
}

export interface SubjectPracticeStats {
  quiz_class: string;
  total_count: number;
  correct_count: number;
  accuracy: number;
  avg_time_seconds: number;
  by_type: TypeBreakdown[];
  by_source: SourceBreakdown[];
}

export interface PracticeSummary {
  total_practiced: number;
  total_correct: number;
  overall_accuracy: number;
  avg_time_seconds: number;
  current_streak: number;
  longest_streak: number;
  total_days_practiced: number;
}

export interface CalendarDayData {
  date: string;
  count: number;
  correct_count: number;
}

// Discussion types

export interface DiscussionComment {
  id: string;
  quiz_id: string;
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  parent_id: string | null;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface DiscussionCommentWithReplies extends DiscussionComment {
  replies: DiscussionComment[];
}

export interface CommentsListResponse {
  data: DiscussionCommentWithReplies[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateCommentRequest {
  content: string;
  parent_id?: string;
}
