import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Edit3,
  Filter,
  HandHeart,
  LayoutDashboard,
  ListChecks,
  Lock,
  LogOut,
  Mail,
  Menu,
  Play,
  Plus,
  Save,
  Search,
  Settings,
  Trash2,
  UserCircle,
} from "lucide-react";
import { forwardRef, useEffect, useMemo, useState } from "react";
import type { ButtonHTMLAttributes, FormEvent, InputHTMLAttributes, ReactNode } from "react";
import {
  completeTask,
  createProcess,
  deleteProcess,
  listProcesses,
  login,
  me,
  myCurrentTasks,
  startTask,
  taskFilters,
  taskSummary,
  updateProcess,
} from "./api";
import type {
  ProcessPayload,
  ProcessTask,
  SessionUser,
  TaskFilters,
  TaskPriority,
  TaskProcess,
  TaskStatus,
  TaskSummary,
} from "./api";

type AdminView = "dashboard" | "processes" | "detail" | "form" | "tracking";
type LoginMode = "admin" | "collaborator";

type StepDraft = {
  title: string;
  description: string;
  priority: TaskPriority;
  step_order: number;
  status?: TaskStatus;
  assignee_user_id?: string;
  due_date?: string;
};

type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
};

const emptySummary: TaskSummary = { pending: 0, overdue: 0, completed: 0, blocked: 0, in_progress: 0 };

const priorities: Array<{ value: TaskPriority; label: string }> = [
  { value: "URGENT", label: "Urgente" },
  { value: "HIGH", label: "Alta" },
  { value: "MEDIUM", label: "Media" },
  { value: "LOW", label: "Baixa" },
];

const statuses: Array<{ value: TaskStatus; label: string }> = [
  { value: "PENDING", label: "Pendente" },
  { value: "IN_PROGRESS", label: "Em andamento" },
  { value: "BLOCKED", label: "Bloqueada" },
  { value: "COMPLETED", label: "Concluida" },
  { value: "CANCELED", label: "Cancelada" },
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function AdminTasksArea() {
  const [token, setToken] = useState("");
  const [user, setUser] = useState<SessionUser | null>(null);
  const [message, setMessage] = useState("");

  async function handleLogin(nextToken: string) {
    const sessionUser = await me(nextToken);
    setToken(nextToken);
    setUser(sessionUser);
    setMessage("");
  }

  function logout() {
    setToken("");
    setUser(null);
  }

  if (!token || !user) {
    return <TaskLogin onLogin={handleLogin} message={message} setMessage={setMessage} />;
  }

  if (user.role === "VOLUNTEER") {
    return <CollaboratorTasks token={token} user={user} onLogout={logout} />;
  }

  return <AdminShell token={token} user={user} onLogout={logout} />;
}

function TaskLogin({
  onLogin,
  message,
  setMessage,
}: {
  onLogin: (token: string) => Promise<void>;
  message: string;
  setMessage: (message: string) => void;
}) {
  const [mode, setMode] = useState<LoginMode>("admin");
  const [email, setEmail] = useState("admin@redevoluntariado.org.br");
  const [password, setPassword] = useState("admin123");
  const [tenantSlug, setTenantSlug] = useState("redevoluntariado");
  const [loading, setLoading] = useState(false);

  function switchMode(nextMode: LoginMode) {
    setMode(nextMode);
    setEmail(nextMode === "admin" ? "admin@redevoluntariado.org.br" : "colaborador@presbiterianos.sco.org.br");
    setPassword(nextMode === "admin" ? "admin123" : "voluntario123");
    setTenantSlug(nextMode === "admin" ? "redevoluntariado" : "presbiterianos");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const session = await login(email, password, tenantSlug);
      await onLogin(session.access_token);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel acessar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-primary-soft/40 to-muted p-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-border bg-card p-7 shadow-2xl shadow-foreground/10">
          <h2 className="text-lg font-semibold text-foreground">Entrar na area de tarefas</h2>
          <p className="mt-1 text-sm text-muted-foreground">Use seu e-mail, senha e entidade para acessar.</p>

          <div className="mt-5 grid grid-cols-2 rounded-lg border border-border bg-muted/30 p-1 shadow-inner shadow-foreground/5">
            <button
              type="button"
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                mode === "admin" ? "bg-card text-foreground shadow-md shadow-foreground/10" : "text-muted-foreground hover:bg-muted",
              )}
              onClick={() => switchMode("admin")}
            >
              Administrador
            </button>
            <button
              type="button"
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                mode === "collaborator" ? "bg-card text-foreground shadow-md shadow-foreground/10" : "text-muted-foreground hover:bg-muted",
              )}
              onClick={() => switchMode("collaborator")}
            >
              Colaborador
            </button>
          </div>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <Input id="login-entity" label="Entidade" value={tenantSlug} onChange={(event) => setTenantSlug(event.target.value)} required />
            <Input
              id="login-email"
              label="E-mail"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              leftIcon={<Mail className="h-4 w-4" />}
              required
            />
            <Input
              id="login-password"
              label="Senha"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              leftIcon={<Lock className="h-4 w-4" />}
              required
            />
            {message && <ErrorMessage title="Nao foi possivel entrar" message={message} />}
            <Button type="submit" loading={loading} className="w-full" size="lg">
              Entrar
            </Button>
          </form>

          <div className="mt-6 rounded-lg border border-dashed border-border bg-muted/30 p-4 shadow-inner shadow-foreground/5">
            <p className="text-xs font-semibold text-foreground">Contas de demonstracao</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Clique para preencher os dados principais.</p>
            <div className="mt-2 space-y-1">
              <DemoLoginButton label="Admin Global" email="admin@redevoluntariado.org.br" onClick={() => switchMode("admin")} />
              <DemoLoginButton label="Colaborador" email="colaborador@presbiterianos.sco.org.br" onClick={() => switchMode("collaborator")} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function DemoLoginButton({ label, email, onClick }: { label: string; email: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-col items-start gap-1 rounded px-2 py-2 text-left text-xs shadow-sm shadow-foreground/5 hover:bg-muted"
    >
      <span className="w-full break-all font-mono text-foreground">{email}</span>
      <span className="text-muted-foreground">{label}</span>
    </button>
  );
}

