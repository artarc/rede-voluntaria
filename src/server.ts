import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import type { Prisma, PrismaClient } from "@prisma/client";
import Fastify, { type FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { createFormSchema, createTenantSchema, submitFormSchema, validateSubmission } from "./validation.js";

type HttpError = Error & { statusCode?: number; details?: unknown };

function httpError(message: string, statusCode = 400, details?: unknown): HttpError {
  const error = new Error(message) as HttpError;
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

function json(value: unknown): Prisma.InputJsonValue {
  return (value ?? {}) as Prisma.InputJsonValue;
}

async function getTenantId(request: FastifyRequest, prisma: PrismaClient) {
  const id = firstHeader(request.headers["x-tenant-id"]);
  const slug = firstHeader(request.headers["x-tenant-slug"]);

  const tenant = id
    ? await prisma.tenant.findFirst({ where: { id, status: "ACTIVE" } })
    : slug
      ? await prisma.tenant.findFirst({ where: { slug, status: "ACTIVE" } })
      : null;

  if (!tenant) {
    throw httpError("Tenant nao identificado ou inativo.", 401);
  }

  return tenant.id;
}

function firstHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const publicFormInclude = {
  currentVersion: {
    include: {
      fields: {
        orderBy: { position: "asc" },
        include: { options: { orderBy: { position: "asc" } } },
      },
    },
  },
} satisfies Prisma.FormInclude;

export async function buildServer(prisma: PrismaClient) {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info" } });

  await app.register(cors, { origin: true });
  await app.register(multipart);
  app.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string" }, (_request, body, done) => {
    done(null, body);
  });

  app.setErrorHandler((error: HttpError, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(422).send({ message: "Dados invalidos.", details: error.flatten() });
    }

    return reply.status(error.statusCode ?? 500).send({
      message: error.statusCode ? error.message : "Erro interno.",
      details: error.details,
    });
  });

  app.get("/health", async () => ({ status: "ok" }));

  app.post("/tenants", async (request, reply) => {
    const body = createTenantSchema.parse(request.body);
    const tenant = await prisma.tenant.create({
      data: {
        name: body.name,
        slug: body.slug,
        metadata: json(body.metadata),
      },
    });

    return reply.status(201).send(tenant);
  });

  app.get("/forms", async (request) => {
    const tenantId = await getTenantId(request, prisma);

    return prisma.form.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
  });

  app.post("/forms", async (request, reply) => {
    const tenantId = await getTenantId(request, prisma);
    const body = createFormSchema.parse(request.body);

    const uniqueKeys = new Set(body.fields.map((field) => field.key));
    if (uniqueKeys.size !== body.fields.length) {
      throw httpError("As chaves dos campos devem ser unicas no formulario.", 422);
    }

    const form = await prisma.$transaction(async (tx) => {
      const created = await tx.form.create({
        data: {
          tenantId,
          name: body.name,
          slug: body.slug,
          description: body.description,
        },
      });

      await tx.formVersion.create({
        data: {
          tenantId,
          formId: created.id,
          version: 1,
          title: body.name,
          description: body.description,
          fields: {
            create: body.fields.map((field) => ({
              tenantId,
              key: field.key,
              label: field.label,
              type: field.type,
              required: field.required ?? false,
              position: field.position,
              placeholder: field.placeholder,
              helpText: field.helpText,
              config: json(field.config),
              condition: field.condition ? json(field.condition) : undefined,
              options: {
                create: (field.options ?? []).map((option) => ({
                  tenantId,
                  label: option.label,
                  value: option.value,
                  position: option.position,
                  metadata: json(option.metadata),
                })),
              },
            })),
          },
        },
      });

      return created;
    });

    return reply.status(201).send(form);
  });

  app.post("/forms/:formId/publish", async (request) => {
    const tenantId = await getTenantId(request, prisma);
    const { formId } = request.params as { formId: string };

    const version = await prisma.formVersion.findFirst({
      where: { tenantId, formId },
      orderBy: { version: "desc" },
    });

    if (!version) {
      throw httpError("Formulario nao encontrado.", 404);
    }

    await prisma.formVersion.update({
      where: { id: version.id },
      data: { publishedAt: new Date() },
    });

    return prisma.form.update({
      where: { id: formId },
      data: {
        status: "PUBLISHED",
        currentVersionId: version.id,
      },
    });
  });

  app.get("/forms/:slug/public", async (request) => {
    const tenantId = await getTenantId(request, prisma);
    const { slug } = request.params as { slug: string };

    const form = await prisma.form.findFirst({
      where: { tenantId, slug, status: "PUBLISHED", currentVersionId: { not: null } },
      include: publicFormInclude,
    });

    if (!form?.currentVersion) {
      throw httpError("Formulario publicado nao encontrado.", 404);
    }

    return form;
  });

  app.post("/forms/:formId/submissions", async (request, reply) => {
    const tenantId = await getTenantId(request, prisma);
    const { formId } = request.params as { formId: string };
    const body = submitFormSchema.parse(request.body);

    const form = await prisma.form.findFirst({
      where: { id: formId, tenantId, status: "PUBLISHED", currentVersionId: { not: null } },
      include: publicFormInclude,
    });

    if (!form?.currentVersion) {
      throw httpError("Formulario publicado nao encontrado.", 404);
    }

    const validation = validateSubmission(form.currentVersion.fields, body.values);
    if (!validation.ok) {
      throw httpError("Resposta invalida.", 422, validation.errors);
    }

    const submission = await prisma.submission.create({
      data: {
        tenantId,
        formId: form.id,
        formVersionId: form.currentVersion.id,
        submitterIp: request.ip,
        userAgent: request.headers["user-agent"],
        metadata: json(body.metadata),
        values: {
          create: validation.values.map((item) => ({
            tenantId,
            field: { connect: { id: item.fieldId } },
            value: json(item.value),
          })),
        },
      },
      select: { id: true, status: true, createdAt: true },
    });

    return reply.status(201).send(submission);
  });

  return app;
}
