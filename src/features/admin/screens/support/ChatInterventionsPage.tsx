"use client";

import {
  createChatIntervention,
  deleteChatIntervention,
  listChatInterventions,
  updateChatIntervention,
} from "@/lib/api/admin-api";
import { OperationsCrudPage } from "@/features/admin/screens/operations/OperationsCrudPage";

export default function ChatInterventionsPage() {
  return (
    <OperationsCrudPage
      title="Chat Interventions"
      description="Track moderation, safety, and escalation actions in customer-cleaner chat threads."
      queryKey="chat-interventions"
      readRequirement={{ method: "GET", path: "/v1/admins/chat-interventions" }}
      createRequirement={{ method: "POST", path: "/v1/admins/chat-interventions" }}
      updateRequirement={{ method: "PATCH", path: "/v1/admins/chat-interventions/{id}" }}
      deleteRequirement={{ method: "DELETE", path: "/v1/admins/chat-interventions/{id}" }}
      fields={[
        { key: "thread_id", label: "Thread ID", type: "text", required: true },
        { key: "customer_id", label: "Customer ID", type: "text" },
        { key: "cleaner_id", label: "Cleaner ID", type: "text" },
        { key: "action", label: "Action", type: "text", required: true, placeholder: "warn|mute|escalate" },
        { key: "note", label: "Note", type: "textarea" },
      ]}
      listFn={() => listChatInterventions({ skip: 0, limit: 100 })}
      createFn={createChatIntervention}
      updateFn={updateChatIntervention}
      deleteFn={deleteChatIntervention}
    />
  );
}
