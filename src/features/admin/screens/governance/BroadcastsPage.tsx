"use client";

import { BroadcastComposer } from "@/features/admin/screens/governance/BroadcastComposer";
import { BroadcastList } from "@/features/admin/screens/governance/BroadcastList";

export default function BroadcastsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">System Broadcasts</h1>
        <p className="text-sm text-muted-foreground">
          Compose and send platform-wide or targeted announcements, and track their delivery.
        </p>
      </div>
      <BroadcastComposer />
      <BroadcastList />
    </div>
  );
}
