import { Response } from 'express';

export interface ApiResponseData {
  message?: string;
  data?: any;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export class ApiResponse {
  /**
   * Успешный ответ (200)
   */
  static success(res: Response, payload: ApiResponseData = {}): void {
    res.status(200).json({
      success: true,
      message: payload.message || 'Success',
      ...(payload.data && { data: payload.data }),
      ...(payload.meta && { meta: payload.meta }),
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Создано (201)
   */
  static created(res: Response, payload: ApiResponseData = {}): void {
    res.status(201).json({
      success: true,
      message: payload.message || 'Created successfully',
      ...(payload.data && { data: payload.data }),
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Принято (202)
   */
  static accepted(res: Response, payload: ApiResponseData = {}): void {
    res.status(202).json({
      success: true,
      message: payload.message || 'Accepted',
      ...(payload.data && { data: payload.data }),
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Нет содержимого (204)
   */
  static noContent(res: Response): void {
    res.status(204).send();
  }

  /**
   * Неверный запрос (400)
   */
  static badRequest(res: Response, message = 'Bad Request', details?: any): void {
    res.status(400).json({
      success: false,
      error: message,
      ...(details && { details }),
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Неавторизован (401)
   */
  static unauthorized(res: Response, message = 'Unauthorized'): void {
    res.status(401).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Запрещено (403)
   */
  static forbidden(res: Response, message = 'Forbidden'): void {
    res.status(403).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Не найдено (404)
   */
  static notFound(res: Response, message = 'Not Found'): void {
    res.status(404).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Конфликт (409)
   */
  static conflict(res: Response, message = 'Conflict'): void {
    res.status(409).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Слишком много запросов (429)
   */
  static tooManyRequests(res: Response, message = 'Too Many Requests', retryAfter?: number): void {
    const response: any = {
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    };

    if (retryAfter) {
      response.retryAfter = retryAfter;
      res.setHeader('Retry-After', retryAfter.toString());
    }

    res.status(429).json(response);
  }

  /**
   * Внутренняя ошибка сервера (500)
   */
  static internalError(res: Response, message = 'Internal Server Error'): void {
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Плохой шлюз (502)
   */
  static badGateway(res: Response, message = 'Bad Gateway'): void {
    res.status(502).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Сервис недоступен (503)
   */
  static serviceUnavailable(res: Response, message = 'Service Unavailable'): void {
    res.status(503).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Время ожидания шлюза истекло (504)
   */
  static gatewayTimeout(res: Response, message = 'Gateway Timeout'): void {
    res.status(504).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Неподдерживаемый тип медиа (415)
   */
  static unsupportedMediaType(res: Response, message = 'Unsupported Media Type'): void {
    res.status(415).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Ошибка валидации (422)
   */
  static unprocessableEntity(res: Response, message = 'Validation Error', details?: any): void {
    res.status(422).json({
      success: false,
      error: message,
      ...(details && { details }),
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Универсальный метод для отправки кастомного ответа
   */
  static custom(res: Response, statusCode: number, payload: { success: boolean; message: string; data?: any; details?: any }): void {
    res.status(statusCode).json({
      ...payload,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Метод для пагинации данных
   */
  static paginated(res: Response, data: any[], page: number, limit: number, total: number, message = 'Data retrieved successfully'): void {
    const totalPages = Math.ceil(total / limit);
    
    res.status(200).json({
      success: true,
      message,
      data,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      },
      timestamp: new Date().toISOString()
    });
  }
}