import {
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  Clock3,
  HeartHandshake,
  LockKeyhole,
  LogIn,
  Mail,
  Menu,
  Phone,
  Plus,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { createVolunteer, listVolunteers, login, VolunteerPayload } from "./api";

type Page = "home" | "presbiterianos" | "cadastro" | "admin";

const ongs = [
  "3rs-solucoes-sustentaveis.png",
  "aarsonorte.png",
  "abrigo-novo-comeco.png",
  "ademoc.png",
  "adora.png",
  "alimento-solar.png",
  "amor-e-esperanca.png",
  "anda.png",
  "apae.png",
  "apelo-canino.png",
  "associacao-presente.png",
  "capelo-gaivota.png",
];

const days = [
  ["seg", "Seg"],
  ["ter", "Ter"],
  ["qua", "Qua"],
  ["qui", "Qui"],
  ["sex", "Sex"],
  ["sab", "Sab"],
  ["dom", "Dom"],
];

const periods = [
  ["m", "Manha"],
  ["t", "Tarde"],
  ["n", "Noite"],
];

const initialPayload: VolunteerPayload = {
  name: "",
  gender: "",
  fullname: "",
  birthday: "",
  legal_id: "",
  email: "",
  preferences: "",
  comment: "",
  schooling: undefined,
  no_volunteer: false,
  no_work: false,
  phones: [{ phone: "", whatsapp: "s" }],
  courses: [],
  work_experiences: [],
  volunteer_experiences: [],
  availability: [{ day_week: "seg", period: "m", hours: "" }],
};

export function App() {
  const [page, setPage] = useState<Page>("home");

  return (
    <div className="app">
      <Header page={page} onNavigate={setPage} />
      {page === "home" && <HomePage onNavigate={setPage} />}
      {page === "presbiterianos" && <TenantPage onNavigate={setPage} />}
      {page === "cadastro" && <VolunteerForm />}
      {page === "admin" && <AdminPage />}
      <Footer />
    </div>
  );
}

function Header({ page, onNavigate }: { page: Page; onNavigate: (page: Page) => void }) {
  const [open, setOpen] = useState(false);

  const itemClass = (target: Page) => `nav-link ${page === target ? "active" : ""}`;

  return (
    <header className="site-header">
      <button className="brand" onClick={() => onNavigate("home")} aria-label="Ir para home">
        <img src="/assets/rede/logo-rede-voluntariado.png" alt="Rede Voluntariado" />
      </button>
      <button className="menu-button" onClick={() => setOpen((value) => !value)} aria-label="Abrir menu">
        <Menu size={22} />
      </button>
      <nav className={open ? "nav open" : "nav"}>
        <button className={itemClass("home")} onClick={() => onNavigate("home")}>
          Rede
        </button>
        <button className={itemClass("presbiterianos")} onClick={() => onNavigate("presbiterianos")}>
          Presbiterianos
        </button>
        <button className={itemClass("cadastro")} onClick={() => onNavigate("cadastro")}>
          Cadastro
        </button>
        <button className="nav-action" onClick={() => onNavigate("admin")}>
          <LogIn size={18} />
          Entrar
        </button>
      </nav>
    </header>
  );
}

function HomePage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  return (
    <>
      <section className="hero hero-red">
        <div className="hero-media" />
        <div className="hero-content">
          <h1>Rede Voluntariado</h1>
          <p>Conectamos pessoas, instituicoes e empresas para transformar tempo disponivel em impacto social real.</p>
          <div className="hero-actions">
            <button className="btn primary" onClick={() => onNavigate("cadastro")}>
              Quero ser voluntario
              <ArrowRight size={18} />
            </button>
            <button className="btn ghost" onClick={() => onNavigate("presbiterianos")}>
              Ver plataforma .sco
            </button>
          </div>
        </div>
      </section>

      <section className="section split">
        <div>
          <h2>Uma rede para organizar voluntariado com responsabilidade</h2>
          <p>
            O portal antigo mostrou uma Rede centrada em conexao, historico institucional e integracao com organizacoes.
            Esta nova interface preserva esse papel e liga cada dominio a um tenant separado.
          </p>
          <div className="feature-list">
            <Feature icon={<Building2 />} title="Instituicoes" text="Cada grupo tem identidade propria, dominio e base de voluntarios isolada." />
            <Feature icon={<ShieldCheck />} title="Acesso seguro" text="Administradores secundarios veem apenas o proprio tenant." />
            <Feature icon={<UsersRound />} title="Voluntarios" text="Cadastro estruturado a partir das regras encontradas no PHP legado." />
          </div>
        </div>
        <img className="image-frame" src="/assets/rede/foto-rede-voluntariado-fenics.jpg" alt="Equipe da Rede Voluntariado" />
      </section>

      <section className="logos-section">
        <h2>Juntos por uma Montes Claros melhor</h2>
        <div className="logos-track">
          {ongs.map((logo) => (
            <div className="logo-cell" key={logo}>
              <img src={`/assets/rede/ongs/${logo}`} alt="" />
            </div>
          ))}
        </div>
        <img className="coletivo-logo" src="/assets/rede/logo-coletivo-sco.png" alt="Coletivo SCO" />
      </section>

      <section className="section platform-band">
        <div>
          <h2>Crie uma plataforma integrada a Rede Voluntariado</h2>
          <p>Use uma base comum, mas com dados separados por dominio: redevoluntariado para visao global e .sco para tenants especificos.</p>
        </div>
        <button className="btn light" onClick={() => onNavigate("admin")}>
          Criar plataforma
          <ArrowRight size={18} />
        </button>
      </section>
    </>
  );
}

