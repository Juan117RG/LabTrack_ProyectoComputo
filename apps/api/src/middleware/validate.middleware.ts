import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodType } from 'zod';
import { errorResponse } from '../utils/response.js';

type ValidationSource = 'body' | 'query' | 'params';

export const validate = (
  schema: ZodType,
  source: ValidationSource = 'body',
): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      return errorResponse(
        res,
        'Invalid data',
        'VALIDATION_ERROR',
        400,
        result.error.issues,
      );
    }

    res.locals.validatedData = result.data;
    return next();
  };
};