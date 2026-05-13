import type {
  Quiz,
  QuizWithDetails,
  QuizFilter,
  QuizFilterMeta,
  PaginatedResponse,
  QuizPaper,
} from "./types";

const API_BASE = import.meta.env.VITE_API_URL || "http://192.168.123.98:8888";

async function fetchApi<T>(
  endpoint: string,
  params?: Record<string, string | number | undefined>,
): Promise<T> {
  const url = new URL(`${API_BASE}${endpoint}`, window.location.origin);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export const quizApi = {
  getQuizzes: (filter?: QuizFilter) => {
    return fetchApi<PaginatedResponse<Quiz>>(
      "/api/quizzes",
      filter as Record<string, string | number | undefined>,
    );
  },

  getQuizById: (id: string) => {
    return fetchApi<QuizWithDetails>(`/api/quizzes/${id}`);
  },

  getRandomQuizzes: (filter?: QuizFilter, limit = 10) => {
    return fetchApi<Quiz[]>("/api/quizzes/random", {
      ...filter,
      limit,
    } as Record<string, string | number | undefined>);
  },

  getFilterMeta: () => {
    return fetchApi<QuizFilterMeta>("/api/quizzes/filter-meta");
  },

  searchQuizzes: (filter?: QuizFilter) => {
    return fetchApi<PaginatedResponse<Quiz>>(
      "/api/quizzes/search",
      filter as Record<string, string | number | undefined>,
    );
  },

  getTags: (search?: string, limit = 10) => {
    return fetchApi<string[]>("/api/tags", { q: search, limit });
  },

  getQuizTags: (quizId: string) => {
    return fetchApi<QuizWithDetails["tags"]>(`/api/quizzes/${quizId}/tags`);
  },

  async addTag(
    quizId: string,
    value: string,
    tagType: "public" | "private" = "private",
  ) {
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
      body: JSON.stringify({ title, quiz_ids: quizIds }),
    } as Record<string, string | number | undefined>);
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
};
