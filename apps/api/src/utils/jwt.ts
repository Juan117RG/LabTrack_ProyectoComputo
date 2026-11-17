import { SignJWT, jwtVerify } from "jose";
import { JWTPayload } from "../types/jwt.types.js";

const secret = new TextEncoder().encode(process.env.JWT_SECRET);
const alg = "HS512"; // Overkill

export async function generateAccessToken(payload: JWTPayload) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setExpirationTime("15m") // Temporary token with short lifespan for security
    .sign(secret);
}

export async function generateRefreshToken(payload: JWTPayload) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setExpirationTime("1d") // Token to get more temporary tokens, with a longer lifespan
    .sign(secret);
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as JWTPayload;
  } catch (error) {
    throw new Error("Invalid token");
  }
}
