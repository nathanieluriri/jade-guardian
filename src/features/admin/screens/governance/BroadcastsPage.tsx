"use client";

import {
  createBroadcast,
  deleteBroadcast,
  listBroadcasts,
  updateBroadcast,
} from "@/lib/api/admin-api";
import { OperationsCrudPage } from "@/features/admin/screens/operations/OperationsCrudPage";

export default function BroadcastsPage() {
  return (
    <OperationsCrudPage
      title="System Broadcasts"
      description="Manage platform-wide or targeted announcements and their dispatch state."
      queryKey="broadcasts"
      readRequirement={{ method: "GET", path: "/v1/admins/broadcasts" }}
      createRequirement={{ method: "POST", path: "/v1/admins/broadcasts" }}
      updateRequirement={{ method: "PATCH", path: "/v1/admins/broadcasts/{id}" }}
      deleteRequirement={{ method: "DELETE", path: "/v1/admins/broadcasts/{id}" }}
      fields={[
        { key: "audience", label: "Audience", type: "text", required: true, placeholder: "all|cleaners|customers" },
        { key: "channel", label: "Channel", type: "text", required: true, placeholder: "push|email|in_app" },
        { key: "title", label: "Title", type: "text", required: true },
        { key: "message", label: "Message", type: "textarea", required: true },
        { key: "schedule_epoch", label: "Schedule Epoch", type: "number", placeholder: "1774056000" },
        { key: "status", label: "Status", type: "text", placeholder: "draft|queued|sent" },
      ]}
      listFn={() => listBroadcasts(0, 100)}
      createFn={createBroadcast}
      updateFn={updateBroadcast}
      deleteFn={deleteBroadcast}
    />
  );
}
