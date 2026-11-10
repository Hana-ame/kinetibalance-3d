import React, { useMemo } from 'react';
import katex from 'katex';

interface LatexFormulaProps {
  tex?: string;
  math?: string;
  block?: boolean;
  className?: string;
}

export const LatexFormula: React.FC<LatexFormulaProps> = ({
  tex,
  math,
  block = false,
  className = '',
}) => {
  const formula = tex ?? math ?? '';
  const html = useMemo(() => {
    try {
      return katex.renderToString(formula, {
        displayMode: block,
        throwOnError: false,
        strict: false,
      });
    } catch {
      return formula;
    }
  }, [formula, block]);

  return (
    <span
      className={`${block ? 'block my-1.5 overflow-x-auto' : 'inline-block'} ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
