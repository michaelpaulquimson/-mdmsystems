import { ErrorCode } from '@mdm/shared';
import axios from 'axios';

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export function parseApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as Record<string, unknown> | undefined;

    if (data && typeof data === 'object') {
      // Backend envelope: { error: { code, message, details } }
      const envelope =
        data['error'] && typeof data['error'] === 'object'
          ? (data['error'] as Record<string, unknown>)
          : data;

      const code = typeof envelope['code'] === 'string' ? envelope['code'] : ErrorCode.INTERNAL;
      const message =
        typeof envelope['message'] === 'string'
          ? envelope['message']
          : error.message || 'An unexpected error occurred';
      const details = envelope['details'];

      return { code, message, details };
    }

    if (error.request) {
      return {
        code: ErrorCode.INTERNAL,
        message: 'Network error — unable to reach the server',
      };
    }

    return {
      code: ErrorCode.INTERNAL,
      message: error.message || 'An unexpected error occurred',
    };
  }

  if (error instanceof Error) {
    return {
      code: ErrorCode.INTERNAL,
      message: error.message,
    };
  }

  return {
    code: ErrorCode.INTERNAL,
    message: 'An unexpected error occurred',
  };
}
