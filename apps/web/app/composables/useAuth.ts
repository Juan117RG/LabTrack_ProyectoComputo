type SessionResponse = { data: { accessToken: string } };

export function useAuth() {
  const accessToken = useState<string | null>("access-token", () => null);
  const restore = async () => {
    if (accessToken.value) return true;
    try {
      const response = await $fetch<SessionResponse>("/api/auth/refresh-token", { method: "POST" });
      accessToken.value = response.data.accessToken;
      return true;
    } catch (error) {
      if ([400, 401, 403, 404].includes((error as { statusCode?: number }).statusCode ?? 0)) return false;
      throw error;
    }
  };
  const request = async <T>(url: string, options: { method?: "GET" | "POST"; body?: Record<string, unknown> } = {}): Promise<T> => {
    if (!await restore()) throw new Error("SESSION_REQUIRED");
    try {
      return await $fetch<T>(url, { ...options, headers: { Authorization: `Bearer ${accessToken.value}` } }) as T;
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode !== 401) throw error;
      accessToken.value = null;
      if (!await restore()) { await navigateTo("/login"); throw new Error("SESSION_REQUIRED"); }
      return await $fetch<T>(url, { ...options, headers: { Authorization: `Bearer ${accessToken.value}` } }) as T;
    }
  };
  const canManage = computed(() => {
    if (!accessToken.value || !import.meta.client) return false;
    try {
      const payload = JSON.parse(atob(accessToken.value.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/")));
      return ["manager", "admin"].includes(payload.role);
    } catch { return false; }
  });
  return { accessToken, restore, request, canManage };
}