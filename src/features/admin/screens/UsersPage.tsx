"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Download, TrendingUp, Users, UserRoundCheck, ShieldAlert } from "lucide-react";
import { fetchUsersSignupTrend, fetchUsersSummaryReport, listCleaners, listCustomers } from "@/lib/api/admin-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function resolveId(input: { id?: string; _id?: string }) {
  return input.id || input._id || "unknown";
}

function toCsv(rows: Array<Record<string, string | number | boolean | null | undefined>>): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escaped = (value: unknown) => {
    const raw = value == null ? "" : String(value);
    return `"${raw.replaceAll('"', '""')}"`;
  };

  const content = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escaped(row[header])).join(",")),
  ];

  return content.join("\n");
}

function downloadCsv(filename: string, rows: Array<Record<string, string | number | boolean | null | undefined>>) {
  const csv = toCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function UsersPage() {
  const [start, setStart] = useState(0);
  const [stop] = useState(50);
  const [search, setSearch] = useState("");

  const cleanersQuery = useQuery({
    queryKey: ["admin-users", "cleaners", { start, stop }],
    queryFn: () => listCleaners(start, stop),
  });

  const customersQuery = useQuery({
    queryKey: ["admin-users", "customers", { start, stop }],
    queryFn: () => listCustomers(start, stop),
  });

  const summaryQuery = useQuery({
    queryKey: ["admin-users", "reports", "summary"],
    queryFn: fetchUsersSummaryReport,
  });

  const trendQuery = useQuery({
    queryKey: ["admin-users", "reports", "signups-trend"],
    queryFn: fetchUsersSignupTrend,
  });

  const cleaners = useMemo(() => cleanersQuery.data || [], [cleanersQuery.data]);
  const customers = useMemo(() => customersQuery.data || [], [customersQuery.data]);
  const summary = summaryQuery.data || {};
  const trend = useMemo(() => (Array.isArray(trendQuery.data) ? trendQuery.data : []), [trendQuery.data]);

  const cleanedSearch = search.trim().toLowerCase();

  const filteredCleaners = useMemo(() => {
    if (!cleanedSearch) return cleaners;
    return cleaners.filter((cleaner) => {
      const id = resolveId(cleaner);
      const fullName = `${cleaner.firstName || ""} ${cleaner.lastName || ""} ${cleaner.full_name || ""}`.toLowerCase();
      return id.toLowerCase().includes(cleanedSearch) || cleaner.email.toLowerCase().includes(cleanedSearch) || fullName.includes(cleanedSearch);
    });
  }, [cleanedSearch, cleaners]);

  const filteredCustomers = useMemo(() => {
    if (!cleanedSearch) return customers;
    return customers.filter((customer) => {
      const id = resolveId(customer);
      const fullName = `${customer.firstName || ""} ${customer.lastName || ""} ${customer.full_name || ""}`.toLowerCase();
      return id.toLowerCase().includes(cleanedSearch) || customer.email.toLowerCase().includes(cleanedSearch) || fullName.includes(cleanedSearch);
    });
  }, [cleanedSearch, customers]);

  const trendSummary = useMemo(() => {
    if (trend.length === 0) return "No trend data available.";
    const latest = trend[trend.length - 1];
    const earliest = trend[0];
    if (!latest || !earliest) return "No trend data available.";
    return `Trend window ${earliest.label || earliest.period || "start"} to ${latest.label || latest.period || "latest"}: total ${latest.total ?? "-"}.`;
  }, [trend]);

  return (
    <div className="space-y-6 max-w-[1250px]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tighter">Users</h1>
          <p className="text-sm text-muted-foreground mt-1">
            KPI and trend cards use reporting APIs. Tables use admin directory endpoints.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setStart(Math.max(0, start - stop))}>Previous</Button>
          <Button variant="outline" size="sm" onClick={() => setStart(start + stop)}>Next</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Total Users", value: summary.total_users ?? summary.total_customers ?? 0, icon: Users },
          { label: "Signups 24h", value: summary.signups_24h ?? 0, icon: TrendingUp },
          { label: "Signups 7d", value: summary.signups_7d ?? 0, icon: TrendingUp },
          { label: "Pending Onboarding", value: summary.pending_onboarding ?? 0, icon: ShieldAlert },
          { label: "Approval Rate", value: `${summary.approval_rate ?? 0}%`, icon: UserRoundCheck },
        ].map((card) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="surface-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
              <card.icon className="h-3.5 w-3.5" />
              <span>{card.label}</span>
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{card.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="surface-card p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users by name, email, ID" className="sm:max-w-md" />
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              downloadCsv(
                "cleaners.csv",
                filteredCleaners.map((cleaner) => ({
                  id: resolveId(cleaner),
                  email: cleaner.email,
                  full_name: cleaner.full_name || `${cleaner.firstName || ""} ${cleaner.lastName || ""}`.trim(),
                  onboarding_status: cleaner.onboarding_status || "PENDING",
                  created_at: cleaner.date_created || "",
                }))
              )
            }
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Export Cleaners CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              downloadCsv(
                "customers.csv",
                filteredCustomers.map((customer) => ({
                  id: resolveId(customer),
                  email: customer.email,
                  full_name: customer.full_name || `${customer.firstName || ""} ${customer.lastName || ""}`.trim(),
                  account_status: customer.accountStatus || "ACTIVE",
                  created_at: customer.date_created || "",
                }))
              )
            }
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Export Customers CSV
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link href="/admin/security/alerts?status=open" className="text-primary underline-offset-4 hover:underline">
          Drill into anomalies
        </Link>
        <Link href="/admin/security/audit?preset=permission-denials" className="text-primary underline-offset-4 hover:underline">
          View permission denials
        </Link>
        {summaryQuery.isLoading && <Badge variant="secondary">Loading summary...</Badge>}
        {trendQuery.isLoading && <Badge variant="secondary">Loading trend...</Badge>}
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="cleaners">Cleaners</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-3">
          <div className="surface-card p-4">
            <h2 className="text-base font-semibold">Reporting Snapshot</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">Total Cleaners</p>
                <p className="text-lg font-semibold">{summary.total_cleaners ?? cleaners.length}</p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">Pending Cleaner Onboarding</p>
                <p className="text-lg font-semibold">{summary.pending_onboarding ?? 0}</p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">Total Customers</p>
                <p className="text-lg font-semibold">{summary.total_customers ?? customers.length}</p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">Signups 30d</p>
                <p className="text-lg font-semibold">{summary.signups_30d ?? 0}</p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="cleaners">
          <div className="surface-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cleanersQuery.isLoading && (
                  <TableRow>
                    <TableCell colSpan={5} className="font-mono-data text-muted-foreground">Loading cleaners...</TableCell>
                  </TableRow>
                )}
                {cleanersQuery.isError && (
                  <TableRow>
                    <TableCell colSpan={5} className="font-mono-data text-destructive">Failed to load cleaners.</TableCell>
                  </TableRow>
                )}
                {!cleanersQuery.isLoading && !cleanersQuery.isError && filteredCleaners.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">No cleaners found.</TableCell>
                  </TableRow>
                )}
                {filteredCleaners.map((cleaner) => (
                  <TableRow key={resolveId(cleaner)}>
                    <TableCell>{cleaner.full_name || `${cleaner.firstName || ""} ${cleaner.lastName || ""}`.trim() || "Cleaner"}</TableCell>
                    <TableCell className="font-mono-data">{cleaner.email}</TableCell>
                    <TableCell>
                      <Badge variant={cleaner.onboarding_status === "APPROVED" ? "success" : cleaner.onboarding_status === "REJECTED" ? "destructive" : "warning"}>
                        {cleaner.onboarding_status || "PENDING"}
                      </Badge>
                    </TableCell>
                    <TableCell>{cleaner.date_created ? new Date(cleaner.date_created).toLocaleDateString() : "-"}</TableCell>
                    <TableCell className="font-mono-data text-xs">{resolveId(cleaner)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="customers">
          <div className="surface-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customersQuery.isLoading && (
                  <TableRow>
                    <TableCell colSpan={5} className="font-mono-data text-muted-foreground">Loading customers...</TableCell>
                  </TableRow>
                )}
                {customersQuery.isError && (
                  <TableRow>
                    <TableCell colSpan={5} className="font-mono-data text-destructive">Failed to load customers.</TableCell>
                  </TableRow>
                )}
                {!customersQuery.isLoading && !customersQuery.isError && filteredCustomers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">No customers found.</TableCell>
                  </TableRow>
                )}
                {filteredCustomers.map((customer) => (
                  <TableRow key={resolveId(customer)}>
                    <TableCell>{customer.full_name || `${customer.firstName || ""} ${customer.lastName || ""}`.trim() || "Customer"}</TableCell>
                    <TableCell className="font-mono-data">{customer.email}</TableCell>
                    <TableCell>
                      <Badge variant={customer.accountStatus === "ACTIVE" ? "success" : "warning"}>{customer.accountStatus || "ACTIVE"}</Badge>
                    </TableCell>
                    <TableCell>{customer.date_created ? new Date(customer.date_created).toLocaleDateString() : "-"}</TableCell>
                    <TableCell className="font-mono-data text-xs">{resolveId(customer)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <div className="text-xs text-muted-foreground">{trendSummary}</div>
    </div>
  );
}
