export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  cached?: boolean;
  stats?: Record<string, number>;
} 