import uuid
from datetime import date, datetime, timezone
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, text
from sqlalchemy.orm import Session, selectinload

from app.config import settings
from app.database import Base, engine, get_db
from app.models import (
    ProcessTask,
    Tenant,
    TaskPriority,
    TaskProcess,
    TaskStatus,
    User,
    UserAccountStatus,
    UserOrigin,
    UserRole,
    Volunteer,
    VolunteerAvailability,
    VolunteerCourse,
    VolunteerExperience,
    VolunteerPhone,
    VolunteerReviewStatus,
    VolunteerWork,
)
from app.schemas import (
    AdminVolunteerOut,
    LoginInput,
    ProcessTaskComplete,
    ProcessTaskInput,
    ProcessTaskOut,
    ProcessTaskUpdate,
    TenantCreate,
    TenantOut,
    TaskFiltersOut,
    TaskProcessCreate,
    TaskProcessOut,
    TaskProcessUpdate,
    TaskSummaryOut,
    TokenOut,
    AdminUserOut,
    UserActionOut,
    UserCreate,
    UserOut,
    UserUpdate,
    VolunteerCreate,
    VolunteerLoginCreate,
    VolunteerLoginOut,
    VolunteerOut,
    VolunteerRegister,
)
from app.security import CurrentUser, create_access_token, hash_password, verify_password
from app.tenant import TenantContext, can_access_tenant, ensure_admin

