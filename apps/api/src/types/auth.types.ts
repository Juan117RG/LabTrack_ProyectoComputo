export type RegisterAuthData = {
  name: string;
  email: string;
  password: string;
  role: "student" | "manager";
};

export type LoginAuthData = {
  email: string;
  password: string;
};

export type User = {
  id: number;
  name: string;
  email: string;
  role: "student" | "manager";
};
