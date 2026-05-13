import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import type { Components } from "react-markdown";

interface ChatMarkdownProps {
  content: string;
  className?: string;
}

const markdownComponents: Components = {
  code({ className, children, ...props }) {
    const isInline = !className;
    if (isInline) {
      return (
        <code
          className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono"
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code className={`${className ?? ""} block`} {...props}>
        {children}
      </code>
    );
  },
  pre({ children }) {
    return (
      <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">
        {children}
      </pre>
    );
  },
  table({ children }) {
    return (
      <div className="overflow-x-auto my-2">
        <table className="border-collapse border border-border text-sm">
          {children}
        </table>
      </div>
    );
  },
  th({ children }) {
    return (
      <th className="border border-border px-3 py-1.5 bg-muted font-semibold text-left">
        {children}
      </th>
    );
  },
  td({ children }) {
    return (
      <td className="border border-border px-3 py-1.5">{children}</td>
    );
  },
};

function processRefAnnotations(text: string): string {
  return text.replace(
    /\[ref:(\d+)\]/g,
    '<sup class="inline-flex items-center justify-center w-4 h-4 text-[10px] font-medium rounded-full bg-primary/15 text-primary mx-0.5">$1</sup>',
  );
}

export function ChatMarkdown({ content, className }: ChatMarkdownProps) {
  if (!content) return null;

  const processedContent = processRefAnnotations(
    typeof content === "string" ? content : String(content),
  );

  return (
    <div className={`prose prose-sm max-w-none dark:prose-invert ${className ?? ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeKatex]}
        components={markdownComponents}
        allowedElements={undefined}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
