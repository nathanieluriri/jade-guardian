"use client";

import {
  createServiceArea,
  deleteServiceArea,
  listServiceAreas,
  updateServiceArea,
} from "@/lib/api/admin-api";
import { OperationsCrudPage, type CrudField } from "@/features/admin/screens/operations/OperationsCrudPage";
import { OPERATIONS_LIST_PAGE } from "@/features/admin/screens/operations/optimistic-delete";

/**
 * `service_area_boundary` has no backend consumer, so field names are kept
 * exactly as the admin console already writes them (see
 * app/server/schemas/admin-features.ts, ServiceAreaCreate) — renaming would
 * be pure churn. Only the controls get better here.
 */
export const SERVICE_AREA_FIELDS: CrudField[] = [
  { key: "zone_code", label: "Zone Code", type: "text", required: true, placeholder: "LA-VI" },
  { key: "display_name", label: "Display Name", type: "text", required: true, placeholder: "Victoria Island" },
  { key: "zip_codes", label: "Zip Codes (CSV)", type: "array_csv", placeholder: "101001, 101002" },
  { key: "boundary_geojson", label: "Boundary GeoJSON", type: "textarea", placeholder: "{\"type\":\"Polygon\",...}" },
  { key: "is_active", label: "Active", type: "boolean" },
];

export default function ServiceAreasPage() {
  return (
    <OperationsCrudPage
      title="Service Areas"
      description="Manage operational zone boundaries and covered zip codes."
      queryKey="service-areas"
      readRequirement={{ method: "GET", path: "/v1/admins/service-areas" }}
      createRequirement={{ method: "POST", path: "/v1/admins/service-areas" }}
      updateRequirement={{ method: "PATCH", path: "/v1/admins/service-areas/{id}" }}
      deleteRequirement={{ method: "DELETE", path: "/v1/admins/service-areas/{id}" }}
      fields={SERVICE_AREA_FIELDS}
      listFn={() => listServiceAreas(OPERATIONS_LIST_PAGE)}
      createFn={createServiceArea}
      updateFn={updateServiceArea}
      deleteFn={deleteServiceArea}
    />
  );
}
