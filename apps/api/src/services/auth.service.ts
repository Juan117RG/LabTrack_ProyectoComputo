import authRepository from "../repositories/auth.repository.js";
import { hashPassword, comparePassword } from "../utils/password.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
} from "../utils/jwt.js";
import { RegisterAuthData, LoginAuthData, User } from "../types/auth.types.js";

const authService = {
  register: async (data: RegisterAuthData): Promise<User> => {
    const existingUser = await authRepository.findByEmail(data.email);
    if (existingUser) {
      throw new Error("Email already exists");
    }

    const hashedPassword = await hashPassword(data.password);
    const newUser = await authRepository.createUser(
      data.name,
      data.email,
      hashedPassword,
      data.role,
    );
    return newUser;
  },

  login: async (
    data: LoginAuthData,
  ): Promise<{ accessToken: string; refreshToken: string }> => {
    const user = await authRepository.findByEmail(data.email);
    if (!user) {
      throw new Error("Invalid credentials");
    }

    const isPasswordValid = await comparePassword(
      data.password,
      user.password_hash,
    );
    if (!isPasswordValid) {
      throw new Error("Invalid credentials");
    }

    const accessToken = await generateAccessToken(user);
    const refreshToken = await generateRefreshToken(user);

    return { accessToken, refreshToken };
  },
  refreshToken: async (
    refreshToken: string,
  ): Promise<{ accessToken: string; newRefreshToken: string }> => {
    try {
      const decoded = await verifyToken(refreshToken);

      const user = await authRepository.findById(decoded.id);
      if (!user) {
        throw new Error("User not found");
      }

      if (user.token_version !== decoded.token_version) {
        throw new Error("Token has been revoked");
      }
      if (user.active !== true) {
        throw new Error("User is not active");
      }
      const accessToken = await generateAccessToken(user);
      const newRefreshToken = await generateRefreshToken(user);

      return { accessToken, newRefreshToken };
    } catch (error) {
      if (error instanceof Error && error.message === "Invalid token") {
        throw new Error("Invalid refresh token");
      } else {
        throw new Error("Unexpected error during token refresh");
      }
    }
  },
  logout: async (refreshToken: string): Promise<void> => {
    try {
      const decoded = await verifyToken(refreshToken);

      const userId = decoded.id;
      const user = await authRepository.findById(userId);
      if (!user) {
        throw new Error("User not found");
      }
      if (user.token_version !== decoded.token_version) {
        throw new Error("Token has already been revoked");
      }
      if (user.active !== true) {
        throw new Error("User is not active");
      }
      await authRepository.incrementTokenVersion(userId);
    } catch (error) {
      throw new Error("Invalid refresh token");
    }
  },
};

export default authService;
