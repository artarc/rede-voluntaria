import { describe, expect, it } from "vitest";
import { type PublicField, validateSubmission } from "../src/validation.js";

const fields: PublicField[] = [
  {
    id: "name-field",
    key: "nome",
    type: "TEXT",
    required: true,
    condition: null,
    options: [],
  },
  {
    id: "gender-field",
    key: "genero",
    type: "SELECT",
    required: true,
    condition: null,
    options: [
      { value: "masculino" },
      { value: "feminino" },
    ],
  },
  {
    id: "projects-field",
    key: "projetos",
    type: "MULTI_SELECT",
    required: false,
    condition: null,
    options: [
      { value: "triagem" },
      { value: "audiencia" },
    ],
  },
  {
    id: "oab-field",
    key: "oab",
    type: "TEXT",
    required: true,
    condition: {
      fieldKey: "genero",
      operator: "equals",
      value: "feminino",
    },
    options: [],
  },
];

describe("validateSubmission", () => {
  it("normalizes valid dynamic values", () => {
    const result = validateSubmission(fields, {
      nome: " Maria ",
      genero: "feminino",
      projetos: ["triagem"],
      oab: "123456",
    });

    expect(result).toEqual({
      ok: true,
      values: [
        { fieldId: "name-field", value: "Maria" },
        { fieldId: "gender-field", value: "feminino" },
        { fieldId: "projects-field", value: ["triagem"] },
        { fieldId: "oab-field", value: "123456" },
      ],
    });
  });

  it("rejects values that are not configured options", () => {
    const result = validateSubmission(fields, {
      nome: "Maria",
      genero: "nao-binario",
    });

    expect(result.ok).toBe(false);
  });

  it("ignores required conditional fields when the condition is not met", () => {
    const result = validateSubmission(fields, {
      nome: "Maria",
      genero: "masculino",
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        values: [
          { fieldId: "name-field", value: "Maria" },
          { fieldId: "gender-field", value: "masculino" },
        ],
      }),
    );
  });
});
