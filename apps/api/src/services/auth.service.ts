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
      "student",
    );
    return newUser;
  },

  login: async (
    data: LoginAuthData,
  ): Promise<{ accessToken: string; refreshToken: string }> => {
    const user = await authRepository.findByEmail(data.email);
    if (!user || !user.active) {
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
    let decoded;
    try {
      decoded = await verifyToken(refreshToken, "refresh");
    } catch {
      throw new Error("Invalid refresh token");
    }

    const user = await authRepository.findById(decoded.id);
    if (!user || !user.active) {
      throw new Error("User not found");
    }

    // Verify token version has not been revoked by a logout or password reset
    if (user.token_version !== decoded.token_version) {
      throw new Error("Token has been revoked");
    }
    if (user.active !== true) {
      throw new Error("User is not active");
    }
    const accessToken = await generateAccessToken(user);
    const newRefreshToken = await generateRefreshToken(user);

    return { accessToken, newRefreshToken };
  },
  logout: async (
    refreshToken: string,
    authenticatedUserId: number,
  ): Promise<void> => {
    let decoded;
    try {
      decoded = await verifyToken(refreshToken, "refresh");
    } catch (error) {
      throw new Error("Invalid refresh token");
    }
    const userId = decoded.id;
    if (userId !== authenticatedUserId) {
      throw new Error("Invalid refresh token");
    }
    const user = await authRepository.findById(userId);
    if (!user || !user.active) {
      throw new Error("User not found");
    }
    if (user.token_version !== decoded.token_version) {
      throw new Error("Token has already been revoked");
    }
    if (user.active !== true) {
      throw new Error("User is not active");
    }
    await authRepository.incrementTokenVersion(userId);
  },
};

export default authService;
