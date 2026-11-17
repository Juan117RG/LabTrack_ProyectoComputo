import type { Response } from "express";

export const successResponse = (
  res: Response,
  message: string,
  data: unknown = {},
  status = 200,
) => {
  return res.status(status).json({
    success: true,
    message,
    data,
  });
};

export const errorResponse = (
  res: Response,
  message: string,
  code = "INTERNAL_ERROR",
  status = 500,
  details: unknown = {},
) => {
  return res.status(status).json({
    success: false,
    message,
    error: {
      code,
      details,
    },
  });
};
