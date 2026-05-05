import axios from 'axios';

type ApiErrorPayload = {
  code?: string;
  message?: string;
  error?: string;
};

export type ParsedApiError = {
  code?: string;
  message: string;
};

export const parseApiError = (error: unknown): ParsedApiError => {
  if (!axios.isAxiosError<ApiErrorPayload>(error)) {
    return {
      message: '通信エラーが発生しました。時間をおいて再度お試しください。',
    };
  }

  const data = error.response?.data;
  const message =
    data?.message || data?.error || error.message || '予約処理に失敗しました。';

  return {
    code: data?.code,
    message,
  };
};
