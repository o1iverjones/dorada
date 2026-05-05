import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
  }
  return client;
}

export interface EmailExtractionResult {
  patient_name: string | null;
  patient_name_confidence: number;
  po_number: string | null;
  po_number_confidence: number;
  date_time: string | null;
  date_time_confidence: number;
  doctor_name: string | null;
  doctor_name_confidence: number;
  clinic_name: string | null;
  clinic_name_confidence: number;
  languages: string[];
  languages_confidence: number;
  confirmation_method: "reply_email" | "confirmation_link" | null;
  confirmation_method_confidence: number;
  confirmation_link_url: string | null;
  unresolved_fields: string[];
}

const EXTRACTION_SYSTEM_PROMPT = `You are a data extraction assistant for a medical interpreter scheduling system.
Extract structured appointment data from insurance agency emails.
Return ONLY valid JSON matching the exact schema specified. No prose, no markdown, no code fences.`;

const CONFIDENCE_THRESHOLD = 0.7;

export async function extractAppointmentFromEmail(
  emailText: string,
  modelOverride?: string,
): Promise<EmailExtractionResult> {
  const anthropic = getAnthropicClient();
  const model = modelOverride ?? config.CLAUDE_MODEL;

  const prompt = `Extract appointment scheduling information from the following email. Return a JSON object with exactly these fields:
{
  "patient_name": string | null,
  "patient_name_confidence": number (0-1),
  "po_number": string | null,
  "po_number_confidence": number (0-1),
  "date_time": string | null (ISO 8601 if extractable, otherwise null),
  "date_time_confidence": number (0-1),
  "doctor_name": string | null,
  "doctor_name_confidence": number (0-1),
  "clinic_name": string | null,
  "clinic_name_confidence": number (0-1),
  "languages": string[] (language names, empty array if none),
  "languages_confidence": number (0-1),
  "confirmation_method": "reply_email" | "confirmation_link" | null,
  "confirmation_method_confidence": number (0-1),
  "confirmation_link_url": string | null (full URL if confirmation link found)
}

EMAIL:
${emailText}`;

  const message = await anthropic.messages.create({
    model,
    max_tokens: 1024,
    system: EXTRACTION_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  const parsed: EmailExtractionResult = JSON.parse(content.text);

  const unresolvedFields: string[] = [];
  const fieldsToCheck: Array<[keyof EmailExtractionResult, string]> = [
    ["patient_name", "patient_name"],
    ["po_number", "po_number"],
    ["date_time", "date_time"],
    ["doctor_name", "doctor_name"],
    ["clinic_name", "clinic_name"],
    ["languages", "languages"],
    ["confirmation_method", "confirmation_method"],
  ];

  for (const [field, label] of fieldsToCheck) {
    const confidenceKey = `${field}_confidence` as keyof EmailExtractionResult;
    const confidence = parsed[confidenceKey] as number;
    const value = parsed[field];
    const isEmpty = value === null || (Array.isArray(value) && value.length === 0);
    if (isEmpty || confidence < CONFIDENCE_THRESHOLD) {
      unresolvedFields.push(label);
    }
  }

  return { ...parsed, unresolved_fields: unresolvedFields };
}
