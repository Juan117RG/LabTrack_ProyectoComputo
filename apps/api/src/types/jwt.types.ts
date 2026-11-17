export type JWTPayload = {
  id: number;
  role: "student" | "manager" | "admin";
  token_version: number;
};
