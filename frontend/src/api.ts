const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export type VolunteerPayload = {
  name: string;
  gender?: string;
  fullname?: string;
  birthday?: string;
  legal_id?: string;
  email?: string;
  preferences?: string;
  comment?: string;
  schooling?: number;
  no_volunteer?: boolean;
  no_work?: boolean;
  phones: Array<{ phone: string; whatsapp?: string }>;
  courses: Array<{ level?: string; area?: string; conclusion?: string; course: string }>;
  work_experiences: Array<{ area?: string; period?: string; duration?: string; description: string }>;
  volunteer_experiences: Array<{ period?: string; duration?: string; description: string }>;
  availability: Array<{ day_week?: string; period?: string; hours?: string }>;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail ?? body.message ?? "Nao foi possivel concluir a operacao.");
  }

  return response.json();
}

export function createVolunteer(payload: VolunteerPayload) {
  return request<{ id: string; name: string }>("/volunteers", {
    method: "POST",
    headers: { "x-tenant-slug": "presbiterianos" },
    body: JSON.stringify(payload),
  });
}

export function login(email: string, password: string) {
  return request<{ access_token: string }>("/auth/login", {
    method: "POST",
    headers: { "x-tenant-slug": "redevoluntariado" },
    body: JSON.stringify({ email, password }),
  });
}

export function listVolunteers(token: string) {
  return request<Array<{ id: string; name: string; email?: string; created_at: string; tenant_id: string }>>("/volunteers", {
    headers: { Authorization: `Bearer ${token}` },
  });
}
