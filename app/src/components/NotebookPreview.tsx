import { useState } from 'react';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, Copy } from 'lucide-react';
import DOMPurify from 'dompurify';
import { MarkdownRenderer } from '@/components/chat/MarkdownRenderer';

// Jupyter Notebook 预览组件 - 增强版
export function NotebookPreview({ content }: { content: any }) {
  const [collapsedCells, setCollapsedCells] = useState<Set<number>>(new Set());

  const toggleCell = (index: number) => {
    setCollapsedCells(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(
      () => toast.success('代码已复制'),
      () => toast.error('复制失败')
    );
  };

  return (
    <div className="bg-white h-full overflow-auto">
      <div className="max-w-none mx-auto">
        {content.cells?.map((cell: any, index: number) => {
          const isCollapsed = collapsedCells.has(index);
          const source = Array.isArray(cell.source) ? cell.source.join('') : (cell.source || '');
          
          return (
            <div key={index} className="border-b border-gray-100 group">
              {/* Cell header */}
              <div className="flex items-center gap-2 px-4 py-1 bg-gray-50/80 text-xs text-gray-500 sticky top-0 z-[1]">
                <button
                  onClick={() => toggleCell(index)}
                  className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                >
                  {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  cell.cell_type === 'code' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'bg-green-100 text-green-700'
                }`}>
                  {cell.cell_type === 'code'
                    ? `Code${cell.execution_count != null ? ` [${cell.execution_count}]` : ''}`
                    : 'Markdown'}
                </span>
                {cell.cell_type === 'code' && source && (
                  <button
                    onClick={() => copyCode(source)}
                    className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity hover:text-gray-700"
                    title="复制代码"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Cell content */}
              {!isCollapsed && (
                <div className="px-4 py-2">
                  {cell.cell_type === 'markdown' && (
                    <div className="prose prose-sm max-w-none py-2">
                      <MarkdownRenderer content={source} />
                    </div>
                  )}
                  {cell.cell_type === 'code' && (
                    <div>
                      <div className="bg-[#1e1e1e] text-gray-100 p-3 rounded-lg font-mono text-sm leading-relaxed overflow-x-auto">
                        <pre className="whitespace-pre-wrap break-words">{source}</pre>
                      </div>
                      {cell.outputs?.length > 0 && (
                        <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm overflow-x-auto">
                          {cell.outputs.map((output: any, i: number) => (
                            <div key={i}>
                              {/* Text output */}
                              {output.text && (
                                <pre className="text-gray-800 whitespace-pre-wrap font-mono text-xs">{Array.isArray(output.text) ? output.text.join('') : output.text}</pre>
                              )}
                              {/* Stream output */}
                              {output.output_type === 'stream' && output.text && (
                                <pre className="text-gray-800 whitespace-pre-wrap font-mono text-xs">{Array.isArray(output.text) ? output.text.join('') : output.text}</pre>
                              )}
                              {/* Image output (base64) */}
                              {output.data?.['image/png'] && (
                                <img 
                                  src={`data:image/png;base64,${output.data['image/png']}`} 
                                  alt={`Output ${i}`}
                                  className="max-w-full rounded my-2"
                                />
                              )}
                              {/* HTML output */}
                              {output.data?.['text/html'] && (
                                <div 
                                  className="overflow-auto"
                                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(Array.isArray(output.data['text/html']) ? output.data['text/html'].join('') : output.data['text/html']) }} 
                                />
                              )}
                              {/* Plain text from execute_result */}
                              {output.data?.['text/plain'] && !output.data?.['image/png'] && !output.data?.['text/html'] && (
                                <pre className="text-gray-800 whitespace-pre-wrap font-mono text-xs">{Array.isArray(output.data['text/plain']) ? output.data['text/plain'].join('') : output.data['text/plain']}</pre>
                              )}
                              {/* Error output */}
                              {output.output_type === 'error' && (
                                <pre className="text-red-600 whitespace-pre-wrap font-mono text-xs">{Array.isArray(output.traceback) ? output.traceback.join('\n') : (output.traceback || '')}</pre>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
