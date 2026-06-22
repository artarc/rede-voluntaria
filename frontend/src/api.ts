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

  if (response.status === 204) {
    return undefined as T;
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

export type UserRole = "ADMIN" | "VOLUNTEER";
export type AdminUserType = "GENERAL_ADMIN" | "ENTITY_ADMIN" | "VOLUNTEER";
export type UserOrigin = "ADMINISTRATOR" | "VOLUNTEER";
export type UserAccountStatus = "PENDING" | "ACTIVE" | "BLOCKED" | "REJECTED" | "INACTIVE";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TaskStatus = "BLOCKED" | "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELED";

export type Tenant = {
  id: string;
  name: string;
  slug: string;
  domain?: string | null;
  is_main: boolean;
  active: boolean;
};

export type SessionUser = {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  role: UserRole;
  origin: UserOrigin;
  account_status: UserAccountStatus;
  active: boolean;
  created_at: string;
};

export type TaskUser = {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
};

export type AdminUser = SessionUser & {
  user_type: AdminUserType;
  user_type_label: string;
  origin_label: string;
  status_label: string;
  tenant_name?: string | null;
  volunteer_id?: string | null;
};

export type VolunteerReviewStatus = "PENDING" | "LOGIN_CREATED" | "REJECTED" | "ARCHIVED";

export type VolunteerSubmission = {
  id: string;
  tenant_id: string;
  name: string;
  gender?: string | null;
  fullname?: string | null;
  birthday?: string | null;
  legal_id?: string | null;
  email?: string | null;
  preferences?: string | null;
  comment?: string | null;
  schooling?: number | null;
  no_volunteer: boolean;
  no_work: boolean;
  review_status: VolunteerReviewStatus;
  created_at: string;
  tenant_name?: string | null;
  user_email?: string | null;
  login_created: boolean;
  status_label: string;
  phones: Array<{ id: string; phone: string; whatsapp?: string | null }>;
  courses: Array<{ id: string; level?: string | null; area?: string | null; conclusion?: string | null; course: string }>;
  work_experiences: Array<{ id: string; area?: string | null; period?: string | null; duration?: string | null; description: string }>;
  volunteer_experiences: Array<{ id: string; period?: string | null; duration?: string | null; description: string }>;
  availability: Array<{ id: string; day_week?: string | null; period?: string | null; hours?: string | null }>;
};

export type ProcessTask = {
  id: string;
  tenant_id: string;
  process_id: string;
  title: string;
  description?: string | null;
  priority: TaskPriority;
  step_order: number;
  status: TaskStatus;
  assignee_user_id?: string | null;
  due_date?: string | null;
  completion_note?: string | null;
  completed_at?: string | null;
  completed_by_id?: string | null;
  created_at: string;
  assignee?: TaskUser | null;
  completed_by?: TaskUser | null;
};

export type TaskProcess = {
  id: string;
  tenant_id: string;
  title: string;
  description?: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
  tasks: ProcessTask[];
};

export type ProcessPayload = {
  tenant_id?: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  tasks: Array<{
    title: string;
    description?: string;
    priority: TaskPriority;
    step_order: number;
    status?: TaskStatus;
    assignee_user_id?: string | null;
    due_date?: string | null;
  }>;
};

export type TaskSummary = {
  pending: number;
  overdue: number;
  completed: number;
  blocked: number;
  in_progress: number;
};

export type TaskFilters = {
  tenants: Tenant[];
  users: TaskUser[];
  processes: TaskProcess[];
};

export function login(email: string, password: string, tenantSlug = "redevoluntariado") {
  return request<{ access_token: string }>("/auth/login", {
    method: "POST",
    headers: { "x-tenant-slug": tenantSlug },
    body: JSON.stringify({ email, password }),
  });
}

export function me(token: string) {
  return request<SessionUser>("/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function listVolunteers(token: string) {
  return request<Array<{ id: string; name: string; email?: string; created_at: string; tenant_id: string }>>("/volunteers", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function listUsers(token: string, filters: Record<string, string> = {}) {
  const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
  const query = params.toString() ? `?${params}` : "";
  return request<AdminUser[]>(`/users${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function updateUser(
  token: string,
  userId: string,
  payload: { name?: string; email?: string; role?: AdminUserType; tenant_id?: string; status?: UserAccountStatus },
) {
  return request<AdminUser>(`/users/${userId}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export function userAction(
  token: string,
  userId: string,
  action: "approve" | "reject" | "block" | "unblock" | "deactivate",
) {
  return request<AdminUser>(`/users/${userId}/${action}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function resendUserAccess(token: string, userId: string) {
  return request<{ message: string; user: AdminUser }>(`/users/${userId}/resend-access`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function listVolunteerSubmissions(token: string, filters: Record<string, string> = {}) {
  const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
  const query = params.toString() ? `?${params}` : "";
  return request<VolunteerSubmission[]>(`/volunteer-submissions${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function createVolunteerLogin(token: string, volunteerId: string, password?: string) {
  return request<{ message: string; temporary_password?: string | null; volunteer: VolunteerSubmission }>(
    `/volunteer-submissions/${volunteerId}/create-login`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ password: password || undefined }),
    },
  );
}

export function rejectVolunteerSubmission(token: string, volunteerId: string) {
  return request<VolunteerSubmission>(`/volunteer-submissions/${volunteerId}/reject`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function taskSummary(token: string, tenantId?: string) {
  const params = tenantId ? `?tenant_id=${tenantId}` : "";
  return request<TaskSummary>(`/tasks/summary${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function taskFilters(token: string) {
  return request<TaskFilters>("/tasks/filters", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function listProcesses(token: string, filters: Record<string, string> = {}) {
  const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
  const query = params.toString() ? `?${params}` : "";
  return request<TaskProcess[]>(`/task-processes${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function createProcess(token: string, payload: ProcessPayload) {
  return request<TaskProcess>("/task-processes", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export function updateProcess(token: string, processId: string, payload: ProcessPayload) {
  return request<TaskProcess>(`/task-processes/${processId}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export function deleteProcess(token: string, processId: string) {
  return request<void>(`/task-processes/${processId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function deleteTask(token: string, taskId: string) {
  return request<TaskProcess>(`/tasks/${taskId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function startTask(token: string, taskId: string) {
  return request<ProcessTask>(`/tasks/${taskId}/start`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function completeTask(token: string, taskId: string, completionNote: string) {
  return request<ProcessTask>(`/tasks/${taskId}/complete`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ completion_note: completionNote }),
  });
}

export function myCurrentTasks(token: string) {
  return request<ProcessTask[]>("/tasks/my-current", {
    headers: { Authorization: `Bearer ${token}` },
  });
}
