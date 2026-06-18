from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/rede_voluntaria"
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24
    main_tenant_slug: str = "redevoluntariado"
    main_tenant_domain: str = "redevoluntariado.org.br"
    seed_admin_email: str | None = "admin@redevoluntariado.org.br"
    seed_admin_password: str | None = "admin123"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
