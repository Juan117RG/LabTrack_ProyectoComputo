import { SignJWT, jwtVerify } from "jose";
import type { JWTPayload } from "../types/jwt.types.js";

const algorithm = "HS512";
type TokenUse = "access" | "refresh";

function signingKey() {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  if (secret.length < 64) {
    throw new Error("JWT_SECRET must be at least 64 bytes");
  }
  return secret;
}

function generateToken({ id, role, token_version }: JWTPayload, tokenUse: TokenUse) {
  return new SignJWT({ id: Number(id), role, token_version, token_use: tokenUse })
    .setProtectedHeader({ alg: algorithm })
    .setIssuedAt()
    .setExpirationTime(tokenUse === "access" ? "15m" : "1d")
    .sign(signingKey());
}

export function generateAccessToken(payload: JWTPayload) {
  return generateToken(payload, "access");
}

export function generateRefreshToken(payload: JWTPayload) {
  return generateToken(payload, "refresh");
}

export async function verifyToken(token: string, tokenUse: TokenUse) {
  const { payload } = await jwtVerify(token, signingKey(), {
    algorithms: [algorithm],
  });
  const { id, role, token_version } = payload;

  if (
    payload.token_use !== tokenUse ||
    typeof id !== "number" || !Number.isSafeInteger(id) || id < 1 ||
    (role !== "student" && role !== "manager" && role !== "admin") ||
    typeof token_version !== "number" || !Number.isSafeInteger(token_version) ||
    token_version < 0
  ) {
    throw new Error("Invalid token");
  }

  return { id, role, token_version };
}
