import type {
  Quiz,
  QuizWithDetails,
  QuizFilter,
  QuizFilterMeta,
  PaginatedResponse,
  QuizPaper,
  PublicPaper,
  UserPaper,
  PracticeRecord,
  CreatePracticeRecordRequest,
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  User,
  UpdateProfileRequest,
  DailyPracticeStats,
  SubjectPracticeStats,
  PracticeSummary,
  CalendarDayData,
  DiscussionComment,
  CommentsListResponse,
  CreateCommentRequest,
} from "./types";

const API_BASE = import.meta.env.VITE_API_URL || "http://192.168.123.98:8888";

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function setStoredAuth(token: string, user: User): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearStoredAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getStoredUser(): User | null {
  const userStr = localStorage.getItem(USER_KEY);
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit & {
    params?: Record<string, string | number | undefined>;
  },
): Promise<T> {
  const { params, ...fetchOptions } = options || {};
  const url = new URL(`${API_BASE}${endpoint}`, window.location.origin);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const headers: HeadersInit = {
    ...fetchOptions.headers,
  };

  const token = getStoredToken();
  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url.toString(), {
    ...fetchOptions,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `API Error: ${response.status}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const quizApi = {
  getQuizzes: (filter?: QuizFilter) => {
    return fetchApi<PaginatedResponse<Quiz>>("/api/quizzes", {
      params: filter as Record<string, string | number | undefined>,
    });
  },

  getQuizById: (id: string) => {
    return fetchApi<QuizWithDetails>(`/api/quizzes/${id}`);
  },

  getRandomQuizzes: (filter?: QuizFilter, limit = 10) => {
    return fetchApi<Quiz[]>("/api/quizzes/random", {
      params: { ...filter, limit } as Record<string, string | number | undefined>,
    });
  },

  getFilterMeta: () => {
    return fetchApi<QuizFilterMeta>("/api/quizzes/filter-meta");
  },

  searchQuizzes: (filter?: QuizFilter) => {
    return fetchApi<PaginatedResponse<Quiz>>("/api/quizzes/search", {
      params: filter as Record<string, string | number | undefined>,
    });
  },

  getTags: (search?: string, limit = 10) => {
    return fetchApi<string[]>("/api/tags", { params: { q: search, limit } });
  },

  getQuizTags: (quizId: string) => {
    return fetchApi<QuizWithDetails["tags"]>(`/api/quizzes/${quizId}/tags`);
  },

  async addTag(quizId: string, value: string, tagType: "public" | "private" = "private") {
    const r = await fetch(`${API_BASE}/api/quizzes/${quizId}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quiz_id: quizId, value, tag_type: tagType }),
    });
    return r.json();
  },

  async deleteTag(quizId: string, tagId: string) {
    const r = await fetch(`${API_BASE}/api/quizzes/${quizId}/tags/${tagId}`, {
      method: "DELETE",
    });
    return r.json();
  },

  createPaper: (title: string, quizIds: string[]) => {
    return fetchApi<QuizPaper>("/api/papers", {
      method: "POST",
      params: {},
      body: JSON.stringify({ title, quiz_ids: quizIds }),
    });
  },

  getPapers: () => {
    return fetchApi<QuizPaper[]>("/api/papers");
  },

  getPaperById: (id: string) => {
    return fetchApi<QuizPaper>(`/api/papers/${id}`);
  },

  deletePaper: (id: string) => {
    const r = fetch(`${API_BASE}/api/papers/${id}`, { method: "DELETE" });
    return r;
  },

  // Public papers
  getPublicPapers: () => {
    return fetchApi<PublicPaper[]>("/api/papers/public");
  },

  getPublicPaperById: (id: string) => {
    return fetchApi<PublicPaper>(`/api/papers/public/${id}`);
  },

  // User papers (authenticated)
  getMyPapers: () => {
    return fetchApi<UserPaper[]>("/api/papers/my");
  },

  createMyPaper: (title: string, quizIds: string[]) => {
    return fetchApi<UserPaper>("/api/papers/my", {
      method: "POST",
      body: JSON.stringify({ title, quiz_ids: quizIds }),
    });
  },

  updateMyPaper: (id: string, title: string, quizIds: string[]) => {
    return fetchApi<UserPaper>(`/api/papers/my/${id}`, {
      method: "PUT",
      body: JSON.stringify({ title, quiz_ids: quizIds }),
    });
  },

  deleteMyPaper: (id: string) => {
    const r = fetch(`${API_BASE}/api/papers/my/${id}`, { method: "DELETE" });
    return r;
  },

  // Practice records
  createPracticeRecord: (data: CreatePracticeRecordRequest) => {
    return fetchApi<PracticeRecord>("/api/practices", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  getPracticeRecords: (limit?: number) => {
    return fetchApi<PracticeRecord[]>("/api/practices", {
      params: { limit },
    });
  },
};

export const statsApi = {
  getDailyStats: (days: number = 30, quizClass?: string) => {
    return fetchApi<DailyPracticeStats[]>("/api/practices/stats/daily", {
      params: { days, class: quizClass },
    });
  },

  getSubjectStats: (days: number = 30) => {
    return fetchApi<SubjectPracticeStats[]>("/api/practices/stats/subjects", {
      params: { days },
    });
  },

  getSummary: (days: number = 30) => {
    return fetchApi<PracticeSummary>("/api/practices/stats/summary", {
      params: { days },
    });
  },

  getCalendar: (year?: number) => {
    return fetchApi<CalendarDayData[]>("/api/practices/stats/calendar", {
      params: { year },
    });
  },
};

export const discussionApi = {
  getComments: (quizId: string, page = 1, limit = 20) => {
    return fetchApi<CommentsListResponse>(
      `/api/quizzes/${quizId}/comments`,
      { params: { page, limit } },
    );
  },

  createComment: (quizId: string, data: CreateCommentRequest) => {
    return fetchApi<DiscussionComment>(`/api/quizzes/${quizId}/comments`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  deleteComment: (quizId: string, commentId: string) => {
    return fetchApi<{ success: boolean }>(
      `/api/quizzes/${quizId}/comments/${commentId}`,
      { method: "DELETE" },
    );
  },
};

export const authApi = {
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Login failed" }));
      throw new Error(error.error || "Login failed");
    }

    const data: AuthResponse = await response.json();
    setStoredAuth(data.token, data.user);
    return data;
  },

  async register(data: RegisterRequest): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Registration failed" }));
      throw new Error(error.error || "Registration failed");
    }

    const result: AuthResponse = await response.json();
    setStoredAuth(result.token, result.user);
    return result;
  },

  async getProfile(): Promise<User> {
    return fetchApi<User>("/api/user/profile");
  },

  async updateProfile(data: UpdateProfileRequest): Promise<User> {
    return fetchApi<User>("/api/user/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  logout(): void {
    clearStoredAuth();
  },

  getToken(): string | null {
    return getStoredToken();
  },

  isAuthenticated(): boolean {
    return !!getStoredToken();
  },
};
