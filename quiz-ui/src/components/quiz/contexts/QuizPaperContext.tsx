import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  type ReactNode,
} from "react";
import type { QuizPractice, QuizPaper, SelectedQuiz } from "@/lib/types";

export type View = "select" | "preview" | "practice";

interface LoadedPaper {
  id: string;
  title: string;
  quizzes: SelectedQuiz[];
  created_at: string;
}

interface QuizPaperState {
  view: View;
  selectedQuizzes: SelectedQuiz[];
  savedPapers: QuizPaper[];
  currentPaper: LoadedPaper | null;
  currentIndex: number;
}

type QuizPaperAction =
  | { type: "TOGGLE_QUIZ"; payload: QuizPractice }
  | { type: "REMOVE_QUIZ"; payload: string }
  | { type: "CLEAR_ALL" }
  | { type: "REORDER"; payload: { from: number; to: number } }
  | { type: "TO_PREVIEW" }
  | { type: "TO_PRACTICE" }
  | { type: "BACK_TO_SELECT" }
  | { type: "BACK_TO_PREVIEW" }
  | { type: "SET_INDEX"; payload: number }
  | { type: "SET_SAVED_PAPERS"; payload: QuizPaper[] }
  | { type: "ADD_PAPER"; payload: QuizPaper }
  | { type: "REMOVE_PAPER"; payload: string }
  | { type: "LOAD_PAPER"; payload: { paper: QuizPaper; quizzes: SelectedQuiz[] } }
  | { type: "HYDRATE"; payload: Partial<QuizPaperState> };

const MAX_SELECT = 50;

const initialState: QuizPaperState = {
  view: "select",
  selectedQuizzes: [],
  savedPapers: [],
  currentPaper: null,
  currentIndex: 0,
};

function quizPaperReducer(
  state: QuizPaperState,
  action: QuizPaperAction,
): QuizPaperState {
  switch (action.type) {
    case "TOGGLE_QUIZ": {
      const exists = state.selectedQuizzes.find(
        (q) => q.id === action.payload.id,
      );
      if (exists) {
        return {
          ...state,
          selectedQuizzes: state.selectedQuizzes.filter(
            (q) => q.id !== action.payload.id,
          ),
        };
      }
      if (state.selectedQuizzes.length >= MAX_SELECT) {
        return state;
      }
      return {
        ...state,
        selectedQuizzes: [
          ...state.selectedQuizzes,
          { ...action.payload, selectedAt: Date.now() },
        ],
      };
    }
    case "REMOVE_QUIZ":
      return {
        ...state,
        selectedQuizzes: state.selectedQuizzes.filter(
          (q) => q.id !== action.payload,
        ),
      };
    case "CLEAR_ALL":
      return {
        ...state,
        selectedQuizzes: [],
      };
    case "REORDER": {
      const { from, to } = action.payload;
      const newQuizzes = [...state.selectedQuizzes];
      const [moved] = newQuizzes.splice(from, 1);
      newQuizzes.splice(to, 0, moved);
      return {
        ...state,
        selectedQuizzes: newQuizzes,
      };
    }
    case "TO_PREVIEW":
      return {
        ...state,
        view: "preview",
      };
    case "TO_PRACTICE":
      return {
        ...state,
        view: "practice",
      };
    case "BACK_TO_SELECT":
      return {
        ...state,
        view: "select",
        selectedQuizzes: [],
      };
    case "BACK_TO_PREVIEW":
      return {
        ...state,
        view: "preview",
      };
    case "SET_INDEX":
      return {
        ...state,
        currentIndex: action.payload,
      };
    case "SET_SAVED_PAPERS":
      return {
        ...state,
        savedPapers: action.payload,
      };
    case "ADD_PAPER":
      return {
        ...state,
        savedPapers: [...state.savedPapers, action.payload],
      };
    case "REMOVE_PAPER":
      return {
        ...state,
        savedPapers: state.savedPapers.filter((p) => p.id !== action.payload),
      };
    case "LOAD_PAPER":
      return {
        ...state,
        currentPaper: {
          id: action.payload.paper.id,
          title: action.payload.paper.title,
          quizzes: action.payload.quizzes,
          created_at: action.payload.paper.created_at,
        },
        view: "practice",
        currentIndex: 0,
      };
    case "HYDRATE":
      return {
        ...state,
        ...action.payload,
      };
    default:
      return state;
  }
}

interface QuizPaperContextValue {
  state: QuizPaperState;
  dispatch: React.Dispatch<QuizPaperAction>;
  maxSelect: number;
  selectedCount: number;
  isSelected: (quizId: string) => boolean;
}

const QuizPaperContext = createContext<QuizPaperContextValue | null>(null);

const STORAGE_KEY = "quizPaperState";

export function QuizPaperProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(quizPaperReducer, initialState);

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        dispatch({ type: "HYDRATE", payload: parsed });
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    const { view, selectedQuizzes } = state;
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ view, selectedQuizzes }),
    );
  }, [state.view, state.selectedQuizzes]);

  const isSelected = (quizId: string) =>
    state.selectedQuizzes.some((q) => q.id === quizId);

  return (
    <QuizPaperContext.Provider
      value={{
        state,
        dispatch,
        maxSelect: MAX_SELECT,
        selectedCount: state.selectedQuizzes.length,
        isSelected,
      }}
    >
      {children}
    </QuizPaperContext.Provider>
  );
}

export function useQuizPaper() {
  const ctx = useContext(QuizPaperContext);
  if (!ctx) {
    throw new Error("useQuizPaper must be used within QuizPaperProvider");
  }
  return ctx;
}

export type { LoadedPaper };
