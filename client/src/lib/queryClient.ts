import { QueryClient, QueryFunction } from "@tanstack/react-query";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

function getCsrfTokenFromCookie(): string | null {
  const match = document.cookie
    .split("; ")
    .find(
      (row) =>
        row.startsWith("x-csrf-token=") ||
        row.startsWith("__Host-psifi.x-csrf-token=")
    );
  return match ? match.split("=").slice(1).join("=") : null;
}

let csrfToken: string | null = null;

export async function ensureCsrfToken(): Promise<string | null> {
  if (csrfToken) return csrfToken;
  try {
    const res = await fetch(`${API_BASE}/api/csrf-token`, {
      credentials: "include",
    });
    if (res.ok) {
      const data = await res.json();
      csrfToken = data.csrfToken;
      return csrfToken;
    }
  } catch {
    // CSRF token fetch failed; continue without it
  }
  return getCsrfTokenFromCookie();
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  // Include CSRF token on state-changing requests
  if (["POST", "PUT", "DELETE", "PATCH"].includes(method.toUpperCase())) {
    const token = await ensureCsrfToken();
    if (token) {
      headers["x-csrf-token"] = token;
    }
  }
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(`${API_BASE}${queryKey.join("/")}`, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

// Keys that should remain stale forever (static or auth-managed)
const infiniteStaleKeys = ["/api/auth/me", "/api/graph/schema"];

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

// Override staleTime for specific query keys
const originalDefaultOptions = queryClient.getDefaultOptions();
queryClient.setDefaultOptions({
  ...originalDefaultOptions,
  queries: {
    ...originalDefaultOptions.queries,
    staleTime: 30_000,
  },
});

export { infiniteStaleKeys };
