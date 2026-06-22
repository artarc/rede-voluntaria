import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class TenantCreate(BaseModel):
    name: str = Field(min_length=2, max_length=180)
    slug: str = Field(min_length=2, max_length=120)
    domain: str | None = Field(default=None, max_length=255)
    is_main: bool = False


class TenantOut(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    domain: str | None
    is_main: bool
    active: bool

    model_config = ConfigDict(from_attributes=True)


class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=180)
    email: EmailStr
    password: str = Field(min_length=6)
    role: str = "VOLUNTEER"
    tenant_id: uuid.UUID | None = None


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=180)
    email: EmailStr | None = None
    role: str | None = None
    tenant_id: uuid.UUID | None = None
    status: str | None = None


class VolunteerRegister(BaseModel):
    name: str = Field(min_length=2, max_length=180)
    email: EmailStr
    password: str = Field(min_length=6)


class VolunteerLoginCreate(BaseModel):
    password: str | None = Field(default=None, min_length=6)


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class PhoneInput(BaseModel):
    phone: str = Field(min_length=3, max_length=40)
    whatsapp: str | None = Field(default=None, max_length=5)


class CourseInput(BaseModel):
    level: str | None = None
    area: str | None = None
    conclusion: str | None = None
    course: str = Field(min_length=1, max_length=180)


class WorkInput(BaseModel):
    area: str | None = None
    period: str | None = None
    duration: str | None = None
    description: str = Field(min_length=1)


class VolunteerExperienceInput(BaseModel):
    period: str | None = None
    duration: str | None = None
    description: str = Field(min_length=1)


class AvailabilityInput(BaseModel):
    day_week: str | None = None
    period: str | None = None
    hours: str | None = None


class PhoneOut(BaseModel):
    id: uuid.UUID
    phone: str
    whatsapp: str | None

    model_config = ConfigDict(from_attributes=True)


class CourseOut(BaseModel):
    id: uuid.UUID
    level: str | None
    area: str | None
    conclusion: str | None
    course: str

    model_config = ConfigDict(from_attributes=True)


class WorkOut(BaseModel):
    id: uuid.UUID
    area: str | None
    period: str | None
    duration: str | None
    description: str

    model_config = ConfigDict(from_attributes=True)


class VolunteerExperienceOut(BaseModel):
    id: uuid.UUID
    period: str | None
    duration: str | None
    description: str

    model_config = ConfigDict(from_attributes=True)


class AvailabilityOut(BaseModel):
    id: uuid.UUID
    day_week: str | None
    period: str | None
    hours: str | None

    model_config = ConfigDict(from_attributes=True)


class VolunteerCreate(BaseModel):
    name: str = Field(min_length=2, max_length=180)
    gender: str | None = Field(default=None, max_length=20)
    fullname: str | None = Field(default=None, max_length=255)
    birthday: date | None = None
    legal_id: str | None = Field(default=None, max_length=40)
    email: EmailStr | None = None
    preferences: str | None = None
    comment: str | None = None
    schooling: int | None = None
    no_volunteer: bool = False
    no_work: bool = False
    phones: list[PhoneInput] = Field(default_factory=list)
    courses: list[CourseInput] = Field(default_factory=list)
    work_experiences: list[WorkInput] = Field(default_factory=list)
    volunteer_experiences: list[VolunteerExperienceInput] = Field(default_factory=list)
    availability: list[AvailabilityInput] = Field(default_factory=list)


class VolunteerOut(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    gender: str | None
    fullname: str | None
    birthday: date | None
    legal_id: str | None
    email: str | None
    preferences: str | None
    comment: str | None
    schooling: int | None
    no_volunteer: bool
    no_work: bool
    review_status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdminVolunteerOut(VolunteerOut):
    tenant_name: str | None = None
    user_email: str | None = None
    login_created: bool
    status_label: str
    phones: list[PhoneOut] = Field(default_factory=list)
    courses: list[CourseOut] = Field(default_factory=list)
    work_experiences: list[WorkOut] = Field(default_factory=list)
    volunteer_experiences: list[VolunteerExperienceOut] = Field(default_factory=list)
    availability: list[AvailabilityOut] = Field(default_factory=list)


class VolunteerLoginOut(BaseModel):
    message: str
    temporary_password: str | None = None
    volunteer: AdminVolunteerOut


class UserOut(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    email: str
    role: str
    origin: str
    account_status: str
    active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdminUserOut(UserOut):
    user_type: str
    user_type_label: str
    origin_label: str
    status_label: str
    tenant_name: str | None = None
    volunteer_id: uuid.UUID | None = None


class UserActionOut(BaseModel):
    message: str
    user: AdminUserOut


class TaskUserOut(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    email: str

    model_config = ConfigDict(from_attributes=True)


class ProcessTaskInput(BaseModel):
    title: str = Field(min_length=2, max_length=180)
    description: str | None = None
    priority: str = "MEDIUM"
    step_order: int = Field(ge=1)
    status: str | None = None
    assignee_user_id: uuid.UUID | None = None
    due_date: date | None = None


class ProcessTaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=180)
    description: str | None = None
    priority: str | None = None
    step_order: int | None = Field(default=None, ge=1)
    status: str | None = None
    assignee_user_id: uuid.UUID | None = None
    due_date: date | None = None


class ProcessTaskComplete(BaseModel):
    completion_note: str = Field(min_length=1)


class ProcessTaskOut(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    process_id: uuid.UUID
    title: str
    description: str | None
    priority: str
    step_order: int
    status: str
    assignee_user_id: uuid.UUID | None
    due_date: date | None
    completion_note: str | None
    completed_at: datetime | None
    completed_by_id: uuid.UUID | None
    created_at: datetime
    assignee: TaskUserOut | None = None
    completed_by: TaskUserOut | None = None

    model_config = ConfigDict(from_attributes=True)


class TaskProcessCreate(BaseModel):
    tenant_id: uuid.UUID | None = None
    title: str = Field(min_length=2, max_length=180)
    description: str | None = None
    priority: str = "MEDIUM"
    tasks: list[ProcessTaskInput] = Field(default_factory=list)


class TaskProcessUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=180)
    description: str | None = None
    priority: str | None = None
    status: str | None = None
    tasks: list[ProcessTaskInput] | None = None


class TaskProcessOut(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    title: str
    description: str | None
    priority: str
    status: str
    created_at: datetime
    updated_at: datetime
    tasks: list[ProcessTaskOut] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class TaskSummaryOut(BaseModel):
    pending: int
    overdue: int
    completed: int
    blocked: int
    in_progress: int


class TaskFiltersOut(BaseModel):
    tenants: list[TenantOut]
    users: list[TaskUserOut]
    processes: list[TaskProcessOut]
