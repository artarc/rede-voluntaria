from typing import Annotated

from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Tenant, User, UserRole


def normalize_host(host: str | None) -> str | None:
    if not host:
        return None
    return host.split(":")[0].lower()


def get_tenant(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    x_tenant_slug: Annotated[str | None, Header()] = None,
    x_tenant_domain: Annotated[str | None, Header()] = None,
) -> Tenant:
    host = normalize_host(x_tenant_domain or request.headers.get("host"))

    statement = select(Tenant).where(Tenant.active.is_(True))
    if x_tenant_slug:
        statement = statement.where(Tenant.slug == x_tenant_slug)
    elif host in {"localhost", "127.0.0.1"}:
        statement = statement.where(Tenant.slug == settings.main_tenant_slug)
    elif host:
        statement = statement.where(or_(Tenant.domain == host, Tenant.slug == host))
    else:
        statement = statement.where(Tenant.slug == settings.main_tenant_slug)

    tenant = db.scalars(statement).first()
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant nao encontrado.")

    return tenant


def ensure_admin(user: User) -> None:
    if user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso permitido apenas para administradores.")


def can_access_tenant(user: User, tenant_id) -> bool:
    return bool(user.tenant and user.tenant.is_main and user.role == UserRole.ADMIN) or user.tenant_id == tenant_id


TenantContext = Annotated[Tenant, Depends(get_tenant)]
