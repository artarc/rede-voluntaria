create extension if not exists pgcrypto;

create type tenant_status as enum ('ACTIVE', 'SUSPENDED');
create type form_status as enum ('DRAFT', 'PUBLISHED', 'ARCHIVED');
create type field_type as enum ('TEXT', 'NUMBER', 'SELECT', 'MULTI_SELECT', 'DATE', 'FILE', 'BOOLEAN');
create type submission_status as enum ('RECEIVED', 'IN_REVIEW', 'APPROVED', 'REJECTED');

create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status tenant_status not null default 'ACTIVE',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table forms (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  status form_status not null default 'DRAFT',
  current_version_id uuid unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint forms_tenant_slug_unique unique (tenant_id, slug)
);

create table form_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  form_id uuid not null references forms(id) on delete cascade,
  version integer not null,
  title text not null,
  description text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  constraint form_versions_form_version_unique unique (form_id, version)
);

alter table forms
  add constraint forms_current_version_id_fkey
  foreign key (current_version_id) references form_versions(id) on delete set null;

create table form_fields (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  form_version_id uuid not null references form_versions(id) on delete cascade,
  key text not null,
  label text not null,
  type field_type not null,
  required boolean not null default false,
  position integer not null,
  placeholder text,
  help_text text,
  config jsonb not null default '{}',
  condition jsonb,
  created_at timestamptz not null default now(),
  constraint form_fields_version_key_unique unique (form_version_id, key)
);

create table form_field_options (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  field_id uuid not null references form_fields(id) on delete cascade,
  label text not null,
  value text not null,
  position integer not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  constraint form_field_options_field_value_unique unique (field_id, value)
);

create table submissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  form_id uuid not null references forms(id) on delete cascade,
  form_version_id uuid not null references form_versions(id) on delete restrict,
  status submission_status not null default 'RECEIVED',
  submitter_ip text,
  user_agent text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table submission_values (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  submission_id uuid not null references submissions(id) on delete cascade,
  field_id uuid not null references form_fields(id) on delete restrict,
  value jsonb not null,
  created_at timestamptz not null default now(),
  constraint submission_values_submission_field_unique unique (submission_id, field_id)
);

create table uploaded_files (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  submission_id uuid not null references submissions(id) on delete cascade,
  field_key text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  storage_key text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index forms_tenant_id_idx on forms (tenant_id);
create index forms_tenant_status_idx on forms (tenant_id, status);
create index form_versions_tenant_id_idx on form_versions (tenant_id);
create index form_versions_tenant_form_idx on form_versions (tenant_id, form_id);
create index form_fields_tenant_id_idx on form_fields (tenant_id);
create index form_fields_tenant_version_idx on form_fields (tenant_id, form_version_id);
create index form_field_options_tenant_id_idx on form_field_options (tenant_id);
create index form_field_options_field_id_idx on form_field_options (field_id);
create index submissions_tenant_id_idx on submissions (tenant_id);
create index submissions_tenant_form_created_idx on submissions (tenant_id, form_id, created_at);
create index submissions_tenant_status_idx on submissions (tenant_id, status);
create index submission_values_tenant_id_idx on submission_values (tenant_id);
create index submission_values_tenant_field_idx on submission_values (tenant_id, field_id);
create index uploaded_files_tenant_id_idx on uploaded_files (tenant_id);
create index uploaded_files_submission_id_idx on uploaded_files (submission_id);

alter table tenants enable row level security;
alter table forms enable row level security;
alter table form_versions enable row level security;
alter table form_fields enable row level security;
alter table form_field_options enable row level security;
alter table submissions enable row level security;
alter table submission_values enable row level security;
alter table uploaded_files enable row level security;
