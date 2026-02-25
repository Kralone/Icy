export interface ApiResponse<T> {
  data: T;
  code: number;
  httpCode: number;
  httpStatus: string;
  messageDetail: {
    title: string;
    message: string;
  };
  timestamp: string;
}
