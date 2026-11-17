import { verifyToken } from "../utils/jwt.js";
import { errorResponse } from "../utils/response.js";
import authRepository from "../repositories/auth.repository.js";
import { Request, Response, NextFunction } from "express";

const roleHierarchy: { [key: string]: number } = {
  student: 1,
  manager: 2,
  admin: 3,
};
export const authMiddleware = (
  requiredRole: "student" | "manager" | "admin",
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader?.startsWith("Bearer ")) {
        return errorResponse(res, "Token Required", "TOKEN_REQUIRED", 401, []);
      }

      const token = authHeader.split(" ")[1];

      const decoded = await verifyToken(token);

      const user = await authRepository.findById(decoded.id);

      if (!user || !user.active) {
        return errorResponse(res, "User not found", "USER_NOT_FOUND", 401, []);
      }

      if (decoded.token_version !== user.token_version) {
        return errorResponse(res, "Token revoked", "TOKEN_REVOKED", 401, []);
      }

      const role = decoded.role as "student" | "manager" | "admin";

      if (roleHierarchy[role] < roleHierarchy[requiredRole]) {
        return errorResponse(
          res,
          "not_sufficient_permissions",
          "NOT_SUFFICIENT_PERMISSIONS",
          403,
          [],
        );
      }

      //attach for request for later verifications.
      res.locals.user = {
        id: Number(user.id),
        name: user.name,
        email: user.email,
        role: user.role,
      };

      next();
    } catch (error) {
      return errorResponse(res, "Invalid Token", "INVALID_TOKEN", 401, []);
    }
  };
};
