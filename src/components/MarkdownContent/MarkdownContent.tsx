import { memo, useState, type ComponentPropsWithoutRef } from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { isAllowedImageUrl } from '../../core/media';

function extractText(node: unknown): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (node && typeof node === 'object' && 'props' in node) {
    const props = (node as { props?: { children?: unknown } }).props;
    return extractText(props?.children);
  }
  return '';
}

function CodeBlock({ children, ...props }: ComponentPropsWithoutRef<'pre'>) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(extractText(children).replace(/\n$/, ''));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="agichat-codeblock">
      <button type="button" className="agichat-codeblock__copy" onClick={copy}>
        {copied ? 'Copiado' : 'Copiar'}
      </button>
      <pre {...props}>{children}</pre>
    </div>
  );
}

/**
 * Imágenes del agente (p. ej. pósters). Solo se cargan desde dominios confiables; cualquier
 * otra se reemplaza por su texto alternativo para evitar la exfiltración de datos por URL.
 */
function SafeImage({ src, alt }: ComponentPropsWithoutRef<'img'>) {
  const url = typeof src === 'string' ? src : undefined;
  if (!isAllowedImageUrl(url)) {
    return alt ? <span className="agichat-markdown__image-blocked">[{alt}]</span> : null;
  }
  return (
    <img
      className="agichat-markdown__image"
      src={url}
      alt={alt ?? ''}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
}

const components: Components = {
  a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
  pre: ({ node: _node, ...props }) => <CodeBlock {...props} />,
  img: ({ node: _node, ...props }) => <SafeImage {...props} />,
  table: ({ node: _node, ...props }) => (
    <div className="agichat-table-wrapper">
      <table {...props} />
    </div>
  ),
};

export interface MarkdownContentProps {
  content: string;
}

/**
 * Renderiza Markdown (GFM: tablas, listas de tareas, tachado, etc.).
 * No interpreta HTML crudo, lo que evita inyecciones XSS desde la respuesta del agente.
 */
export const MarkdownContent = memo(function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <div className="agichat-markdown">
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </Markdown>
    </div>
  );
});