function TenantPage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  return (
    <>
      <section className="tenant-hero">
        <div className="tenant-copy">
          <img src="/assets/presbiterianos/logo.png" alt="Presbiterianismo & Cidadania" />
          <h1>Presbiterianismo & Cidadania</h1>
          <p>Presbiterianos fortalecendo a sociedade civil com atuacao voluntaria qualificada e alinhada aos ODS.</p>
          <button className="btn green" onClick={() => onNavigate("cadastro")}>
            Quero ser voluntario
            <ArrowRight size={18} />
          </button>
        </div>
        <div className="tenant-card">
          <img src="/assets/presbiterianos/presbiterianismo-e-cidadania.jpg" alt="Programa Presbiterianismo e Cidadania" />
        </div>
      </section>

      <section className="section how">
        <h2>Como funciona</h2>
        <div className="steps">
          <Step icon={<UserRound />} title="Cadastro" text="O voluntario informa dados pessoais, formacao, experiencia e disponibilidade." />
          <Step icon={<HeartHandshake />} title="Planejamento" text="A equipe do tenant organiza interesses e habilidades para futuras acoes." />
          <Step icon={<Check />} title="Atuacao em rede" text="Os dados alimentam a plataforma principal sem quebrar isolamento por tenant." />
        </div>
      </section>

      <section className="section tenant-identity">
        <div>
          <h2>Identidade propria, base compartilhada</h2>
          <p>
            A pagina preserva a linguagem verde do site antigo e usa a mesma API multi-tenant. O cadastro enviado aqui vai para o tenant
            `presbiterianos`.
          </p>
        </div>
        <div className="identity-logos">
          <img src="/assets/presbiterianos/sco.png" alt="SCO" />
          <img src="/assets/presbiterianos/logo-rede-voluntariado.png" alt="Rede Voluntariado" />
        </div>
      </section>
    </>
  );
}