app = FastAPI(title="Rede Voluntariado API", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    Base.metadata.create_all(bind=engine)
    with next(get_db()) as db:
        ensure_user_account_columns(db)
        seed_defaults(db)


def ensure_user_account_columns(db: Session) -> None:
    db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS origin VARCHAR(32) NOT NULL DEFAULT 'ADMINISTRATOR'"))
    db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'"))
    db.execute(text("ALTER TABLE volunteers ADD COLUMN IF NOT EXISTS review_status VARCHAR(32) NOT NULL DEFAULT 'PENDING'"))
    db.execute(text("UPDATE users SET account_status = 'INACTIVE' WHERE active = false AND account_status = 'ACTIVE'"))
    db.commit()


def seed_defaults(db: Session) -> None:
    main = db.scalars(select(Tenant).where(Tenant.slug == settings.main_tenant_slug)).first()
    if not main:
        main = Tenant(
            name="Rede Voluntariado",
            slug=settings.main_tenant_slug,
            domain=settings.main_tenant_domain,
            is_main=True,
        )
        db.add(main)
        db.flush()

    presbiterianos = db.scalars(select(Tenant).where(Tenant.slug == "presbiterianos")).first()
    if not presbiterianos:
        presbiterianos = Tenant(name="Presbiterianismo & Cidadania", slug="presbiterianos", domain="presbiterianos.sco.org.br")
        db.add(presbiterianos)
        db.flush()

    if settings.seed_admin_email and settings.seed_admin_password:
        admin = db.scalars(
            select(User).where(User.tenant_id == main.id, User.email == settings.seed_admin_email)
        ).first()
        if not admin:
            db.add(
                User(
                    tenant_id=main.id,
                    name="Administrador",
                    email=settings.seed_admin_email,
                    password_hash=hash_password(settings.seed_admin_password),
                    role=UserRole.ADMIN,
                    origin=UserOrigin.ADMINISTRATOR,
                    account_status=UserAccountStatus.ACTIVE,
                )
            )

    seed_task_demo(db, presbiterianos)
    db.commit()


def seed_task_demo(db: Session, presbiterianos: Tenant) -> None:
    collaborator = db.scalars(
        select(User).where(User.tenant_id == presbiterianos.id, User.email == "colaborador@presbiterianos.sco.org.br")
    ).first()
    if not collaborator:
        collaborator = User(
            tenant_id=presbiterianos.id,
            name="Colaborador Presbiterianos",
            email="colaborador@presbiterianos.sco.org.br",
            password_hash=hash_password("voluntario123"),
            role=UserRole.VOLUNTEER,
            origin=UserOrigin.ADMINISTRATOR,
            account_status=UserAccountStatus.ACTIVE,
        )
        db.add(collaborator)
        db.flush()

    tenant_admin = db.scalars(
        select(User).where(User.tenant_id == presbiterianos.id, User.email == "admin@presbiterianos.sco.org.br")
    ).first()
    if not tenant_admin:
        db.add(
            User(
                tenant_id=presbiterianos.id,
                name="Admin Presbiterianos",
                email="admin@presbiterianos.sco.org.br",
                password_hash=hash_password("admin123"),
                role=UserRole.ADMIN,
                origin=UserOrigin.ADMINISTRATOR,
                account_status=UserAccountStatus.ACTIVE,
            )
        )

    exists = db.scalars(
        select(TaskProcess).where(TaskProcess.tenant_id == presbiterianos.id, TaskProcess.title == "Cadastro de Funcionário")
    ).first()
    if exists:
        return

    process = TaskProcess(
        tenant_id=presbiterianos.id,
        title="Cadastro de Funcionário",
        description="Fluxo sequencial para admissão de novos colaboradores da rede.",
        priority=TaskPriority.HIGH,
    )
    db.add(process)
    db.flush()
    steps = [
        ("Coletar informações do colaborador", "Reunir dados pessoais, contato e documentação inicial.", TaskStatus.PENDING),
        ("Solicitar exame admissional", "Encaminhar pedido e acompanhar retorno da clínica.", TaskStatus.BLOCKED),
        ("Validar documentos", "Conferir documentação obrigatória e registrar pendências.", TaskStatus.BLOCKED),
        ("Finalizar cadastro", "Ativar cadastro e comunicar conclusão ao gestor.", TaskStatus.BLOCKED),
    ]
    for index, (title, description, task_status) in enumerate(steps, start=1):
        db.add(
            ProcessTask(
                tenant_id=presbiterianos.id,
                process_id=process.id,
                title=title,
                description=description,
                priority=TaskPriority.HIGH,
                step_order=index,
                status=task_status,
                assignee_user_id=collaborator.id,
            )
        )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def parse_user_role(value: str | None) -> UserRole:
    if value in {"ADMIN", "GENERAL_ADMIN", "ENTITY_ADMIN"}:
        return UserRole.ADMIN
    return UserRole.VOLUNTEER


def parse_account_status(value: str | None) -> UserAccountStatus | None:
    if value is None:
        return None
    try:
        return UserAccountStatus(value)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Status de usuario invalido.") from exc


def user_type(user: User) -> str:
    if user.role == UserRole.ADMIN and user.tenant and user.tenant.is_main:
        return "GENERAL_ADMIN"
    if user.role == UserRole.ADMIN:
        return "ENTITY_ADMIN"
    return "VOLUNTEER"


def user_type_label(user: User) -> str:
    labels = {
        "GENERAL_ADMIN": "Administrador Geral",
        "ENTITY_ADMIN": "Administrador da Entidade",
        "VOLUNTEER": "Voluntario",
    }
    return labels[user_type(user)]


def origin_label(origin: str) -> str:
    labels = {
        UserOrigin.ADMINISTRATOR.value: "administrador",
        UserOrigin.VOLUNTEER.value: "voluntario",
    }
    return labels.get(origin, origin.lower())


def status_label(account_status: str) -> str:
    labels = {
        UserAccountStatus.PENDING.value: "pendente",
        UserAccountStatus.ACTIVE.value: "ativo",
        UserAccountStatus.BLOCKED.value: "bloqueado",
        UserAccountStatus.REJECTED.value: "reprovado",
        UserAccountStatus.INACTIVE.value: "inativo",
    }
    return labels.get(account_status, account_status.lower())


def serialize_admin_user(user: User) -> AdminUserOut:
    return AdminUserOut(
        id=user.id,
        tenant_id=user.tenant_id,
        name=user.name,
        email=user.email,
        role=user.role.value,
        origin=user.origin,
        account_status=user.account_status,
        active=user.active,
        created_at=user.created_at,
        user_type=user_type(user),
        user_type_label=user_type_label(user),
        origin_label=origin_label(user.origin),
        status_label=status_label(user.account_status),
        tenant_name=user.tenant.name if user.tenant else None,
        volunteer_id=user.volunteer.id if user.volunteer else None,
    )


def get_user_in_scope(user_id: str, current_user: User, db: Session) -> User:
    user = db.scalars(
        select(User)
        .where(User.id == user_id)
        .options(selectinload(User.tenant), selectinload(User.volunteer))
    ).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario nao encontrado.")
    if not can_access_tenant(current_user, user.tenant_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuario fora do seu escopo.")
    return user


def apply_user_status(user: User, next_status: UserAccountStatus) -> None:
    user.account_status = next_status.value
    user.active = next_status == UserAccountStatus.ACTIVE


def volunteer_review_label(review_status: str) -> str:
    labels = {
        VolunteerReviewStatus.PENDING.value: "pendente",
        VolunteerReviewStatus.LOGIN_CREATED.value: "login criado",
        VolunteerReviewStatus.REJECTED.value: "reprovado",
        VolunteerReviewStatus.ARCHIVED.value: "arquivado",
    }
    return labels.get(review_status, review_status.lower())


def volunteer_detail_options():
    return (
        selectinload(Volunteer.tenant),
        selectinload(Volunteer.user),
        selectinload(Volunteer.phones),
        selectinload(Volunteer.courses),
        selectinload(Volunteer.work_experiences),
        selectinload(Volunteer.volunteer_experiences),
        selectinload(Volunteer.availability),
    )


def serialize_admin_volunteer(volunteer: Volunteer) -> AdminVolunteerOut:
    return AdminVolunteerOut(
        id=volunteer.id,
        tenant_id=volunteer.tenant_id,
        name=volunteer.name,
        gender=volunteer.gender,
        fullname=volunteer.fullname,
        birthday=volunteer.birthday,
        legal_id=volunteer.legal_id,
        email=volunteer.email,
        preferences=volunteer.preferences,
        comment=volunteer.comment,
        schooling=volunteer.schooling,
        no_volunteer=volunteer.no_volunteer,
        no_work=volunteer.no_work,
        review_status=volunteer.review_status,
        created_at=volunteer.created_at,
        tenant_name=volunteer.tenant.name if volunteer.tenant else None,
        user_email=volunteer.user.email if volunteer.user else None,
        login_created=volunteer.user_id is not None,
        status_label=volunteer_review_label(volunteer.review_status),
        phones=list(volunteer.phones),
        courses=list(volunteer.courses),
        work_experiences=list(volunteer.work_experiences),
        volunteer_experiences=list(volunteer.volunteer_experiences),
        availability=list(volunteer.availability),
    )


def get_volunteer_submission_in_scope(volunteer_id: str, current_user: User, db: Session) -> Volunteer:
    volunteer = db.scalars(select(Volunteer).where(Volunteer.id == volunteer_id).options(*volunteer_detail_options())).first()
    if not volunteer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inscricao de voluntario nao encontrada.")
    if not can_access_tenant(current_user, volunteer.tenant_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inscricao fora do seu escopo.")
    return volunteer


@app.post("/auth/login", response_model=TokenOut)
def login(payload: LoginInput, tenant: TenantContext, db: Annotated[Session, Depends(get_db)]) -> TokenOut:
    user = db.scalars(select(User).where(User.tenant_id == tenant.id, User.email == payload.email)).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="E-mail ou senha invalidos.")
    if not user.active or user.account_status != UserAccountStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Conta pendente, bloqueada ou inativa.")

    return TokenOut(access_token=create_access_token(user))


@app.get("/auth/me", response_model=UserOut)
def me(current_user: CurrentUser) -> User:
    return current_user


@app.post("/auth/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register_volunteer_user(payload: VolunteerRegister, tenant: TenantContext, db: Annotated[Session, Depends(get_db)]) -> User:
    exists = db.scalars(select(User).where(User.tenant_id == tenant.id, User.email == payload.email)).first()
    if exists:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="E-mail ja cadastrado neste tenant.")

    user = User(
        tenant_id=tenant.id,
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=UserRole.VOLUNTEER,
        origin=UserOrigin.VOLUNTEER,
        account_status=UserAccountStatus.PENDING,
        active=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    tenant: TenantContext,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> User:
    ensure_admin(current_user)
    target_tenant_id = scoped_tenant_id(current_user, payload.tenant_id or tenant.id)
    if not can_access_tenant(current_user, target_tenant_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant fora do seu escopo.")

    role = parse_user_role(payload.role)
    exists = db.scalars(select(User).where(User.tenant_id == target_tenant_id, User.email == payload.email)).first()
    if exists:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="E-mail ja cadastrado neste tenant.")

    user = User(
        tenant_id=target_tenant_id,
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=role,
        origin=UserOrigin.ADMINISTRATOR,
        account_status=UserAccountStatus.ACTIVE,
        active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.get("/users", response_model=list[AdminUserOut])
def list_users(
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    user_type_filter: Annotated[str | None, Query(alias="user_type")] = None,
    origin: Annotated[str | None, Query()] = None,
    tenant_id: Annotated[uuid.UUID | None, Query()] = None,
    status_filter: Annotated[str | None, Query(alias="status")] = None,
) -> list[AdminUserOut]:
    ensure_admin(current_user)
    statement = select(User).options(selectinload(User.tenant), selectinload(User.volunteer)).order_by(User.created_at.desc())
    if current_user.tenant and current_user.tenant.is_main:
        if tenant_id:
            statement = statement.where(User.tenant_id == tenant_id)
    else:
        statement = statement.where(User.tenant_id == current_user.tenant_id)
    if origin:
        statement = statement.where(User.origin == origin)
    if status_filter:
        statement = statement.where(User.account_status == parse_account_status(status_filter).value)

    users = list(db.scalars(statement))
    if user_type_filter:
        users = [user for user in users if user_type(user) == user_type_filter]
    return [serialize_admin_user(user) for user in users]


@app.get("/users/{user_id}", response_model=AdminUserOut)
def get_user(user_id: str, current_user: CurrentUser, db: Annotated[Session, Depends(get_db)]) -> AdminUserOut:
    ensure_admin(current_user)
    return serialize_admin_user(get_user_in_scope(user_id, current_user, db))


@app.put("/users/{user_id}", response_model=AdminUserOut)
def update_user(user_id: str, payload: UserUpdate, current_user: CurrentUser, db: Annotated[Session, Depends(get_db)]) -> AdminUserOut:
    ensure_admin(current_user)
    user = get_user_in_scope(user_id, current_user, db)
    data = payload.model_dump(exclude_unset=True)
    target_tenant_id = user.tenant_id
    if "tenant_id" in data and data["tenant_id"]:
        if not current_user.tenant or not current_user.tenant.is_main:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Administrador da entidade nao altera vinculo de entidade.")
        target_tenant_id = data["tenant_id"]
        tenant = db.get(Tenant, target_tenant_id)
        if not tenant:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Entidade invalida.")
        user.tenant_id = target_tenant_id
    if "email" in data and data["email"]:
        exists = db.scalars(select(User).where(User.tenant_id == target_tenant_id, User.email == str(data["email"]), User.id != user.id)).first()
        if exists:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="E-mail ja cadastrado nesta entidade.")
        user.email = str(data["email"])
    if "name" in data and data["name"]:
        user.name = data["name"]
    if "role" in data and data["role"]:
        next_role = parse_user_role(data["role"])
        if next_role == UserRole.ADMIN and (not current_user.tenant or not current_user.tenant.is_main) and target_tenant_id != current_user.tenant_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Perfil administrativo fora do seu escopo.")
        user.role = next_role
    if "status" in data:
        next_status = parse_account_status(data["status"])
        if next_status:
            apply_user_status(user, next_status)
    db.commit()
    return serialize_admin_user(get_user_in_scope(user_id, current_user, db))


@app.post("/users/{user_id}/approve", response_model=AdminUserOut)
def approve_user(user_id: str, current_user: CurrentUser, db: Annotated[Session, Depends(get_db)]) -> AdminUserOut:
    ensure_admin(current_user)
    user = get_user_in_scope(user_id, current_user, db)
    apply_user_status(user, UserAccountStatus.ACTIVE)
    db.commit()
    return serialize_admin_user(get_user_in_scope(user_id, current_user, db))


@app.post("/users/{user_id}/reject", response_model=AdminUserOut)
def reject_user(user_id: str, current_user: CurrentUser, db: Annotated[Session, Depends(get_db)]) -> AdminUserOut:
    ensure_admin(current_user)
    user = get_user_in_scope(user_id, current_user, db)
    apply_user_status(user, UserAccountStatus.REJECTED)
    db.commit()
    return serialize_admin_user(get_user_in_scope(user_id, current_user, db))


@app.post("/users/{user_id}/block", response_model=AdminUserOut)
def block_user(user_id: str, current_user: CurrentUser, db: Annotated[Session, Depends(get_db)]) -> AdminUserOut:
    ensure_admin(current_user)
    user = get_user_in_scope(user_id, current_user, db)
    apply_user_status(user, UserAccountStatus.BLOCKED)
    db.commit()
    return serialize_admin_user(get_user_in_scope(user_id, current_user, db))


@app.post("/users/{user_id}/unblock", response_model=AdminUserOut)
def unblock_user(user_id: str, current_user: CurrentUser, db: Annotated[Session, Depends(get_db)]) -> AdminUserOut:
    ensure_admin(current_user)
    user = get_user_in_scope(user_id, current_user, db)
    apply_user_status(user, UserAccountStatus.ACTIVE)
    db.commit()
    return serialize_admin_user(get_user_in_scope(user_id, current_user, db))


@app.post("/users/{user_id}/deactivate", response_model=AdminUserOut)
def deactivate_user(user_id: str, current_user: CurrentUser, db: Annotated[Session, Depends(get_db)]) -> AdminUserOut:
    ensure_admin(current_user)
    user = get_user_in_scope(user_id, current_user, db)
    apply_user_status(user, UserAccountStatus.INACTIVE)
    db.commit()
    return serialize_admin_user(get_user_in_scope(user_id, current_user, db))


@app.post("/users/{user_id}/resend-access", response_model=UserActionOut)
def resend_user_access(user_id: str, current_user: CurrentUser, db: Annotated[Session, Depends(get_db)]) -> UserActionOut:
    ensure_admin(current_user)
    user = get_user_in_scope(user_id, current_user, db)
    return UserActionOut(message=f"Instrucoes de acesso preparadas para {user.email}.", user=serialize_admin_user(user))


@app.post("/tenants", response_model=TenantOut, status_code=status.HTTP_201_CREATED)
def create_tenant(payload: TenantCreate, current_user: CurrentUser, db: Annotated[Session, Depends(get_db)]) -> Tenant:
    ensure_admin(current_user)
    if not current_user.tenant or not current_user.tenant.is_main:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Apenas o tenant principal cria tenants.")

    tenant = Tenant(name=payload.name, slug=payload.slug, domain=payload.domain, is_main=payload.is_main)
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return tenant


@app.get("/tenants", response_model=list[TenantOut])
def list_tenants(current_user: CurrentUser, db: Annotated[Session, Depends(get_db)]) -> list[Tenant]:
    ensure_admin(current_user)
    if not current_user.tenant or not current_user.tenant.is_main:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Apenas o tenant principal lista tenants.")
    return list(db.scalars(select(Tenant).order_by(Tenant.name)))


@app.post("/volunteers", response_model=VolunteerOut, status_code=status.HTTP_201_CREATED)
def create_volunteer(payload: VolunteerCreate, tenant: TenantContext, db: Annotated[Session, Depends(get_db)]) -> Volunteer:
    volunteer = Volunteer(
        tenant_id=tenant.id,
        name=payload.name,
        gender=payload.gender,
        fullname=payload.fullname,
        birthday=payload.birthday,
        legal_id=payload.legal_id,
        email=str(payload.email) if payload.email else None,
        preferences=payload.preferences,
        comment=payload.comment,
        schooling=payload.schooling,
        no_volunteer=payload.no_volunteer,
        no_work=payload.no_work,
        review_status=VolunteerReviewStatus.PENDING.value,
    )
    db.add(volunteer)
    db.flush()

    for phone in payload.phones:
        db.add(VolunteerPhone(tenant_id=tenant.id, volunteer_id=volunteer.id, phone=phone.phone, whatsapp=phone.whatsapp))
    for course in payload.courses:
        db.add(VolunteerCourse(tenant_id=tenant.id, volunteer_id=volunteer.id, **course.model_dump()))
    for work in payload.work_experiences:
        db.add(VolunteerWork(tenant_id=tenant.id, volunteer_id=volunteer.id, **work.model_dump()))
    for experience in payload.volunteer_experiences:
        db.add(VolunteerExperience(tenant_id=tenant.id, volunteer_id=volunteer.id, **experience.model_dump()))
    for availability in payload.availability:
        db.add(VolunteerAvailability(tenant_id=tenant.id, volunteer_id=volunteer.id, **availability.model_dump()))

    db.commit()
    db.refresh(volunteer)
    return volunteer


@app.put("/volunteers/me", response_model=VolunteerOut)
def upsert_my_volunteer(
    payload: VolunteerCreate,
    tenant: TenantContext,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> Volunteer:
    if current_user.role != UserRole.VOLUNTEER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Use esta rota apenas para voluntarios.")
    if current_user.tenant_id != tenant.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant fora do seu escopo.")

    volunteer = db.scalars(select(Volunteer).where(Volunteer.user_id == current_user.id)).first()
    if not volunteer:
        volunteer = Volunteer(tenant_id=tenant.id, user_id=current_user.id, name=payload.name)
        db.add(volunteer)
        db.flush()

    volunteer.name = payload.name
    volunteer.gender = payload.gender
    volunteer.fullname = payload.fullname
    volunteer.birthday = payload.birthday
    volunteer.legal_id = payload.legal_id
    volunteer.email = str(payload.email) if payload.email else current_user.email
    volunteer.preferences = payload.preferences
    volunteer.comment = payload.comment
    volunteer.schooling = payload.schooling
    volunteer.no_volunteer = payload.no_volunteer
    volunteer.no_work = payload.no_work

    volunteer.phones.clear()
    volunteer.courses.clear()
    volunteer.work_experiences.clear()
    volunteer.volunteer_experiences.clear()
    volunteer.availability.clear()
    db.flush()

    for phone in payload.phones:
        volunteer.phones.append(VolunteerPhone(tenant_id=tenant.id, phone=phone.phone, whatsapp=phone.whatsapp))
    for course in payload.courses:
        volunteer.courses.append(VolunteerCourse(tenant_id=tenant.id, **course.model_dump()))
    for work in payload.work_experiences:
        volunteer.work_experiences.append(VolunteerWork(tenant_id=tenant.id, **work.model_dump()))
    for experience in payload.volunteer_experiences:
        volunteer.volunteer_experiences.append(VolunteerExperience(tenant_id=tenant.id, **experience.model_dump()))
    for availability in payload.availability:
        volunteer.availability.append(VolunteerAvailability(tenant_id=tenant.id, **availability.model_dump()))

    db.commit()
    db.refresh(volunteer)
    return volunteer


@app.get("/volunteers", response_model=list[VolunteerOut])
def list_volunteers(
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    tenant_id: Annotated[str | None, Query()] = None,
) -> list[Volunteer]:
    ensure_admin(current_user)

    statement = select(Volunteer).order_by(Volunteer.created_at.desc())
    if current_user.tenant and current_user.tenant.is_main:
        if tenant_id:
            statement = statement.where(Volunteer.tenant_id == tenant_id)
    else:
        statement = statement.where(Volunteer.tenant_id == current_user.tenant_id)

    return list(db.scalars(statement))


@app.get("/volunteer-submissions", response_model=list[AdminVolunteerOut])
def list_volunteer_submissions(
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    tenant_id: Annotated[uuid.UUID | None, Query()] = None,
    review_status: Annotated[str | None, Query()] = None,
) -> list[AdminVolunteerOut]:
    ensure_admin(current_user)
    statement = select(Volunteer).options(*volunteer_detail_options()).order_by(Volunteer.created_at.desc())
    if current_user.tenant and current_user.tenant.is_main:
        if tenant_id:
            statement = statement.where(Volunteer.tenant_id == tenant_id)
    else:
        statement = statement.where(Volunteer.tenant_id == current_user.tenant_id)
    if review_status:
        statement = statement.where(Volunteer.review_status == review_status)
    return [serialize_admin_volunteer(volunteer) for volunteer in db.scalars(statement)]


@app.get("/volunteer-submissions/{volunteer_id}", response_model=AdminVolunteerOut)
def get_volunteer_submission(volunteer_id: str, current_user: CurrentUser, db: Annotated[Session, Depends(get_db)]) -> AdminVolunteerOut:
    ensure_admin(current_user)
    return serialize_admin_volunteer(get_volunteer_submission_in_scope(volunteer_id, current_user, db))


@app.post("/volunteer-submissions/{volunteer_id}/create-login", response_model=VolunteerLoginOut)
def create_volunteer_login(
    volunteer_id: str,
    payload: VolunteerLoginCreate,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> VolunteerLoginOut:
    ensure_admin(current_user)
    volunteer = get_volunteer_submission_in_scope(volunteer_id, current_user, db)
    if volunteer.user_id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Esta inscricao ja possui login vinculado.")
    if not volunteer.email:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="A inscricao precisa de e-mail para criar login.")
    exists = db.scalars(select(User).where(User.tenant_id == volunteer.tenant_id, User.email == volunteer.email)).first()
    if exists:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ja existe usuario com este e-mail nesta entidade.")

    temporary_password = payload.password or uuid.uuid4().hex[:12]
    user = User(
        tenant_id=volunteer.tenant_id,
        name=volunteer.fullname or volunteer.name,
        email=volunteer.email,
        password_hash=hash_password(temporary_password),
        role=UserRole.VOLUNTEER,
        origin=UserOrigin.VOLUNTEER,
        account_status=UserAccountStatus.ACTIVE,
        active=True,
    )
    db.add(user)
    db.flush()
    volunteer.user_id = user.id
    volunteer.review_status = VolunteerReviewStatus.LOGIN_CREATED.value
    db.commit()
    volunteer = get_volunteer_submission_in_scope(volunteer_id, current_user, db)
    return VolunteerLoginOut(
        message=f"Login criado para {volunteer.email}.",
        temporary_password=None if payload.password else temporary_password,
        volunteer=serialize_admin_volunteer(volunteer),
    )


@app.post("/volunteer-submissions/{volunteer_id}/reject", response_model=AdminVolunteerOut)
def reject_volunteer_submission(
    volunteer_id: str,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> AdminVolunteerOut:
    ensure_admin(current_user)
    volunteer = get_volunteer_submission_in_scope(volunteer_id, current_user, db)
    if volunteer.user_id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Inscricao com login criado nao pode ser reprovada.")
    volunteer.review_status = VolunteerReviewStatus.REJECTED.value
    db.commit()
    return serialize_admin_volunteer(get_volunteer_submission_in_scope(volunteer_id, current_user, db))


@app.get("/volunteers/{volunteer_id}", response_model=VolunteerOut)
def get_volunteer(volunteer_id: str, current_user: CurrentUser, db: Annotated[Session, Depends(get_db)]) -> Volunteer:
    volunteer = db.scalars(
        select(Volunteer)
        .where(Volunteer.id == volunteer_id)
        .options(
            selectinload(Volunteer.phones),
            selectinload(Volunteer.courses),
            selectinload(Volunteer.work_experiences),
            selectinload(Volunteer.volunteer_experiences),
            selectinload(Volunteer.availability),
        )
    ).first()
    if not volunteer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Voluntario nao encontrado.")

    if current_user.role == UserRole.VOLUNTEER and volunteer.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Voluntario acessa apenas seus dados.")

    if current_user.role == UserRole.ADMIN and not can_access_tenant(current_user, volunteer.tenant_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant fora do seu escopo.")

    return volunteer


PRIORITY_RANK = {
    TaskPriority.URGENT: 0,
    TaskPriority.HIGH: 1,
    TaskPriority.MEDIUM: 2,
    TaskPriority.LOW: 3,
}


def parse_priority(value: str | None) -> TaskPriority | None:
    if value is None:
        return None
    try:
        return TaskPriority(value)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Prioridade invalida.") from exc


def parse_task_status(value: str | None) -> TaskStatus | None:
    if value is None:
        return None
    try:
        return TaskStatus(value)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Status invalido.") from exc


def ensure_user_in_scope(user_id: uuid.UUID | None, tenant_id: uuid.UUID, db: Session) -> None:
    if user_id is None:
        return
    user = db.get(User, user_id)
    if not user or user.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Responsavel fora do tenant do processo.")


def scoped_tenant_id(current_user: User, requested_tenant_id: uuid.UUID | None) -> uuid.UUID:
    if current_user.tenant and current_user.tenant.is_main:
        return requested_tenant_id or current_user.tenant_id
    if requested_tenant_id and requested_tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant fora do seu escopo.")
    return current_user.tenant_id


def get_process_in_scope(process_id: str, current_user: User, db: Session) -> TaskProcess:
    process = db.scalars(
        select(TaskProcess)
        .where(TaskProcess.id == process_id)
        .options(
            selectinload(TaskProcess.tasks).selectinload(ProcessTask.assignee),
            selectinload(TaskProcess.tasks).selectinload(ProcessTask.completed_by),
        )
    ).first()
    if not process:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Processo nao encontrado.")
    if not can_access_tenant(current_user, process.tenant_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant fora do seu escopo.")
    return process


def get_task_in_scope(task_id: str, current_user: User, db: Session) -> ProcessTask:
    task = db.scalars(
        select(ProcessTask)
        .where(ProcessTask.id == task_id)
        .options(selectinload(ProcessTask.assignee), selectinload(ProcessTask.completed_by), selectinload(ProcessTask.process))
    ).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarefa nao encontrada.")
    if current_user.role == UserRole.ADMIN:
        if not can_access_tenant(current_user, task.tenant_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant fora do seu escopo.")
    elif task.assignee_user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tarefa fora do seu escopo.")
    return task


def recalculate_task_locks(process: TaskProcess) -> None:
    previous_done = True
    for task in sorted(process.tasks, key=lambda item: item.step_order):
        if task.status in {TaskStatus.COMPLETED, TaskStatus.CANCELED}:
            previous_done = True
            continue
        if previous_done:
            if task.status == TaskStatus.BLOCKED:
                task.status = TaskStatus.PENDING
        else:
            task.status = TaskStatus.BLOCKED
        previous_done = task.status in {TaskStatus.COMPLETED, TaskStatus.CANCELED}


def update_process_status(process: TaskProcess) -> None:
    tasks = list(process.tasks)
    if tasks and all(task.status == TaskStatus.COMPLETED for task in tasks):
        process.status = TaskStatus.COMPLETED
    elif any(task.status == TaskStatus.IN_PROGRESS for task in tasks):
        process.status = TaskStatus.IN_PROGRESS
    else:
        process.status = TaskStatus.PENDING


def apply_task_payload(task: ProcessTask, payload: ProcessTaskInput | ProcessTaskUpdate, db: Session) -> None:
    data = payload.model_dump(exclude_unset=True)
    if "title" in data:
        task.title = data["title"]
    if "description" in data:
        task.description = data["description"]
    if "priority" in data:
        task.priority = parse_priority(data["priority"]) or task.priority
    if "step_order" in data:
        task.step_order = data["step_order"]
    if "status" in data:
        task.status = parse_task_status(data["status"]) or task.status
    if "assignee_user_id" in data:
        ensure_user_in_scope(data["assignee_user_id"], task.tenant_id, db)
        task.assignee_user_id = data["assignee_user_id"]
    if "due_date" in data:
        task.due_date = data["due_date"]


def sorted_processes(processes: list[TaskProcess]) -> list[TaskProcess]:
    return sorted(processes, key=lambda process: (PRIORITY_RANK[process.priority], process.created_at))


@app.get("/tasks/summary", response_model=TaskSummaryOut)
def task_summary(
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    tenant_id: Annotated[uuid.UUID | None, Query()] = None,
) -> TaskSummaryOut:
    ensure_admin(current_user)
    statement = select(ProcessTask)
    if current_user.tenant and current_user.tenant.is_main:
        if tenant_id:
            statement = statement.where(ProcessTask.tenant_id == tenant_id)
    else:
        statement = statement.where(ProcessTask.tenant_id == current_user.tenant_id)

    today = date.today()
    tasks = list(db.scalars(statement))
    return TaskSummaryOut(
        pending=sum(task.status == TaskStatus.PENDING for task in tasks),
        overdue=sum(task.status != TaskStatus.COMPLETED and task.due_date is not None and task.due_date < today for task in tasks),
        completed=sum(task.status == TaskStatus.COMPLETED for task in tasks),
        blocked=sum(task.status == TaskStatus.BLOCKED for task in tasks),
        in_progress=sum(task.status == TaskStatus.IN_PROGRESS for task in tasks),
    )


@app.get("/tasks/filters", response_model=TaskFiltersOut)
def task_filters(current_user: CurrentUser, db: Annotated[Session, Depends(get_db)]) -> TaskFiltersOut:
    ensure_admin(current_user)
    if current_user.tenant and current_user.tenant.is_main:
        tenants = list(db.scalars(select(Tenant).order_by(Tenant.name)))
        users = list(db.scalars(select(User).where(User.active.is_(True)).order_by(User.name)))
        processes = list(db.scalars(select(TaskProcess).options(selectinload(TaskProcess.tasks)).order_by(TaskProcess.created_at.desc())))
    else:
        tenants = [current_user.tenant]
        users = list(db.scalars(select(User).where(User.tenant_id == current_user.tenant_id, User.active.is_(True)).order_by(User.name)))
        processes = list(
            db.scalars(
                select(TaskProcess)
                .where(TaskProcess.tenant_id == current_user.tenant_id)
                .options(selectinload(TaskProcess.tasks))
                .order_by(TaskProcess.created_at.desc())
            )
        )
    return TaskFiltersOut(tenants=tenants, users=users, processes=processes)


@app.get("/task-processes", response_model=list[TaskProcessOut])
def list_task_processes(
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    tenant_id: Annotated[uuid.UUID | None, Query()] = None,
    process_id: Annotated[uuid.UUID | None, Query()] = None,
    responsible_id: Annotated[uuid.UUID | None, Query()] = None,
    priority: Annotated[str | None, Query()] = None,
    task_status: Annotated[str | None, Query(alias="status")] = None,
    due_before: Annotated[date | None, Query()] = None,
    due_after: Annotated[date | None, Query()] = None,
) -> list[TaskProcess]:
    ensure_admin(current_user)
    statement = select(TaskProcess).options(
        selectinload(TaskProcess.tasks).selectinload(ProcessTask.assignee),
        selectinload(TaskProcess.tasks).selectinload(ProcessTask.completed_by),
    )
    if process_id:
        statement = statement.where(TaskProcess.id == process_id)
    if current_user.tenant and current_user.tenant.is_main:
        if tenant_id:
            statement = statement.where(TaskProcess.tenant_id == tenant_id)
    else:
        statement = statement.where(TaskProcess.tenant_id == current_user.tenant_id)
    if priority:
        statement = statement.where(TaskProcess.priority == parse_priority(priority))

    processes = list(db.scalars(statement))
    status_filter = parse_task_status(task_status)
    if responsible_id or status_filter or due_before or due_after:
        filtered = []
        for process in processes:
            tasks = process.tasks
            if responsible_id and not any(task.assignee_user_id == responsible_id for task in tasks):
                continue
            if status_filter and not any(task.status == status_filter for task in tasks):
                continue
            if due_before and not any(task.due_date and task.due_date <= due_before for task in tasks):
                continue
            if due_after and not any(task.due_date and task.due_date >= due_after for task in tasks):
                continue
            filtered.append(process)
        processes = filtered
    return sorted_processes(processes)


@app.post("/task-processes", response_model=TaskProcessOut, status_code=status.HTTP_201_CREATED)
def create_task_process(payload: TaskProcessCreate, current_user: CurrentUser, db: Annotated[Session, Depends(get_db)]) -> TaskProcess:
    ensure_admin(current_user)
    tenant_id = scoped_tenant_id(current_user, payload.tenant_id)
    process = TaskProcess(
        tenant_id=tenant_id,
        title=payload.title,
        description=payload.description,
        priority=parse_priority(payload.priority) or TaskPriority.MEDIUM,
    )
    db.add(process)
    db.flush()
    for item in sorted(payload.tasks, key=lambda task: task.step_order):
        ensure_user_in_scope(item.assignee_user_id, tenant_id, db)
        process.tasks.append(
            ProcessTask(
                tenant_id=tenant_id,
                title=item.title,
                description=item.description,
                priority=parse_priority(item.priority) or process.priority,
                step_order=item.step_order,
                status=parse_task_status(item.status) or TaskStatus.BLOCKED,
                assignee_user_id=item.assignee_user_id,
                due_date=item.due_date,
            )
        )
    recalculate_task_locks(process)
    update_process_status(process)
    db.commit()
    return get_process_in_scope(str(process.id), current_user, db)


@app.get("/task-processes/{process_id}", response_model=TaskProcessOut)
def get_task_process(process_id: str, current_user: CurrentUser, db: Annotated[Session, Depends(get_db)]) -> TaskProcess:
    ensure_admin(current_user)
    return get_process_in_scope(process_id, current_user, db)


@app.put("/task-processes/{process_id}", response_model=TaskProcessOut)
def update_task_process(
    process_id: str,
    payload: TaskProcessUpdate,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> TaskProcess:
    ensure_admin(current_user)
    process = get_process_in_scope(process_id, current_user, db)
    data = payload.model_dump(exclude_unset=True)
    if "title" in data:
        process.title = data["title"]
    if "description" in data:
        process.description = data["description"]
    if "priority" in data:
        process.priority = parse_priority(data["priority"]) or process.priority
    if "status" in data:
        process.status = parse_task_status(data["status"]) or process.status
    if payload.tasks is not None:
        process.tasks.clear()
        db.flush()
        for item in sorted(payload.tasks, key=lambda task: task.step_order):
            ensure_user_in_scope(item.assignee_user_id, process.tenant_id, db)
            process.tasks.append(
                ProcessTask(
                    tenant_id=process.tenant_id,
                    title=item.title,
                    description=item.description,
                    priority=parse_priority(item.priority) or process.priority,
                    step_order=item.step_order,
                    status=parse_task_status(item.status) or TaskStatus.BLOCKED,
                    assignee_user_id=item.assignee_user_id,
                    due_date=item.due_date,
                )
            )
    recalculate_task_locks(process)
    update_process_status(process)
    db.commit()
    return get_process_in_scope(process_id, current_user, db)


@app.delete("/task-processes/{process_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task_process(process_id: str, current_user: CurrentUser, db: Annotated[Session, Depends(get_db)]) -> None:
    ensure_admin(current_user)
    process = get_process_in_scope(process_id, current_user, db)
    db.delete(process)
    db.commit()


@app.post("/task-processes/{process_id}/tasks", response_model=TaskProcessOut, status_code=status.HTTP_201_CREATED)
def create_process_task(
    process_id: str,
    payload: ProcessTaskInput,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> TaskProcess:
    ensure_admin(current_user)
    process = get_process_in_scope(process_id, current_user, db)
    ensure_user_in_scope(payload.assignee_user_id, process.tenant_id, db)
    process.tasks.append(
        ProcessTask(
            tenant_id=process.tenant_id,
            title=payload.title,
            description=payload.description,
            priority=parse_priority(payload.priority) or process.priority,
            step_order=payload.step_order,
            status=parse_task_status(payload.status) or TaskStatus.BLOCKED,
            assignee_user_id=payload.assignee_user_id,
            due_date=payload.due_date,
        )
    )
    recalculate_task_locks(process)
    update_process_status(process)
    db.commit()
    return get_process_in_scope(process_id, current_user, db)


@app.put("/tasks/{task_id}", response_model=TaskProcessOut)
def update_process_task(
    task_id: str,
    payload: ProcessTaskUpdate,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> TaskProcess:
    ensure_admin(current_user)
    task = get_task_in_scope(task_id, current_user, db)
    process = get_process_in_scope(str(task.process_id), current_user, db)
    apply_task_payload(task, payload, db)
    recalculate_task_locks(process)
    update_process_status(process)
    db.commit()
    return get_process_in_scope(str(process.id), current_user, db)


@app.delete("/tasks/{task_id}", response_model=TaskProcessOut)
def delete_process_task(task_id: str, current_user: CurrentUser, db: Annotated[Session, Depends(get_db)]) -> TaskProcess:
    ensure_admin(current_user)
    task = get_task_in_scope(task_id, current_user, db)
    process_id = str(task.process_id)
    process = get_process_in_scope(process_id, current_user, db)
    db.delete(task)
    db.flush()
    remaining = sorted(process.tasks, key=lambda item: item.step_order)
    for index, item in enumerate(remaining, start=1):
        item.step_order = index
    recalculate_task_locks(process)
    update_process_status(process)
    db.commit()
    return get_process_in_scope(process_id, current_user, db)


@app.post("/tasks/{task_id}/start", response_model=ProcessTaskOut)
def start_task(task_id: str, current_user: CurrentUser, db: Annotated[Session, Depends(get_db)]) -> ProcessTask:
    task = get_task_in_scope(task_id, current_user, db)
    if task.status == TaskStatus.BLOCKED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A etapa anterior ainda nao foi concluida.")
    if task.status == TaskStatus.PENDING:
        task.status = TaskStatus.IN_PROGRESS
    db.commit()
    db.refresh(task)
    return task


@app.post("/tasks/{task_id}/complete", response_model=ProcessTaskOut)
def complete_task(
    task_id: str,
    payload: ProcessTaskComplete,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> ProcessTask:
    task = get_task_in_scope(task_id, current_user, db)
    if task.status == TaskStatus.BLOCKED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A etapa anterior ainda nao foi concluida.")

    process = db.scalars(select(TaskProcess).where(TaskProcess.id == task.process_id).options(selectinload(TaskProcess.tasks))).first()
    task.status = TaskStatus.COMPLETED
    task.completed_at = datetime.now(timezone.utc)
    task.completed_by_id = current_user.id
    task.completion_note = payload.completion_note
    recalculate_task_locks(process)
    update_process_status(process)
    db.commit()
    db.refresh(task)
    return task


@app.get("/tasks/my-current", response_model=list[ProcessTaskOut])
def my_current_tasks(current_user: CurrentUser, db: Annotated[Session, Depends(get_db)]) -> list[ProcessTask]:
    if current_user.role != UserRole.VOLUNTEER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Use esta rota apenas para colaboradores.")
    tasks = list(
        db.scalars(
            select(ProcessTask)
            .where(
                ProcessTask.assignee_user_id == current_user.id,
                ProcessTask.status.in_([TaskStatus.PENDING, TaskStatus.IN_PROGRESS]),
            )
            .options(selectinload(ProcessTask.assignee), selectinload(ProcessTask.completed_by))
        )
    )
    return sorted(tasks, key=lambda task: (PRIORITY_RANK[task.priority], str(task.process_id), task.step_order))
