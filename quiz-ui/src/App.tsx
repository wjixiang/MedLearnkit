import { QuizBrowser } from "@/components/quiz/QuizBrowser";
import { QuizPaperProvider } from "@/components/quiz/contexts/QuizPaperContext";

export function App() {
  return (
    <QuizPaperProvider>
      <QuizBrowser />
    </QuizPaperProvider>
  );
}

export default App;
