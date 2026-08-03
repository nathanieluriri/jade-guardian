/**
 * Shared feature-template types, mirroring the backend's
 * `app/server/schemas/admin-features.ts` (`TEMPLATE_FEATURES`, `FeatureTemplateCreate`).
 *
 * A template is a saved, reusable starting point for one admin feature's
 * create form. `feature` pins it to exactly one of the six screens below;
 * `payload` is an open bag of that feature's field values, snapshotted at
 * save time — applying a template must fill the form and let normal
 * validation run, never write straight through.
 */
export const TEMPLATE_FEATURES = [
  "service-definitions",
  "add-ons",
  "pricing-rules",
  "service-areas",
  "promo-codes",
  "broadcasts",
] as const;

export type TemplateFeature = (typeof TEMPLATE_FEATURES)[number];

export interface FeatureTemplate {
  id: string;
  feature: TemplateFeature;
  name: string;
  description?: string;
  payload: Record<string, unknown>;
  dateCreated?: number | null;
  lastUpdated?: number | null;
}

export interface FeatureTemplateCreatePayload {
  feature: TemplateFeature;
  name: string;
  description?: string;
  payload: Record<string, unknown>;
}
