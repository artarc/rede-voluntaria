import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Index, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    VOLUNTEER = "VOLUNTEER"


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(180), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), nullable=False, unique=True, index=True)
    domain: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True, index=True)
    is_main: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    users: Mapped[list["User"]] = relationship(back_populates="tenant")
    volunteers: Mapped[list["Volunteer"]] = relationship(back_populates="tenant")


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("tenant_id", "email", name="users_tenant_email_unique"),
        Index("users_tenant_id_idx", "tenant_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(180), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False, default=UserRole.VOLUNTEER)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    tenant: Mapped[Tenant] = relationship(back_populates="users")
    volunteer: Mapped["Volunteer | None"] = relationship(back_populates="user")


class Volunteer(Base):
    __tablename__ = "volunteers"
    __table_args__ = (
        Index("volunteers_tenant_id_idx", "tenant_id"),
        Index("volunteers_tenant_created_idx", "tenant_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    photo_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    name: Mapped[str] = mapped_column(String(180), nullable=False)
    gender: Mapped[str | None] = mapped_column(String(20), nullable=True)
    fullname: Mapped[str | None] = mapped_column(String(255), nullable=True)
    birthday: Mapped[date | None] = mapped_column(Date, nullable=True)
    legal_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    preferences: Mapped[str | None] = mapped_column(Text, nullable=True)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    schooling: Mapped[int | None] = mapped_column(nullable=True)
    no_volunteer: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    no_work: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    tenant: Mapped[Tenant] = relationship(back_populates="volunteers")
    user: Mapped[User | None] = relationship(back_populates="volunteer")
    phones: Mapped[list["VolunteerPhone"]] = relationship(cascade="all, delete-orphan", back_populates="volunteer")
    courses: Mapped[list["VolunteerCourse"]] = relationship(cascade="all, delete-orphan", back_populates="volunteer")
    work_experiences: Mapped[list["VolunteerWork"]] = relationship(cascade="all, delete-orphan", back_populates="volunteer")
    volunteer_experiences: Mapped[list["VolunteerExperience"]] = relationship(cascade="all, delete-orphan", back_populates="volunteer")
    availability: Mapped[list["VolunteerAvailability"]] = relationship(cascade="all, delete-orphan", back_populates="volunteer")


class VolunteerPhone(Base):
    __tablename__ = "volunteer_phones"
    __table_args__ = (Index("volunteer_phones_volunteer_id_idx", "volunteer_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    volunteer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("volunteers.id"), nullable=False)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    phone: Mapped[str] = mapped_column(String(40), nullable=False)
    whatsapp: Mapped[str | None] = mapped_column(String(5), nullable=True)

    volunteer: Mapped[Volunteer] = relationship(back_populates="phones")


class VolunteerCourse(Base):
    __tablename__ = "volunteer_courses"
    __table_args__ = (Index("volunteer_courses_volunteer_id_idx", "volunteer_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    volunteer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("volunteers.id"), nullable=False)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    level: Mapped[str | None] = mapped_column(String(80), nullable=True)
    area: Mapped[str | None] = mapped_column(String(120), nullable=True)
    conclusion: Mapped[str | None] = mapped_column(String(80), nullable=True)
    course: Mapped[str] = mapped_column(String(180), nullable=False)

    volunteer: Mapped[Volunteer] = relationship(back_populates="courses")


class VolunteerWork(Base):
    __tablename__ = "volunteer_work"
    __table_args__ = (Index("volunteer_work_volunteer_id_idx", "volunteer_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    volunteer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("volunteers.id"), nullable=False)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    area: Mapped[str | None] = mapped_column(String(120), nullable=True)
    period: Mapped[str | None] = mapped_column(String(80), nullable=True)
    duration: Mapped[str | None] = mapped_column(String(80), nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)

    volunteer: Mapped[Volunteer] = relationship(back_populates="work_experiences")


class VolunteerExperience(Base):
    __tablename__ = "volunteer_experience"
    __table_args__ = (Index("volunteer_experience_volunteer_id_idx", "volunteer_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    volunteer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("volunteers.id"), nullable=False)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    period: Mapped[str | None] = mapped_column(String(80), nullable=True)
    duration: Mapped[str | None] = mapped_column(String(80), nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)

    volunteer: Mapped[Volunteer] = relationship(back_populates="volunteer_experiences")


class VolunteerAvailability(Base):
    __tablename__ = "volunteer_availability"
    __table_args__ = (Index("volunteer_availability_volunteer_id_idx", "volunteer_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    volunteer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("volunteers.id"), nullable=False)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    day_week: Mapped[str | None] = mapped_column(String(20), nullable=True)
    period: Mapped[str | None] = mapped_column(String(20), nullable=True)
    hours: Mapped[str | None] = mapped_column(String(40), nullable=True)

    volunteer: Mapped[Volunteer] = relationship(back_populates="availability")