function VolunteerForm() {
  const [payload, setPayload] = useState<VolunteerPayload>(initialPayload);
  const [affinities, setAffinities] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const preferences = useMemo(() => {
    const parts = [...affinities, payload.preferences].filter(Boolean);
    return parts.join(" | ");
  }, [affinities, payload.preferences]);

  function update<K extends keyof VolunteerPayload>(key: K, value: VolunteerPayload[K]) {
    setPayload((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      await createVolunteer({
        ...payload,
        preferences,
        phones: payload.phones.filter((phone) => phone.phone.trim()),
        courses: payload.schooling === 4 ? payload.courses.filter((course) => course.course.trim()) : [],
        work_experiences: payload.no_work ? [] : payload.work_experiences.filter((work) => work.description.trim()),
        volunteer_experiences: payload.no_volunteer ? [] : payload.volunteer_experiences.filter((item) => item.description.trim()),
        availability: payload.availability.filter((item) => item.hours?.trim()),
      });
      setStatus("success");
      setMessage("Cadastro realizado com sucesso.");
      setPayload(initialPayload);
      setAffinities([]);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Erro ao enviar cadastro.");
    }
  }

  return (
    <main className="form-page">
      <form className="volunteer-form" onSubmit={submit}>
        <div className="form-heading">
          <img src="/assets/presbiterianos/user.jpg" alt="" />
          <div>
            <h1>Cadastro de Voluntario</h1>
            <p>Presbiterianismo & Cidadania</p>
          </div>
        </div>

        <fieldset>
          <legend>Dados pessoais</legend>
          <div className="field-grid">
            <label>
              Nome ou apelido
              <input required value={payload.name} onChange={(event) => update("name", event.target.value)} />
            </label>
            <label>
              Sexo
              <select value={payload.gender} onChange={(event) => update("gender", event.target.value)}>
                <option value="">Selecionar</option>
                <option value="f">Feminino</option>
                <option value="m">Masculino</option>
              </select>
            </label>
            <label className="wide">
              Nome completo
              <input value={payload.fullname} onChange={(event) => update("fullname", event.target.value)} />
            </label>
            <label>
              Data de nascimento
              <input type="date" value={payload.birthday} onChange={(event) => update("birthday", event.target.value)} />
            </label>
            <label>
              CPF
              <input value={payload.legal_id} onChange={(event) => update("legal_id", event.target.value)} />
            </label>
            <label className="wide">
              E-mail
              <input type="email" value={payload.email} onChange={(event) => update("email", event.target.value)} />
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Telefones</legend>
          {payload.phones.map((phone, index) => (
            <div className="inline-row" key={index}>
              <Phone size={18} />
              <input
                placeholder="Telefone"
                value={phone.phone}
                onChange={(event) => {
                  const phones = [...payload.phones];
                  phones[index] = { ...phone, phone: event.target.value };
                  update("phones", phones);
                }}
              />
              <select
                value={phone.whatsapp}
                onChange={(event) => {
                  const phones = [...payload.phones];
                  phones[index] = { ...phone, whatsapp: event.target.value };
                  update("phones", phones);
                }}
              >
                <option value="s">Tem WhatsApp</option>
                <option value="n">Nao tem WhatsApp</option>
              </select>
            </div>
          ))}
          <button type="button" className="link-button" onClick={() => update("phones", [...payload.phones, { phone: "", whatsapp: "s" }])}>
            <Plus size={16} />
            Adicionar telefone
          </button>
        </fieldset>

        <fieldset>
          <legend>Afinidade</legend>
          <div className="check-grid">
            {["Saude", "Social", "Ambiental", "Pessoas", "Animais", "Tarefas", "Criancas", "Adolescentes", "Jovens", "Adultos", "Idosos"].map(
              (item) => (
                <label className="check-card" key={item}>
                  <input
                    type="checkbox"
                    checked={affinities.includes(item)}
                    onChange={(event) =>
                      setAffinities((current) => (event.target.checked ? [...current, item] : current.filter((value) => value !== item)))
                    }
                  />
                  {item}
                </label>
              ),
            )}
          </div>
          <label>
            Suas habilidades
            <textarea value={payload.preferences} onChange={(event) => update("preferences", event.target.value)} rows={3} />
          </label>
        </fieldset>

        <fieldset>
          <legend>Formacao</legend>
          <div className="radio-grid">
            {[
              [1, "Alfabetizado"],
              [2, "Ensino medio incompleto"],
              [3, "Ensino medio completo"],
              [4, "Tecnico ou superior"],
            ].map(([value, label]) => (
              <label className="check-card" key={value}>
                <input
                  type="radio"
                  name="schooling"
                  checked={payload.schooling === value}
                  onChange={() => update("schooling", value as number)}
                />
                {label}
              </label>
            ))}
          </div>
          {payload.schooling === 4 && (
            <RepeatableCourse payload={payload} update={update} />
          )}
        </fieldset>

        <fieldset>
          <legend>Experiencias</legend>
          <label className="single-check">
            <input type="checkbox" checked={payload.no_work} onChange={(event) => update("no_work", event.target.checked)} />
            Nao possuo experiencia profissional
          </label>
          {!payload.no_work && <RepeatableWork payload={payload} update={update} />}

          <label className="single-check">
            <input type="checkbox" checked={payload.no_volunteer} onChange={(event) => update("no_volunteer", event.target.checked)} />
            Nao possuo experiencia em voluntariado
          </label>
          {!payload.no_volunteer && <RepeatableVolunteerExperience payload={payload} update={update} />}
        </fieldset>

        <fieldset>
          <legend>Disponibilidade</legend>
          {payload.availability.map((item, index) => (
            <div className="inline-row" key={index}>
              <CalendarDays size={18} />
              <select
                value={item.day_week}
                onChange={(event) => {
                  const availability = [...payload.availability];
                  availability[index] = { ...item, day_week: event.target.value };
                  update("availability", availability);
                }}
              >
                {days.map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                value={item.period}
                onChange={(event) => {
                  const availability = [...payload.availability];
                  availability[index] = { ...item, period: event.target.value };
                  update("availability", availability);
                }}
              >
                {periods.map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                placeholder="Horas"
                value={item.hours}
                onChange={(event) => {
                  const availability = [...payload.availability];
                  availability[index] = { ...item, hours: event.target.value };
                  update("availability", availability);
                }}
              />
            </div>
          ))}
          <button
            type="button"
            className="link-button"
            onClick={() => update("availability", [...payload.availability, { day_week: "seg", period: "m", hours: "" }])}
          >
            <Clock3 size={16} />
            Adicionar disponibilidade
          </button>
        </fieldset>

        <fieldset>
          <legend>Observacoes</legend>
          <textarea value={payload.comment} onChange={(event) => update("comment", event.target.value)} rows={4} />
          <label className="single-check">
            <input type="checkbox" required />
            Declaro que as informacoes fornecidas sao verdadeiras.
          </label>
        </fieldset>

        {message && <div className={`form-status ${status}`}>{message}</div>}
        <button className="submit-button" disabled={status === "loading"}>
          {status === "loading" ? "Enviando..." : "Enviar cadastro"}
          <ArrowRight size={18} />
        </button>
      </form>
    </main>
  );
}

function RepeatableCourse({ payload, update }: { payload: VolunteerPayload; update: <K extends keyof VolunteerPayload>(key: K, value: VolunteerPayload[K]) => void }) {
  const courses = payload.courses.length ? payload.courses : [{ level: "Superior", area: "", conclusion: "", course: "" }];

  return (
    <div className="stack">
      {courses.map((course, index) => (
        <div className="inline-row" key={index}>
          <select value={course.level} onChange={(event) => replaceCourse(payload, update, index, { ...course, level: event.target.value })}>
            <option>Tecnico</option>
            <option>Superior</option>
            <option>Especializacao</option>
            <option>Mestrado</option>
            <option>Doutorado</option>
          </select>
          <input placeholder="Area de conhecimento" value={course.area} onChange={(event) => replaceCourse(payload, update, index, { ...course, area: event.target.value })} />
          <input placeholder="Conclusao" value={course.conclusion} onChange={(event) => replaceCourse(payload, update, index, { ...course, conclusion: event.target.value })} />
          <input placeholder="Curso" value={course.course} onChange={(event) => replaceCourse(payload, update, index, { ...course, course: event.target.value })} />
        </div>
      ))}
      <button type="button" className="link-button" onClick={() => update("courses", [...courses, { level: "Superior", area: "", conclusion: "", course: "" }])}>
        <Plus size={16} />
        Adicionar curso
      </button>
    </div>
  );
}

function RepeatableWork({ payload, update }: { payload: VolunteerPayload; update: <K extends keyof VolunteerPayload>(key: K, value: VolunteerPayload[K]) => void }) {
  const items = payload.work_experiences.length ? payload.work_experiences : [{ area: "", period: "", duration: "", description: "" }];

  return (
    <div className="stack">
      {items.map((item, index) => (
        <div className="inline-row" key={index}>
          <input placeholder="Area" value={item.area} onChange={(event) => replaceWork(payload, update, index, { ...item, area: event.target.value })} />
          <input placeholder="Periodo" value={item.period} onChange={(event) => replaceWork(payload, update, index, { ...item, period: event.target.value })} />
          <input placeholder="Duracao" value={item.duration} onChange={(event) => replaceWork(payload, update, index, { ...item, duration: event.target.value })} />
          <input placeholder="Atribuicoes" value={item.description} onChange={(event) => replaceWork(payload, update, index, { ...item, description: event.target.value })} />
        </div>
      ))}
      <button type="button" className="link-button" onClick={() => update("work_experiences", [...items, { area: "", period: "", duration: "", description: "" }])}>
        <Plus size={16} />
        Adicionar experiencia
      </button>
    </div>
  );
}

function RepeatableVolunteerExperience({ payload, update }: { payload: VolunteerPayload; update: <K extends keyof VolunteerPayload>(key: K, value: VolunteerPayload[K]) => void }) {
  const items = payload.volunteer_experiences.length ? payload.volunteer_experiences : [{ period: "", duration: "", description: "" }];

  return (
    <div className="stack">
      {items.map((item, index) => (
        <div className="inline-row" key={index}>
          <input placeholder="Periodo" value={item.period} onChange={(event) => replaceVolunteerExperience(payload, update, index, { ...item, period: event.target.value })} />
          <input placeholder="Duracao" value={item.duration} onChange={(event) => replaceVolunteerExperience(payload, update, index, { ...item, duration: event.target.value })} />
          <input placeholder="Atribuicoes" value={item.description} onChange={(event) => replaceVolunteerExperience(payload, update, index, { ...item, description: event.target.value })} />
        </div>
      ))}
      <button
        type="button"
        className="link-button"
        onClick={() => update("volunteer_experiences", [...items, { period: "", duration: "", description: "" }])}
      >
        <Plus size={16} />
        Adicionar voluntariado
      </button>
    </div>
  );
}

function AdminPage() {
  const [email, setEmail] = useState("admin@redevoluntariado.org.br");
  const [password, setPassword] = useState("admin123");
  const [token, setToken] = useState("");
  const [volunteers, setVolunteers] = useState<Array<{ id: string; name: string; email?: string; created_at: string }>>([]);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      const session = await login(email, password);
      setToken(session.access_token);
      const data = await listVolunteers(session.access_token);
      setVolunteers(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao acessar painel.");
    }
  }

  return (
    <main className="admin-page">
      <section className="admin-login">
        <div>
          <h1>Painel administrativo</h1>
          <p>Administradores do tenant principal visualizam os voluntarios de todos os dominios.</p>
        </div>
        <form onSubmit={submit}>
          <label>
            E-mail
            <input value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            Senha
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {message && <div className="form-status error">{message}</div>}
          <button className="submit-button">
            <LockKeyhole size={18} />
            Entrar
          </button>
        </form>
      </section>

      {token && (
        <section className="admin-table">
          <h2>Voluntarios cadastrados</h2>
          <div className="table">
            <div className="table-row head">
              <span>Nome</span>
              <span>E-mail</span>
              <span>Cadastro</span>
            </div>
            {volunteers.map((volunteer) => (
              <div className="table-row" key={volunteer.id}>
                <span>{volunteer.name}</span>
                <span>{volunteer.email ?? "-"}</span>
                <span>{new Date(volunteer.created_at).toLocaleDateString("pt-BR")}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function Feature({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="feature">
      <div className="icon">{icon}</div>
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
    </div>
  );
}

function Step({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="step">
      <div className="step-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <img src="/assets/rede/logo-rede-voluntariado.png" alt="Rede Voluntariado" />
      <p>Rede Voluntariado - uma iniciativa ACI</p>
      <div>
        <Mail size={16} />
        contato@redevoluntariado.org.br
      </div>
    </footer>
  );
}

function replaceCourse(payload: VolunteerPayload, update: <K extends keyof VolunteerPayload>(key: K, value: VolunteerPayload[K]) => void, index: number, value: VolunteerPayload["courses"][number]) {
  const courses = [...payload.courses];
  courses[index] = value;
  update("courses", courses);
}

function replaceWork(payload: VolunteerPayload, update: <K extends keyof VolunteerPayload>(key: K, value: VolunteerPayload[K]) => void, index: number, value: VolunteerPayload["work_experiences"][number]) {
  const items = [...payload.work_experiences];
  items[index] = value;
  update("work_experiences", items);
}

function replaceVolunteerExperience(payload: VolunteerPayload, update: <K extends keyof VolunteerPayload>(key: K, value: VolunteerPayload[K]) => void, index: number, value: VolunteerPayload["volunteer_experiences"][number]) {
  const items = [...payload.volunteer_experiences];
  items[index] = value;
  update("volunteer_experiences", items);
}
