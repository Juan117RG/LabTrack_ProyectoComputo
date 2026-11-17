import type { Request, Response } from "express";
import authService from "../services/auth.service.js";
import type { RegisterAuthData, LoginAuthData } from "../types/auth.types.js";
import { errorResponse, successResponse } from "../utils/response.js";

// Cookie name used to store the refresh token
const REFRESH_TOKEN_COOKIE_NAME = "refreshToken";

const getRefreshTokenCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge: 24 * 60 * 60 * 1000, //in ms
  path: "/api/auth", // only accessible to here so that it is not sent to other endpoints that only need the access token in the Authorization header
});

const authController = {
  register: async (_req: Request, res: Response) => {
    try {
      const data = res.locals.validatedData as RegisterAuthData;
      const user = await authService.register(data);
      return successResponse(res, "User registered successfully", user);
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.message === "Email already in use") {
          return errorResponse(
            res,
            "Email already in use",
            "EMAIL_ALREADY_IN_USE",
            400,
            [],
          );
        } else {
          return errorResponse(res, error.message, "UNEXPECTED_ERROR", 400, []);
        }
      }
      console.error("Error registering user:", error);
      return errorResponse(
        res,
        "Error registering user",
        "USER_REGISTER_ERROR",
        500,
        [],
      );
    }
  },
  login: async (_req: Request, res: Response) => {
    try {
      const data = res.locals.validatedData as LoginAuthData;
      const { accessToken, refreshToken } = await authService.login(data);

      res.cookie(
        REFRESH_TOKEN_COOKIE_NAME,
        refreshToken,
        getRefreshTokenCookieOptions(),
      );

      return successResponse(res, "User logged in successfully", {
        accessToken,
        refreshToken,
      });
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.message === "Invalid credentials") {
          return errorResponse(
            res,
            "Invalid credentials",
            "INVALID_CREDENTIALS",
            401,
            [],
          );
        }
      }
      console.error("Error logging in user:", error);
      return errorResponse(
        res,
        "Error logging in user",
        "USER_LOGIN_ERROR",
        500,
        [],
      );
    }
  },
  refreshToken: async (req: Request, res: Response) => {
    try {
      const refreshToken =
        req.cookies?.[REFRESH_TOKEN_COOKIE_NAME] || req.body?.refreshToken;
      // using body as fallback but it is not required since we are using HttpOnly cookies to store the refresh token

      if (!refreshToken) {
        return errorResponse(
          res,
          "Refresh token required",
          "TOKEN_REQUIRED",
          400,
          [],
        );
      }

      const { accessToken, newRefreshToken } =
        await authService.refreshToken(refreshToken);

      // update the cookies
      res.cookie(
        REFRESH_TOKEN_COOKIE_NAME,
        newRefreshToken,
        getRefreshTokenCookieOptions(),
      );

      return successResponse(res, "Token refreshed successfully", {
        accessToken,
        refreshToken: newRefreshToken,
      });
    } catch (error: unknown) {
      if (error instanceof Error) {
        switch (error.message) {
          case "User not found":
            return errorResponse(
              res,
              "User not found",
              "USER_NOT_FOUND",
              404,
              [],
            );
          case "Token has been revoked":
            return errorResponse(
              res,
              "Token has been revoked",
              "TOKEN_REVOKED",
              401,
              [],
            );
          case "User is not active":
            return errorResponse(
              res,
              "User is not active",
              "USER_NOT_ACTIVE",
              403,
              [],
            );
          default:
            break;
        }
      }
      console.error("Error refreshing token:", error);
      return errorResponse(
        res,
        "Error refreshing token",
        "TOKEN_REFRESH_ERROR",
        500,
        [],
      );
    }
  },
  logout: async (req: Request, res: Response) => {
    try {
      const refreshToken =
        req.cookies?.[REFRESH_TOKEN_COOKIE_NAME] || req.body?.refreshToken;
      if (refreshToken) {
        await authService.logout(refreshToken);
      }

      // Clear it from the browser
      res.clearCookie(
        REFRESH_TOKEN_COOKIE_NAME,
        getRefreshTokenCookieOptions(),
      );

      return successResponse(res, "User logged out successfully", null);
    } catch (error: unknown) {
      console.error("Error logging out user:", error);
      return errorResponse(
        res,
        "Error logging out user",
        "USER_LOGOUT_ERROR",
        500,
        [],
      );
    }
  },
};

export default authController;
