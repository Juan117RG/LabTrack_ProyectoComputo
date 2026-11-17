import { z } from "zod";

const authSchema = {
  register: z.object({
    name: z.string().min(1, "Name is required"),
    email: z.email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters long"),
    role: z.literal("student").optional(),
  }),
  login: z.object({
    email: z.email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters long"),
  }),
};

export default authSchema;
