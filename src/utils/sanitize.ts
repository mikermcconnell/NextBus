import DOMPurify from 'isomorphic-dompurify';

export const sanitizeText = (text: string): string => {
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });
}; 