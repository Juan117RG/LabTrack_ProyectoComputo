import { z } from "zod";

const authSchema = {
  register: z.object({
    name: z.string().min(1, "Name is required"),
    email: z.email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters long"),
    role: z.enum(
      ["student", "manager"],
      "Role must be either student or manager",
    ),
  }),
  login: z.object({
    email: z.email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters long"),
  }),
};

export default authSchema;
