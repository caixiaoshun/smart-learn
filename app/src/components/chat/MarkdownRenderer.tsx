import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        // 自定义代码块样式
        code({ className, children, ...props }) {
          const isInline = !className;
          if (isInline) {
            return (
              <code className="bg-gray-100 text-pink-600 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                {children}
              </code>
            );
          }
          return (
            <code className={`${className} block bg-gray-900 text-gray-100 p-4 rounded-lg text-sm font-mono overflow-x-auto`} {...props}>
              {children}
            </code>
          );
        },
        pre({ children }) {
          return <pre className="my-3 overflow-x-auto">{children}</pre>;
        },
        p({ children }) {
          return <p className="mb-2 last:mb-0">{children}</p>;
        },
        ul({ children }) {
          return <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>;
        },
        ol({ children }) {
          return <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>;
        },
        h1({ children }) {
          return <h1 className="text-lg font-bold mb-2">{children}</h1>;
        },
        h2({ children }) {
          return <h2 className="text-base font-bold mb-2">{children}</h2>;
        },
        h3({ children }) {
          return <h3 className="text-sm font-bold mb-1">{children}</h3>;
        },
        blockquote({ children }) {
          return <blockquote className="border-l-4 border-blue-300 pl-3 my-2 text-gray-600 italic">{children}</blockquote>;
        },
        table({ children }) {
          return (
            <div className="overflow-x-auto my-2">
              <table className="min-w-full border-collapse border border-gray-300 text-sm">{children}</table>
            </div>
          );
        },
        th({ children }) {
          return <th className="border border-gray-300 bg-gray-100 px-3 py-1.5 text-left font-medium">{children}</th>;
        },
        td({ children }) {
          return <td className="border border-gray-300 px-3 py-1.5">{children}</td>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