function AdminShell({ token, user, onLogout }: { token: string; user: SessionUser; onLogout: () => void }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [view, setView] = useState<AdminView>("dashboard");
  const [summary, setSummary] = useState<TaskSummary>(emptySummary);
  const [filters, setFilters] = useState<TaskFilters>({ tenants: [], users: [], processes: [] });
  const [processes, setProcesses] = useState<TaskProcess[]>([]);
  const [selectedProcessId, setSelectedProcessId] = useState("");
  const [editingProcess, setEditingProcess] = useState<TaskProcess | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [trackingFilters, setTrackingFilters] = useState<Record<string, string>>({});

  const selectedProcess = useMemo(
    () => processes.find((process) => process.id === selectedProcessId) ?? processes[0],
    [processes, selectedProcessId],
  );

  async function refresh(nextFilters = trackingFilters) {
    setLoading(true);
    try {
      const [nextSummary, nextFiltersData, nextProcesses] = await Promise.all([
        taskSummary(token, nextFilters.tenant_id),
        taskFilters(token),
        listProcesses(token, nextFilters),
      ]);
      setSummary(nextSummary);
      setFilters(nextFiltersData);
      setProcesses(nextProcesses);
      if (!selectedProcessId && nextProcesses[0]) setSelectedProcessId(nextProcesses[0].id);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh({});
  }, []);

  async function completeAdminTask(task: ProcessTask) {
    const note = window.prompt("Observacao ou evidencia de conclusao");
    if (!note) return;
    await completeTask(token, task.id, note);
    setNotice("Etapa concluida e proxima etapa liberada quando aplicavel.");
    await refresh();
  }

  async function removeProcess(process: TaskProcess) {
    if (!window.confirm(`Excluir o processo "${process.title}"?`)) return;
    await deleteProcess(token, process.id);
    setSelectedProcessId("");
    await refresh();
  }

  function openNewForm() {
    setEditingProcess(null);
    setView("form");
  }

  function openEditForm(process: TaskProcess) {
    setEditingProcess(process);
    setView("form");
  }

  return (
    <main className="flex min-h-screen bg-background text-foreground">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} view={view} onView={setView} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} tenantName={tenantLabel(user, filters)} onMenuClick={() => setMobileOpen(true)} onLogout={onLogout} />
        <section className="flex-1 p-4 lg:p-8">
          <PageHeader
            title={pageTitle(view)}
            description={pageDescription(view)}
            actions={
              <Button onClick={openNewForm}>
                <Plus className="h-4 w-4" />
                Novo processo
              </Button>
            }
          />

          {notice && <div className="mb-4 rounded-lg border border-success/20 bg-success/10 px-4 py-3 text-sm text-success">{notice}</div>}

          {loading ? (
            <Loading />
          ) : (
            <>
              {view === "dashboard" && (
                <AdminDashboard
                  summary={summary}
                  processes={processes}
                  onOpen={(process) => {
                    setSelectedProcessId(process.id);
                    setView("detail");
                  }}
                />
              )}
              {view === "processes" && (
                <ProcessList processes={processes} onOpen={(process) => { setSelectedProcessId(process.id); setView("detail"); }} onEdit={openEditForm} onDelete={removeProcess} />
              )}
              {view === "detail" && selectedProcess && (
                <ProcessDetail process={selectedProcess} onEdit={openEditForm} onComplete={completeAdminTask} onDelete={removeProcess} />
              )}
              {view === "form" && (
                <ProcessForm token={token} filters={filters} process={editingProcess} onSaved={async (process) => { setSelectedProcessId(process.id); setView("detail"); await refresh(); }} />
              )}
              {view === "tracking" && (
                <TrackingScreen
                  filters={filters}
                  processes={processes}
                  activeFilters={trackingFilters}
                  onChange={async (nextFilters) => { setTrackingFilters(nextFilters); await refresh(nextFilters); }}
                  onOpen={(process) => { setSelectedProcessId(process.id); setView("detail"); }}
                />
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function Sidebar({
  mobileOpen,
  onClose,
  view,
  onView,
}: {
  mobileOpen: boolean;
  onClose: () => void;
  view: AdminView;
  onView: (view: AdminView) => void;
}) {
  const items: Array<{ view: AdminView; label: string; icon: ReactNode }> = [
    { view: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
    { view: "processes", label: "Processos", icon: <ClipboardList className="h-4 w-4" /> },
    { view: "detail", label: "Detalhes", icon: <ListChecks className="h-4 w-4" /> },
    { view: "form", label: "Formulario", icon: <Settings className="h-4 w-4" /> },
    { view: "tracking", label: "Acompanhamento", icon: <Filter className="h-4 w-4" /> },
  ];

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-30 bg-foreground/40 lg:hidden" onClick={onClose} />}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 transform bg-sidebar text-sidebar-foreground shadow-2xl shadow-foreground/15 transition-transform lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <HandHeart className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Rede Voluntariado</p>
            <p className="text-[11px] text-sidebar-muted">Gestao por entidade</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {items.map((item) => (
            <button
              key={item.view}
              type="button"
              onClick={() => {
                onView(item.view);
                onClose();
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                view === item.view ? "bg-sidebar-active text-sidebar-active-foreground" : "text-sidebar-foreground hover:bg-sidebar-border/40",
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-4 text-[11px] text-sidebar-muted">v1.0 · {new Date().getFullYear()}</div>
      </aside>
    </>
  );
}

function Topbar({
  user,
  tenantName,
  onMenuClick,
  onLogout,
}: {
  user: SessionUser;
  tenantName: string;
  onMenuClick: () => void;
  onLogout: () => void;
}) {
  const initials = user.name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-border bg-card/85 px-4 shadow-sm shadow-foreground/5 backdrop-blur lg:px-6">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="rounded-md p-2 text-muted-foreground hover:bg-muted lg:hidden" aria-label="Abrir menu">
          <Menu className="h-5 w-5" />
        </button>
        <div className="hidden items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-1.5 md:flex">
          <Building2 className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-foreground">{tenantName}</span>
          <span className="text-xs text-muted-foreground">· tarefas</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden flex-col items-end sm:flex">
          <span className="text-sm font-medium text-foreground">{user.name}</span>
          <Badge tone={user.role === "ADMIN" ? "primary" : "neutral"}>{user.role === "ADMIN" ? "Admin" : "Colaborador"}</Badge>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{initials}</div>
        <Button variant="outline" size="sm" onClick={onLogout}>
          <LogOut className="h-3.5 w-3.5" />
          Sair
        </Button>
      </div>
    </header>
  );
}

function AdminDashboard({ summary, processes, onOpen }: { summary: TaskSummary; processes: TaskProcess[]; onOpen: (process: TaskProcess) => void }) {
  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pendentes" value={summary.pending} icon={<CalendarClock className="h-5 w-5" />} tone="info" />
        <StatCard label="Atrasadas" value={summary.overdue} icon={<AlertTriangle className="h-5 w-5" />} tone="warning" />
        <StatCard label="Concluidas" value={summary.completed} icon={<CheckCircle2 className="h-5 w-5" />} tone="primary" />
        <StatCard label="Bloqueadas" value={summary.blocked} icon={<Lock className="h-5 w-5" />} tone="neutral" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Processos recentes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable
              rowKey={(process) => process.id}
              data={processes.slice(0, 6)}
              onRowClick={onOpen}
              columns={[
                { key: "title", header: "Processo", render: (process) => <span className="font-medium">{process.title}</span> },
                { key: "priority", header: "Prioridade", render: (process) => <PriorityBadge priority={process.priority} /> },
                { key: "tasks", header: "Etapas", render: (process) => process.tasks.length },
                { key: "status", header: "Status", render: (process) => <TaskStatusBadge status={process.status} /> },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fluxos ativos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {processes.slice(0, 4).map((process) => (
              <button
                key={process.id}
                type="button"
                onClick={() => onOpen(process)}
                className="flex w-full items-center justify-between rounded-md border border-border bg-muted/30 p-3 text-left shadow-sm shadow-foreground/5 transition-shadow hover:bg-muted hover:shadow-md hover:shadow-foreground/10"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{process.title}</p>
                  <p className="text-xs text-muted-foreground">{process.tasks.filter((task) => task.status === "COMPLETED").length} de {process.tasks.length} etapas</p>
                </div>
                <TaskStatusBadge status={process.status} />
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ProcessList({
  processes,
  onOpen,
  onEdit,
  onDelete,
}: {
  processes: TaskProcess[];
  onOpen: (process: TaskProcess) => void;
  onEdit: (process: TaskProcess) => void;
  onDelete: (process: TaskProcess) => void;
}) {
  return (
    <DataTable
      rowKey={(process) => process.id}
      data={processes}
      onRowClick={onOpen}
      columns={[
        {
          key: "title",
          header: "Processo",
          render: (process) => (
            <div>
              <p className="font-medium">{process.title}</p>
              <p className="mt-0.5 max-w-xl text-xs text-muted-foreground">{process.description || "Sem descricao"}</p>
            </div>
          ),
        },
        { key: "priority", header: "Prioridade", render: (process) => <PriorityBadge priority={process.priority} /> },
        { key: "tasks", header: "Etapas", render: (process) => process.tasks.length },
        { key: "status", header: "Status", render: (process) => <TaskStatusBadge status={process.status} /> },
        {
          key: "actions",
          header: "Acoes",
          className: "w-1 text-right",
          render: (process) => (
            <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
              <Button size="sm" variant="ghost" onClick={() => onOpen(process)}><ArrowRight className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant="ghost" onClick={() => onEdit(process)}><Edit3 className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant="ghost" onClick={() => onDelete(process)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          ),
        },
      ]}
    />
  );
}

function ProcessDetail({
  process,
  onEdit,
  onComplete,
  onDelete,
}: {
  process: TaskProcess;
  onEdit: (process: TaskProcess) => void;
  onComplete: (task: ProcessTask) => void;
  onDelete: (process: TaskProcess) => void;
}) {
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-lg">{process.title}</CardTitle>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{process.description || "Sem descricao"}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <PriorityBadge priority={process.priority} />
              <TaskStatusBadge status={process.status} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onEdit(process)}><Edit3 className="h-4 w-4" />Editar</Button>
            <Button variant="danger" onClick={() => onDelete(process)}><Trash2 className="h-4 w-4" />Excluir</Button>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Linha do tempo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {process.tasks.map((task, index) => (
            <div key={task.id} className="grid gap-4 rounded-md border border-border bg-muted/20 p-4 shadow-sm shadow-foreground/5 md:grid-cols-[44px_1fr_auto]">
              <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold", stepTone(task.status))}>{index + 1}</div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-foreground">{task.title}</p>
                  <TaskStatusBadge status={task.status} />
                  <PriorityBadge priority={task.priority} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{task.description || "Sem descricao"}</p>
                <div className="mt-3 grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
                  <span>Responsavel: {task.assignee?.name ?? "Nao definido"}</span>
                  <span>Prazo: {formatDate(task.due_date)}</span>
                  <span>Criada em: {formatDate(task.created_at)}</span>
                </div>
                {task.completion_note && (
                  <div className="mt-3 rounded-md border border-success/20 bg-success/10 px-3 py-2 text-sm text-success shadow-sm shadow-success/10">
                    {task.completion_note} {task.completed_by ? `· ${task.completed_by.name}` : ""}
                  </div>
                )}
              </div>
              {task.status !== "COMPLETED" && task.status !== "BLOCKED" && (
                <Button size="sm" onClick={() => onComplete(task)}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Concluir
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ProcessForm({
  token,
  filters,
  process,
  onSaved,
}: {
  token: string;
  filters: TaskFilters;
  process: TaskProcess | null;
  onSaved: (process: TaskProcess) => Promise<void>;
}) {
  const [title, setTitle] = useState(process?.title ?? "");
  const [description, setDescription] = useState(process?.description ?? "");
  const [priority, setPriority] = useState<TaskPriority>(process?.priority ?? "MEDIUM");
  const [tenantId, setTenantId] = useState(process?.tenant_id ?? filters.tenants[0]?.id ?? "");
  const [steps, setSteps] = useState<StepDraft[]>(
    process?.tasks.map((task) => ({
      title: task.title,
      description: task.description ?? "",
      priority: task.priority,
      step_order: task.step_order,
      status: task.status,
      assignee_user_id: task.assignee_user_id ?? "",
      due_date: task.due_date ?? "",
    })) ?? [{ title: "", description: "", priority: "MEDIUM", step_order: 1, status: "PENDING" }],
  );
  const [saving, setSaving] = useState(false);
  const scopedUsers = filters.users.filter((item) => !tenantId || item.tenant_id === tenantId);

  function replaceStep(index: number, nextStep: StepDraft) {
    setSteps((current) => current.map((step, stepIndex) => (stepIndex === index ? nextStep : step)));
  }

  function moveStep(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= steps.length) return;
    const next = [...steps];
    const [item] = next.splice(index, 1);
    next.splice(nextIndex, 0, item);
    setSteps(next.map((step, stepIndex) => ({ ...step, step_order: stepIndex + 1 })));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    const payload: ProcessPayload = {
      tenant_id: tenantId || undefined,
      title,
      description,
      priority,
      tasks: steps.map((step, index) => ({
        ...step,
        step_order: index + 1,
        assignee_user_id: step.assignee_user_id || null,
        due_date: step.due_date || null,
      })),
    };
    try {
      const saved = process ? await updateProcess(token, process.id, payload) : await createProcess(token, payload);
      await onSaved(saved);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <Card>
        <CardHeader>
          <CardTitle>{process ? "Editar processo" : "Criar processo"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Input className="md:col-span-2" label="Titulo" required value={title} onChange={(event) => setTitle(event.target.value)} />
            <Select label="Prioridade" value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)}>
              {priorities.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </Select>
            <Select label="Entidade" value={tenantId} onChange={(event) => setTenantId(event.target.value)} disabled={Boolean(process)}>
              {filters.tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
            </Select>
            <Textarea className="md:col-span-4" label="Descricao" value={description} onChange={(event) => setDescription(event.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Etapas obrigatorias</CardTitle>
          <Button type="button" size="sm" onClick={() => setSteps((current) => [...current, { title: "", description: "", priority, step_order: current.length + 1, status: "BLOCKED" }])}>
            <Plus className="h-3.5 w-3.5" /> Etapa
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {steps.map((step, index) => (
            <div key={`${step.step_order}-${index}`} className="rounded-lg border border-border bg-muted/20 p-4 shadow-sm shadow-foreground/5">
              <div className="mb-3 flex items-center justify-between">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-sm font-semibold text-primary">{index + 1}</span>
                <div className="flex gap-1">
                  <Button type="button" size="sm" variant="ghost" onClick={() => moveStep(index, -1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => moveStep(index, 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setSteps((current) => current.filter((_, stepIndex) => stepIndex !== index).map((item, stepIndex) => ({ ...item, step_order: stepIndex + 1 })))}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <Input className="md:col-span-2" label="Titulo da etapa" required value={step.title} onChange={(event) => replaceStep(index, { ...step, title: event.target.value })} />
                <Select label="Prioridade" value={step.priority} onChange={(event) => replaceStep(index, { ...step, priority: event.target.value as TaskPriority })}>
                  {priorities.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </Select>
                <Select label="Status inicial" value={step.status ?? "BLOCKED"} onChange={(event) => replaceStep(index, { ...step, status: event.target.value as TaskStatus })}>
                  {statuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </Select>
                <Select className="md:col-span-2" label="Responsavel" value={step.assignee_user_id ?? ""} onChange={(event) => replaceStep(index, { ...step, assignee_user_id: event.target.value })}>
                  <option value="">Nao definido</option>
                  {scopedUsers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </Select>
                <Input label="Prazo" type="date" value={step.due_date ?? ""} onChange={(event) => replaceStep(index, { ...step, due_date: event.target.value })} />
                <Textarea className="md:col-span-4" label="Descricao" value={step.description} onChange={(event) => replaceStep(index, { ...step, description: event.target.value })} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Button loading={saving}>
        <Save className="h-4 w-4" />
        Salvar processo
      </Button>
    </form>
  );
}

function TrackingScreen({
  filters,
  processes,
  activeFilters,
  onChange,
  onOpen,
}: {
  filters: TaskFilters;
  processes: TaskProcess[];
  activeFilters: Record<string, string>;
  onChange: (filters: Record<string, string>) => Promise<void>;
  onOpen: (process: TaskProcess) => void;
}) {
  const [draft, setDraft] = useState(activeFilters);

  async function submit(event: FormEvent) {
    event.preventDefault();
    await onChange(draft);
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <form className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6" onSubmit={submit}>
          <Select value={draft.tenant_id ?? ""} onChange={(event) => setDraft({ ...draft, tenant_id: event.target.value })}>
            <option value="">Todas as entidades</option>
            {filters.tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
          </Select>
          <Select value={draft.process_id ?? ""} onChange={(event) => setDraft({ ...draft, process_id: event.target.value })}>
            <option value="">Todos os processos</option>
            {filters.processes.map((process) => <option key={process.id} value={process.id}>{process.title}</option>)}
          </Select>
          <Select value={draft.responsible_id ?? ""} onChange={(event) => setDraft({ ...draft, responsible_id: event.target.value })}>
            <option value="">Todos os responsaveis</option>
            {filters.users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
          </Select>
          <Select value={draft.priority ?? ""} onChange={(event) => setDraft({ ...draft, priority: event.target.value })}>
            <option value="">Todas as prioridades</option>
            {priorities.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </Select>
          <Select value={draft.status ?? ""} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>
            <option value="">Todos os status</option>
            {statuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </Select>
          <Button type="submit">
            <Search className="h-4 w-4" />
            Filtrar
          </Button>
        </form>
      </Card>
      <ProcessList processes={processes} onOpen={onOpen} onEdit={onOpen} onDelete={() => undefined} />
    </div>
  );
}

function CollaboratorTasks({ token, user, onLogout }: { token: string; user: SessionUser; onLogout: () => void }) {
  const [tasks, setTasks] = useState<ProcessTask[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      setTasks(await myCurrentTasks(token));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function begin(task: ProcessTask) {
    await startTask(token, task.id);
    await refresh();
  }

  async function finish(task: ProcessTask) {
    await completeTask(token, task.id, notes[task.id] || "Concluido pelo colaborador.");
    setNotes((current) => ({ ...current, [task.id]: "" }));
    await refresh();
  }

  return (
    <main className="min-h-screen bg-background p-4 lg:p-8">
      <div className="mx-auto max-w-5xl">
        <PageHeader
          title="Minhas tarefas"
          description={`${user.name} visualiza somente a etapa atual liberada de cada fluxo.`}
          actions={<Button variant="outline" onClick={onLogout}><LogOut className="h-4 w-4" />Sair</Button>}
        />
        {loading ? (
          <Loading />
        ) : tasks.length === 0 ? (
          <Card className="p-10 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
            <h2 className="mt-4 text-lg font-semibold text-foreground">Nenhuma etapa liberada agora</h2>
            <p className="mt-1 text-sm text-muted-foreground">As proximas atividades aparecem automaticamente quando forem desbloqueadas.</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => (
              <Card key={task.id}>
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <PriorityBadge priority={task.priority} />
                        <TaskStatusBadge status={task.status} />
                      </div>
                      <CardTitle className="mt-3 text-lg">{task.title}</CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">{task.description || "Sem descricao"}</p>
                      <p className="mt-3 text-xs text-muted-foreground">Etapa {task.step_order} · Prazo {formatDate(task.due_date)}</p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-primary">
                      <UserCircle className="h-5 w-5" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea label="Observacao ou evidencia" value={notes[task.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [task.id]: event.target.value }))} />
                  <div className="flex flex-wrap gap-2">
                    {task.status === "PENDING" && <Button onClick={() => begin(task)}><Play className="h-4 w-4" />Iniciar</Button>}
                    <Button onClick={() => finish(task)}><CheckCircle2 className="h-4 w-4" />Concluir etapa</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-xl border border-border bg-card shadow-lg shadow-foreground/5", className)}>{children}</div>;
}

function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("border-b border-border p-5", className)}>{children}</div>;
}

function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn("text-base font-semibold text-foreground", className)}>{children}</h3>;
}

function CardContent({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("p-5", className)}>{children}</div>;
}

function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "primary",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: ReactNode;
  tone?: "primary" | "info" | "warning" | "neutral";
}) {
  const tones = {
    primary: "bg-primary-soft text-primary",
    info: "bg-accent text-accent-foreground",
    warning: "bg-warning/20 text-warning-foreground",
    neutral: "bg-muted text-muted-foreground",
  };
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {icon && <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", tones[tone])}>{icon}</div>}
      </div>
    </Card>
  );
}

function DataTable<T>({ columns, data, rowKey, onRowClick, emptyMessage = "Nenhum registro encontrado." }: {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-md shadow-foreground/5">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className={cn("px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground", column.className)}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-muted-foreground">{emptyMessage}</td>
              </tr>
            ) : (
              data.map((row) => (
                <tr key={rowKey(row)} onClick={() => onRowClick?.(row)} className={cn("border-t border-border transition-colors", onRowClick && "cursor-pointer hover:bg-muted/40")}>
                  {columns.map((column) => <td key={column.key} className={cn("px-4 py-3 text-foreground", column.className)}>{column.render(row)}</td>)}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type ButtonSize = "sm" | "md" | "lg";

const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize; loading?: boolean }>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...rest }, ref) => {
    const variants: Record<ButtonVariant, string> = {
      primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
      secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/70",
      ghost: "hover:bg-muted text-foreground",
      outline: "border border-border bg-card hover:bg-muted text-foreground",
      danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm",
    };
    const sizes: Record<ButtonSize, string> = {
      sm: "h-8 px-3 text-xs",
      md: "h-10 px-4 text-sm",
      lg: "h-11 px-5 text-base",
    };
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          variants[variant],
          sizes[size],
          className,
        )}
        {...rest}
      >
        {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label?: string; leftIcon?: ReactNode; className?: string }>(
  ({ label, leftIcon, className, id, style, ...rest }, ref) => {
    const inputId = id || rest.name;
    return (
      <div className={cn("w-full space-y-1.5", className)}>
        {label && <label htmlFor={inputId} className="block text-sm font-medium text-foreground">{label}</label>}
        <div className="relative">
          {leftIcon && <span className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-muted-foreground">{leftIcon}</span>}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm shadow-foreground/5 placeholder:text-muted-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring focus:shadow-md focus:shadow-primary/10 disabled:cursor-not-allowed disabled:opacity-50",
            )}
            style={{ ...style, paddingLeft: leftIcon ? "2.75rem" : style?.paddingLeft }}
            {...rest}
          />
        </div>
      </div>
    );
  },
);
Input.displayName = "Input";

function Select({
  label,
  className,
  children,
  id,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; className?: string }) {
  const inputId = id || rest.name;
  return (
    <div className={cn("w-full space-y-1.5", className)}>
      {label && <label htmlFor={inputId} className="block text-sm font-medium text-foreground">{label}</label>}
      <select
        id={inputId}
        className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm shadow-foreground/5 focus:outline-none focus:ring-2 focus:ring-ring focus:shadow-md focus:shadow-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
        {...rest}
      >
        {children}
      </select>
    </div>
  );
}

function Textarea({ label, className, id, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; className?: string }) {
  const inputId = id || rest.name;
  return (
    <div className={cn("w-full space-y-1.5", className)}>
      {label && <label htmlFor={inputId} className="block text-sm font-medium text-foreground">{label}</label>}
      <textarea
        id={inputId}
        className="min-h-24 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm shadow-foreground/5 focus:outline-none focus:ring-2 focus:ring-ring focus:shadow-md focus:shadow-primary/10"
        {...rest}
      />
    </div>
  );
}

function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "success" | "danger" | "info" | "warning" | "neutral" | "primary"; className?: string }) {
  const tones = {
    success: "bg-success/15 text-success",
    danger: "bg-destructive/15 text-destructive",
    info: "bg-accent text-accent-foreground",
    warning: "bg-warning/20 text-warning-foreground",
    neutral: "bg-muted text-muted-foreground",
    primary: "bg-primary-soft text-primary",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone], className)}>{children}</span>;
}

function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const tone: Record<TaskStatus, "success" | "danger" | "info" | "warning" | "neutral" | "primary"> = {
    BLOCKED: "warning",
    PENDING: "info",
    IN_PROGRESS: "primary",
    COMPLETED: "success",
    CANCELED: "neutral",
  };
  return <Badge tone={tone[status]}>{statusLabel(status)}</Badge>;
}

function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const tone: Record<TaskPriority, "success" | "danger" | "info" | "warning" | "neutral" | "primary"> = {
    URGENT: "danger",
    HIGH: "warning",
    MEDIUM: "primary",
    LOW: "neutral",
  };
  return <Badge tone={tone[priority]}>{priorityLabel(priority)}</Badge>;
}

function Loading() {
  return (
    <div className="flex items-center justify-center rounded-xl border border-border bg-card p-10 text-sm text-muted-foreground shadow-lg shadow-foreground/5">
      <span className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-primary border-r-transparent" />
      Carregando...
    </div>
  );
}

function ErrorMessage({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3">
      <p className="text-sm font-medium text-destructive">{title}</p>
      <p className="mt-0.5 text-xs text-destructive/80">{message}</p>
    </div>
  );
}

function statusLabel(status: TaskStatus) {
  return statuses.find((item) => item.value === status)?.label ?? status;
}

function priorityLabel(priority: TaskPriority) {
  return priorities.find((item) => item.value === priority)?.label ?? priority;
}

function stepTone(status: TaskStatus) {
  if (status === "COMPLETED") return "bg-success/15 text-success";
  if (status === "IN_PROGRESS") return "bg-primary-soft text-primary";
  if (status === "BLOCKED") return "bg-warning/20 text-warning-foreground";
  return "bg-accent text-accent-foreground";
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("pt-BR");
}

function tenantLabel(user: SessionUser, filters: TaskFilters) {
  return filters.tenants.find((tenant) => tenant.id === user.tenant_id)?.name ?? "Rede Voluntariado";
}

function pageTitle(view: AdminView) {
  const labels: Record<AdminView, string> = {
    dashboard: "Dashboard",
    processes: "Processos",
    detail: "Detalhes do processo",
    form: "Formulario de processo",
    tracking: "Acompanhamento",
  };
  return labels[view];
}

function pageDescription(view: AdminView) {
  const labels: Record<AdminView, string> = {
    dashboard: "Visao geral das tarefas sequenciais no escopo da sua entidade.",
    processes: "Tarefas matriz cadastradas, ordenadas por prioridade.",
    detail: "Linha do tempo completa, incluindo etapas bloqueadas e concluidas.",
    form: "Crie, edite e reorganize etapas obrigatorias do fluxo.",
    tracking: "Filtre por entidade, processo, responsavel, prioridade, status e prazo.",
  };
  return labels[view];
}
