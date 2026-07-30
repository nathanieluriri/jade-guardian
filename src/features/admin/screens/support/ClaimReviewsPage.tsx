"use client";

import {
  createClaimReview,
  deleteClaimReview,
  listClaimReviews,
  updateClaimReview,
} from "@/lib/api/admin-api";
import { OperationsCrudPage } from "@/features/admin/screens/operations/OperationsCrudPage";

export default function ClaimReviewsPage() {
  return (
    <OperationsCrudPage
      title="Claim Reviews"
      description="Manage complaint/dispute claims and adjudication workflow records."
      queryKey="claim-reviews"
      readRequirement={{ method: "GET", path: "/v1/admins/claim-reviews" }}
      createRequirement={{ method: "POST", path: "/v1/admins/claim-reviews" }}
      updateRequirement={{ method: "PATCH", path: "/v1/admins/claim-reviews/{id}" }}
      deleteRequirement={{ method: "DELETE", path: "/v1/admins/claim-reviews/{id}" }}
      fields={[
        { key: "booking_id", label: "Booking ID", type: "text", required: true },
        { key: "customer_id", label: "Customer ID", type: "text", required: true },
        { key: "cleaner_id", label: "Cleaner ID", type: "text", required: true },
        { key: "claim_type", label: "Claim Type", type: "text", required: true },
        { key: "description", label: "Description", type: "textarea", required: true },
      ]}
      listFn={() => listClaimReviews({ skip: 0, limit: 100 })}
      createFn={createClaimReview}
      updateFn={updateClaimReview}
      deleteFn={deleteClaimReview}
    />
  );
}
