/**
 * Standard API response interfaces.
 * All endpoints MUST conform to these shapes.
 */

export interface IApiMeta {
  requestId: string;
  timestamp: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface IApiSuccessResponse<T> {
  success: true;
  data: T;
  meta: IApiMeta;
}

export interface IApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    statusCode: number;
  };
  meta: IApiMeta;
}

export type IApiResponse<T> = IApiSuccessResponse<T> | IApiErrorResponse;
