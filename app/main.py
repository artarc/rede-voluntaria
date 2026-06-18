from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.config import settings
from app.database import Base, engine, get_db
from app.models import (
    Tenant,
    User,
    UserRole,
    Volunteer,
    VolunteerAvailability,
    VolunteerCourse,
    VolunteerExperience,
    VolunteerPhone,
    VolunteerWork,
)
from app.schemas import (
    LoginInput,
    TenantCreate,
    TenantOut,
    TokenOut,
    UserCreate,
    UserOut,
    VolunteerCreate,
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
        seed_defaults(db)


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
        db.add(Tenant(name="Presbiterianismo & Cidadania", slug="presbiterianos", domain="presbiterianos.sco.org.br"))

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
                )
            )

    db.commit()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/auth/login", response_model=TokenOut)
def login(payload: LoginInput, tenant: TenantContext, db: Annotated[Session, Depends(get_db)]) -> TokenOut:
    user = db.scalars(select(User).where(User.tenant_id == tenant.id, User.email == payload.email)).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="E-mail ou senha invalidos.")

    return TokenOut(access_token=create_access_token(user))


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
    if not can_access_tenant(current_user, tenant.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant fora do seu escopo.")

    role = UserRole.ADMIN if payload.role == "ADMIN" else UserRole.VOLUNTEER
    exists = db.scalars(select(User).where(User.tenant_id == tenant.id, User.email == payload.email)).first()
    if exists:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="E-mail ja cadastrado neste tenant.")

    user = User(
        tenant_id=tenant.id,
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


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
