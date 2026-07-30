"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Loader2, PlusCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AdminLoadingState } from "@/components/AdminLoadingState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { canAccessAdminAction } from "@/lib/admin-access";
import {
  autocompleteAdminUsers,
  autocompletePlaces,
  createAdminCustomerPlace,
  createConciergeBookingByAdmin,
  getPlaceDetails,
  listAddOns,
  listAdminCustomerPlaces,
  listConciergeBookings,
  listServiceDefinitions,
} from "@/lib/api/admin-api";
import type {
  AdminAutocompleteUser,
  AdminCustomerPlaceOut,
  AdminResourceItem,
  ApiError,
  ConciergeBookingCreateRequest,
  PlaceDetailsOut,
  PlacesAutocompleteItem,
} from "@/lib/api/types";
import { useAdminProfile } from "@/hooks/use-admin-auth";

type ConciergeDraft = {
  adminId: string;
  customerId: string | null;
  cleanerId: string | null;
  placeId: string | null;
  schedule: number | null;
  service: string | null;
  duration: { hours: number; minutes: number } | null;
  extras: { add_ons: unknown[] };
  customDetails: Record<string, unknown> | null;
};

const STEP_LABELS = ["Customer", "Place", "Cleaner", "Service", "Add-ons", "Schedule"];
const SELECT_SENTINEL = "__unset__";

function emptyDraft(adminId = ""): ConciergeDraft {
  return {
    adminId,
    customerId: null,
    cleanerId: null,
    placeId: null,
    schedule: null,
    service: null,
    duration: { hours: 2, minutes: 0 },
    extras: { add_ons: [] },
    customDetails: null,
  };
}

function getItemId(item: { id?: string; _id?: string }): string {
  return item.id || item._id || "";
}

function getDisplayName(user: AdminAutocompleteUser): string {
  const full = user.full_name?.trim();
  if (full) return full;
  const fallback = `${user.firstName || ""} ${user.lastName || ""}`.trim();
  if (fallback) return fallback;
  return user.email || getItemId(user) || "Unknown";
}

function parseApiCode(error: ApiError): string | undefined {
  if (error.code) return error.code;
  if (!error.details || typeof error.details !== "object") return undefined;
  const details = error.details as { data?: { code?: string }; code?: string; error_code?: string };
  return details.data?.code || details.code || details.error_code;
}

function serviceValue(item: AdminResourceItem): string {
  if (typeof item.service === "string" && item.service.trim()) return item.service;
  if (typeof item.code === "string" && item.code.trim()) return item.code;
  if (typeof item.name === "string" && item.name.trim()) return item.name;
  return getItemId(item);
}

function serviceLabel(item: AdminResourceItem): string {
  if (typeof item.name === "string" && item.name.trim()) return item.name;
  if (typeof item.title === "string" && item.title.trim()) return item.title;
  const value = serviceValue(item);
  return value || "Unknown Service";
}

function resolveDuration(item: AdminResourceItem): { hours: number; minutes: number } | null {
  const source = (item.duration || item.default_duration || null) as
    | { hours?: unknown; minutes?: unknown }
    | null;
  if (!source) return null;

  const hours = typeof source.hours === "number" ? source.hours : Number(source.hours || 0);
  const minutes = typeof source.minutes === "number" ? source.minutes : Number(source.minutes || 0);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || minutes < 0) return null;

  return {
    hours,
    minutes,
  };
}

function toUnixSeconds(datetimeLocal: string): number | null {
  if (!datetimeLocal) return null;
  const date = new Date(datetimeLocal);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor(date.getTime() / 1000);
}

function toDatetimeLocal(epochSeconds: number | null): string {
  if (!epochSeconds) return "";
  const date = new Date(epochSeconds * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatCreated(value: unknown): string {
  if (typeof value === "number") {
    const millis = value > 1_000_000_000_000 ? value : value * 1000;
    return new Date(millis).toLocaleString();
  }
  if (typeof value === "string" && value) {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return new Date(parsed).toLocaleString();
  }
  return "-";
}

function extractCreatedPlace(raw: Record<string, unknown>): AdminCustomerPlaceOut | null {
  const candidate = (raw.place && typeof raw.place === "object" ? raw.place : raw) as Record<string, unknown>;
  const placeId = typeof candidate.place_id === "string" ? candidate.place_id : "";
  if (!placeId) return null;
  return {
    place_id: placeId,
    label: typeof candidate.label === "string" ? candidate.label : undefined,
    name: typeof candidate.name === "string" ? candidate.name : undefined,
    formatted_address: typeof candidate.formatted_address === "string" ? candidate.formatted_address : undefined,
    longitude: typeof candidate.longitude === "number" ? candidate.longitude : undefined,
    latitude: typeof candidate.latitude === "number" ? candidate.latitude : undefined,
    country_code: typeof candidate.country_code === "string" ? candidate.country_code : undefined,
    description: typeof candidate.description === "string" ? candidate.description : undefined,
  };
}

export default function ConciergeBookingsPage() {
  const queryClient = useQueryClient();
  const profileQuery = useAdminProfile();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [customerSearch, setCustomerSearch] = useState("");
  const [cleanerSearch, setCleanerSearch] = useState("");
  const [scheduleInput, setScheduleInput] = useState("");
  const [customDetailsInput, setCustomDetailsInput] = useState("");
  const [submitBanner, setSubmitBanner] = useState<string | null>(null);
  const [draft, setDraft] = useState<ConciergeDraft>(() => emptyDraft());

  const [newAddressQuery, setNewAddressQuery] = useState("");
  const [selectedPlaceSuggestion, setSelectedPlaceSuggestion] = useState<PlacesAutocompleteItem | null>(null);
  const [addressLabel, setAddressLabel] = useState("");
  const [isDefaultAddress, setIsDefaultAddress] = useState(false);

  const canRead = canAccessAdminAction({ method: "GET", path: "/v1/admins/concierge-bookings" }, profileQuery.data);
  const canCreate = canAccessAdminAction(
    { method: "POST", path: "/v1/admins/concierge-bookings/create-booking" },
    profileQuery.data
  );
  const canAutocompleteUsers = canAccessAdminAction(
    { method: "GET", path: "/v1/admins/users/autocomplete" },
    profileQuery.data
  );
  const canReadServices = canAccessAdminAction({ method: "GET", path: "/v1/admins/service-definitions" }, profileQuery.data);
  const canReadAddOns = canAccessAdminAction({ method: "GET", path: "/v1/admins/add-ons" }, profileQuery.data);
  const canReadCustomerPlaces = canAccessAdminAction(
    { method: "GET", path: "/v1/admins/customers/{customer_id}/places" },
    profileQuery.data
  );
  const canCreateCustomerPlace = canAccessAdminAction(
    { method: "POST", path: "/v1/admins/customers/{customer_id}/places" },
    profileQuery.data
  );

  const bookingsQuery = useQuery({
    queryKey: ["operations", "concierge-bookings"],
    queryFn: () => listConciergeBookings(0, 100),
    enabled: canRead,
  });

  const customerAutocompleteQuery = useQuery({
    queryKey: ["concierge-booking", "autocomplete", "customer", customerSearch],
    queryFn: () => autocompleteAdminUsers(customerSearch.trim(), 10),
    enabled: open && step === 0 && canAutocompleteUsers && customerSearch.trim().length >= 2,
  });

  const placesQuery = useQuery({
    queryKey: ["concierge-booking", "customer-places", draft.customerId],
    queryFn: () => listAdminCustomerPlaces(draft.customerId || ""),
    enabled: open && step >= 1 && !!draft.customerId && canReadCustomerPlaces,
  });

  const placeAutocompleteQuery = useQuery({
    queryKey: ["concierge-booking", "places-autocomplete", newAddressQuery],
    queryFn: () => autocompletePlaces(newAddressQuery.trim(), 10),
    enabled: open && step === 1 && !!draft.customerId && newAddressQuery.trim().length >= 2,
  });

  const placeDetailsQuery = useQuery({
    queryKey: ["concierge-booking", "place-details", selectedPlaceSuggestion?.place_id],
    queryFn: () => getPlaceDetails(selectedPlaceSuggestion?.place_id || ""),
    enabled: open && step === 1 && !!selectedPlaceSuggestion?.place_id,
  });

  const cleanerAutocompleteQuery = useQuery({
    queryKey: ["concierge-booking", "autocomplete", "cleaner", cleanerSearch],
    queryFn: () => autocompleteAdminUsers(cleanerSearch.trim(), 10),
    enabled: open && step === 2 && canAutocompleteUsers && cleanerSearch.trim().length >= 2,
  });

  const serviceDefinitionsQuery = useQuery({
    queryKey: ["concierge-booking", "service-definitions"],
    queryFn: () => listServiceDefinitions(0, 100),
    enabled: open && canReadServices,
  });

  const addOnsQuery = useQuery({
    queryKey: ["concierge-booking", "add-ons"],
    queryFn: () => listAddOns(0, 100),
    enabled: open && canReadAddOns,
  });

  useEffect(() => {
    if (!open) return;
    if (!profileQuery.data?.id) return;
    setDraft((prev) => ({ ...prev, adminId: profileQuery.data?.id || "" }));
  }, [open, profileQuery.data?.id]);

  const availableCustomers = customerAutocompleteQuery.data?.customers || [];
  const availableCleaners = cleanerAutocompleteQuery.data?.cleaners || [];
  const availablePlaces = placesQuery.data || [];
  const placeSuggestions = placeAutocompleteQuery.data || [];
  const services = serviceDefinitionsQuery.data || [];
  const addOns = addOnsQuery.data || [];

  const placesUnavailable = !canReadCustomerPlaces || placesQuery.isError || (placesQuery.isSuccess && availablePlaces.length === 0);

  const selectedCleaner = useMemo(() => {
    const cleaners = cleanerAutocompleteQuery.data?.cleaners || [];
    return cleaners.find((item) => getItemId(item) === draft.cleanerId) || null;
  }, [cleanerAutocompleteQuery.data?.cleaners, draft.cleanerId]);

  const parsedCustomDetails = useMemo(() => {
    if (draft.service !== "CUSTOM") {
      return { value: null as Record<string, unknown> | null, error: null as string | null };
    }
    const raw = customDetailsInput.trim();
    if (!raw) {
      return { value: null, error: "Custom details are required for CUSTOM service." };
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { value: null, error: "Custom details must be a JSON object." };
      }
      return { value: parsed as Record<string, unknown>, error: null };
    } catch {
      return { value: null, error: "Custom details must be valid JSON." };
    }
  }, [customDetailsInput, draft.service]);

  const scheduleValidationError = useMemo(() => {
    if (!draft.schedule) return "Schedule is required.";
    const minAllowed = Math.floor(Date.now() / 1000) + 3600;
    if (draft.schedule < minAllowed) return "Schedule must be at least 1 hour from now.";
    return null;
  }, [draft.schedule]);

  const canAdvance = useMemo(() => {
    if (step === 0) return !!draft.customerId;
    if (step === 1) return !!draft.placeId;
    if (step === 2) return !!draft.cleanerId && selectedCleaner?.allow_admin_selection === true;
    if (step === 3) {
      const hasDuration = !!draft.duration && draft.duration.hours >= 0 && draft.duration.minutes >= 0;
      if (!draft.service || !hasDuration) return false;
      if (draft.service === "CUSTOM") return !parsedCustomDetails.error;
      return true;
    }
    if (step === 4) return true;
    if (step === 5) {
      return (
        !!draft.customerId &&
        !!draft.placeId &&
        !!draft.cleanerId &&
        !!draft.service &&
        !!draft.duration &&
        !scheduleValidationError &&
        (draft.service !== "CUSTOM" || !parsedCustomDetails.error)
      );
    }
    return false;
  }, [draft, parsedCustomDetails.error, scheduleValidationError, selectedCleaner?.allow_admin_selection, step]);

  const createAddressMutation = useMutation({
    mutationFn: (payload: { customerId: string; placeId: string; label: string; isDefault: boolean }) =>
      createAdminCustomerPlace(payload.customerId, {
        admin_id: draft.adminId,
        label: payload.label,
        place_id: payload.placeId,
        isDefault: payload.isDefault,
      }),
    onSuccess: async (result) => {
      const createdPlace = extractCreatedPlace(result);
      if (createdPlace?.place_id) {
        setDraft((prev) => ({ ...prev, placeId: createdPlace.place_id }));
      }
      toast.success("Customer address saved successfully.");
      setAddressLabel("");
      setNewAddressQuery("");
      setSelectedPlaceSuggestion(null);
      setIsDefaultAddress(false);
      await queryClient.invalidateQueries({ queryKey: ["concierge-booking", "customer-places", draft.customerId] });
    },
    onError: (error) => {
      const apiError = error as unknown as ApiError;
      toast.error(apiError.message || "Failed to save customer address.");
    },
  });

  const submitMutation = useMutation({
    mutationFn: (payload: ConciergeBookingCreateRequest) => createConciergeBookingByAdmin(payload),
    onSuccess: async (result) => {
      const bookingId = (result.booking?.id || result.booking?._id || "") as string;
      toast.success(bookingId ? `Concierge booking created: ${bookingId}` : "Concierge booking created successfully.");
      setOpen(false);
      setStep(0);
      setCustomerSearch("");
      setCleanerSearch("");
      setScheduleInput("");
      setCustomDetailsInput("");
      setNewAddressQuery("");
      setSelectedPlaceSuggestion(null);
      setAddressLabel("");
      setIsDefaultAddress(false);
      setSubmitBanner(null);
      setDraft(emptyDraft(profileQuery.data?.id || ""));
      await queryClient.invalidateQueries({ queryKey: ["operations", "concierge-bookings"] });
    },
    onError: (error) => {
      const apiError = error as unknown as ApiError;
      const code = parseApiCode(apiError);
      if (apiError.status === 422 && code === "CLEANER_NOT_AVAILABLE_FOR_ADMIN_SELECTION") {
        setStep(2);
        setSubmitBanner("Selected cleaner is not available for admin assignment. Please choose another cleaner.");
        toast.error("Selected cleaner is not available for admin assignment.");
        return;
      }
      setSubmitBanner(apiError.message || "Failed to create concierge booking.");
      toast.error(apiError.message || "Failed to create concierge booking.");
    },
  });

  const openModal = () => {
    setOpen(true);
    setStep(0);
    setCustomerSearch("");
    setCleanerSearch("");
    setScheduleInput("");
    setCustomDetailsInput("");
    setNewAddressQuery("");
    setSelectedPlaceSuggestion(null);
    setAddressLabel("");
    setIsDefaultAddress(false);
    setSubmitBanner(null);
    setDraft(emptyDraft(profileQuery.data?.id || ""));
  };

  const closeModal = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) return;
    setSubmitBanner(null);
  };

  const submit = () => {
    if (!canAdvance || !canCreate) return;

    const payload: ConciergeBookingCreateRequest = {
      customer_id: draft.customerId || "",
      place_id: draft.placeId || "",
      cleaner_id: draft.cleanerId || "",
      schedule: draft.schedule || 0,
      extras: {
        ...draft.extras,
        add_ons: draft.extras.add_ons || [],
      },
      service: draft.service || "",
      duration: draft.duration || { hours: 0, minutes: 0 },
      custom_details: draft.service === "CUSTOM" ? parsedCustomDetails.value : null,
    };

    submitMutation.mutate(payload);
  };

  const nextStep = () => {
    if (!canAdvance || step >= STEP_LABELS.length - 1) return;
    setStep((prev) => prev + 1);
  };

  const prevStep = () => {
    if (step <= 0) return;
    setStep((prev) => prev - 1);
  };

  const handleCreateAddress = () => {
    const placeId = placeDetailsQuery.data?.place_id || selectedPlaceSuggestion?.place_id || "";
    if (!draft.customerId || !draft.adminId || !placeId || !addressLabel.trim()) return;
    createAddressMutation.mutate({
      customerId: draft.customerId,
      placeId,
      label: addressLabel.trim(),
      isDefault: isDefaultAddress,
    });
  };

  if (!canRead) {
    return (
      <div className="surface-card p-6">
        <p className="text-sm text-muted-foreground">You do not have permission to view this module.</p>
      </div>
    );
  }

  const listRows = bookingsQuery.data || [];

  return (
    <div className="space-y-5 max-w-[1200px]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Concierge Bookings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage admin-assisted bookings and concierge tracking records.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => bookingsQuery.refetch()}
            disabled={bookingsQuery.isFetching}
          >
            <RefreshCw className={`h-4 w-4 ${bookingsQuery.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={openModal} disabled={!canCreate}>
            Create Concierge Booking
          </Button>
        </div>
      </div>

      {!canCreate && (
        <div className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          You have read access only. Missing permission: <span className="font-mono-data">POST:/admins/concierge-bookings/create-booking</span>
        </div>
      )}

      {bookingsQuery.isLoading ? (
        <AdminLoadingState label="Loading concierge bookings..." />
      ) : bookingsQuery.isError ? (
        <div className="surface-card p-4 text-destructive">Failed to load concierge bookings.</div>
      ) : (
        <div className="surface-card p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Booking ID</TableHead>
                <TableHead>Customer ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    No concierge bookings found.
                  </TableCell>
                </TableRow>
              ) : (
                listRows.map((item) => {
                  const id = getItemId(item);
                  const bookingId = typeof item.booking_id === "string" ? item.booking_id : "-";
                  const customerId = typeof item.customer_id === "string" ? item.customer_id : "-";
                  const status = typeof item.status === "string" ? item.status : "-";
                  return (
                    <TableRow key={id || `${bookingId}-${customerId}`}>
                      <TableCell className="font-mono-data text-xs">{id || "-"}</TableCell>
                      <TableCell className="font-mono-data text-xs">{bookingId}</TableCell>
                      <TableCell className="font-mono-data text-xs">{customerId}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{status}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatCreated(item.date_created || item.created_at)}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={closeModal}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Create Concierge Booking</DialogTitle>
            <DialogDescription>
              Complete all steps to submit a concierge booking with eligible cleaner assignment.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 sm:grid-cols-6">
            {STEP_LABELS.map((label, index) => (
              <div
                key={label}
                className={`rounded-md border px-3 py-2 text-xs ${
                  index === step ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground"
                }`}
              >
                {index + 1}. {label}
              </div>
            ))}
          </div>

          {submitBanner && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4" />
              <span>{submitBanner}</span>
            </div>
          )}

          <div className="space-y-4">
            {step === 0 && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="customer-search">Search customer</Label>
                  <Input
                    id="customer-search"
                    placeholder="Type name, email, or id"
                    value={customerSearch}
                    onChange={(event) => setCustomerSearch(event.target.value)}
                    disabled={!canAutocompleteUsers}
                  />
                  {!canAutocompleteUsers && (
                    <p className="text-xs text-muted-foreground font-mono-data">
                      Missing permission: GET:/admins/users/autocomplete
                    </p>
                  )}
                </div>

                {customerAutocompleteQuery.isFetching && (
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Searching customers...
                  </div>
                )}

                <div className="max-h-56 overflow-y-auto rounded-md border">
                  {availableCustomers.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground">No customers found.</div>
                  ) : (
                    availableCustomers.map((customer, index) => {
                      const id = getItemId(customer);
                      const active = draft.customerId === id;
                      return (
                        <button
                          key={id || customer.email || customer.full_name || `customer-${index}`}
                          type="button"
                          className={`w-full border-b px-3 py-2 text-left last:border-b-0 ${active ? "bg-primary/5" : "hover:bg-muted/40"}`}
                          onClick={() => {
                            setDraft((prev) => ({ ...prev, customerId: id, placeId: null }));
                            setSelectedPlaceSuggestion(null);
                            setAddressLabel("");
                            setNewAddressQuery("");
                          }}
                        >
                          <p className="text-sm font-medium">{getDisplayName(customer)}</p>
                          <p className="text-xs text-muted-foreground font-mono-data">{customer.email || id || "-"}</p>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label>Saved addresses</Label>
                  <p className="text-xs text-muted-foreground">Pick an existing customer place or create a new one.</p>
                </div>

                {canReadCustomerPlaces ? (
                  placesQuery.isFetching ? (
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading customer places...
                    </div>
                  ) : placesQuery.isError ? (
                    <div className="rounded-md border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-800">
                      Could not load saved places. Use the add-address section below.
                    </div>
                  ) : availablePlaces.length === 0 ? (
                    <div className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                      No saved places found for this customer. Add a new address below.
                    </div>
                  ) : (
                    <div className="max-h-52 overflow-y-auto rounded-md border">
                      {availablePlaces.map((place, index) => {
                        const active = draft.placeId === place.place_id;
                        return (
                          <button
                            key={place.place_id || `saved-place-${index}`}
                            type="button"
                            className={`w-full border-b px-3 py-2 text-left last:border-b-0 ${active ? "bg-primary/5" : "hover:bg-muted/40"}`}
                            onClick={() => setDraft((prev) => ({ ...prev, placeId: place.place_id }))}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium">{place.label || place.name || "Saved Place"}</p>
                              <Badge variant="outline" className="font-mono-data text-[10px]">{place.place_id}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{place.formatted_address || place.description || "No address details"}</p>
                          </button>
                        );
                      })}
                    </div>
                  )
                ) : (
                  <div className="rounded-md border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-800">
                    Missing permission: GET:/admins/customers/{"{customer_id}"}/places. Use add-address flow below.
                  </div>
                )}

                <div className="rounded-md border p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <PlusCircle className="h-4 w-4 text-primary" />
                    <p className="text-sm font-medium">Add new customer address</p>
                  </div>

                  {!canCreateCustomerPlace ? (
                    <p className="text-xs text-muted-foreground font-mono-data">
                      Missing permission: POST:/admins/customers/{"{customer_id}"}/places
                    </p>
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        <Label htmlFor="place-query">Search location</Label>
                        <Input
                          id="place-query"
                          value={newAddressQuery}
                          onChange={(event) => setNewAddressQuery(event.target.value)}
                          placeholder="Start typing an address"
                        />
                        {placeAutocompleteQuery.isFetching && (
                          <p className="text-xs text-muted-foreground flex items-center gap-2">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Finding location suggestions...
                          </p>
                        )}
                      </div>

                      {placeSuggestions.length > 0 && (
                        <div className="max-h-40 overflow-y-auto rounded-md border">
                          {placeSuggestions.map((suggestion, index) => (
                            <button
                              key={suggestion.place_id || `suggestion-${index}`}
                              type="button"
                              className={`w-full border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted/40 ${
                                selectedPlaceSuggestion?.place_id === suggestion.place_id ? "bg-primary/5" : ""
                              }`}
                              onClick={() => setSelectedPlaceSuggestion(suggestion)}
                            >
                              <p className="text-sm font-medium">{suggestion.name || suggestion.description || suggestion.place_id}</p>
                              <p className="text-xs text-muted-foreground">{suggestion.formatted_address || suggestion.place_id}</p>
                            </button>
                          ))}
                        </div>
                      )}

                      {placeDetailsQuery.isFetching && selectedPlaceSuggestion && (
                        <p className="text-xs text-muted-foreground flex items-center gap-2">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Resolving place details...
                        </p>
                      )}

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr]">
                        <div className="space-y-1.5">
                          <Label htmlFor="address-label">Address label</Label>
                          <Input
                            id="address-label"
                            value={addressLabel}
                            onChange={(event) => setAddressLabel(event.target.value)}
                            placeholder="Home, Office, Client HQ"
                          />
                        </div>
                        <div className="flex items-end pb-1.5 gap-2">
                          <Checkbox id="default-address" checked={isDefaultAddress} onCheckedChange={(checked) => setIsDefaultAddress(checked === true)} />
                          <Label htmlFor="default-address" className="text-sm">Set default</Label>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCreateAddress}
                        disabled={
                          createAddressMutation.isPending ||
                          !draft.customerId ||
                          !(placeDetailsQuery.data?.place_id || selectedPlaceSuggestion?.place_id) ||
                          !addressLabel.trim()
                        }
                      >
                        {createAddressMutation.isPending ? "Saving address..." : "Save address and use place"}
                      </Button>
                    </>
                  )}
                </div>

                {placesUnavailable && !canCreateCustomerPlace && !draft.placeId && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                    No available place source for this customer with current permissions.
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cleaner-search">Search cleaner</Label>
                  <Input
                    id="cleaner-search"
                    placeholder="Type name, email, or id"
                    value={cleanerSearch}
                    onChange={(event) => setCleanerSearch(event.target.value)}
                    disabled={!canAutocompleteUsers}
                  />
                </div>

                {cleanerAutocompleteQuery.isFetching && (
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Searching cleaners...
                  </div>
                )}

                <div className="max-h-56 overflow-y-auto rounded-md border">
                  {availableCleaners.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground">No cleaners found.</div>
                  ) : (
                    availableCleaners.map((cleaner, index) => {
                      const id = getItemId(cleaner);
                      const isEligible = cleaner.allow_admin_selection === true;
                      const active = draft.cleanerId === id;
                      return (
                        <button
                          key={id || cleaner.email || cleaner.full_name || `cleaner-${index}`}
                          type="button"
                          disabled={!isEligible}
                          className={`w-full border-b px-3 py-2 text-left last:border-b-0 ${
                            active ? "bg-primary/5" : "hover:bg-muted/40"
                          } ${!isEligible ? "cursor-not-allowed opacity-60" : ""}`}
                          onClick={() => {
                            if (!isEligible) return;
                            setDraft((prev) => ({ ...prev, cleanerId: id }));
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium">{getDisplayName(cleaner)}</p>
                            <Badge variant={isEligible ? "success" : "secondary"}>{isEligible ? "Eligible" : "Unavailable"}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground font-mono-data">{cleaner.email || id || "-"}</p>
                          {!isEligible && (
                            <p className="text-xs text-muted-foreground mt-1">Not available for admin assignment.</p>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Service</Label>
                  <Select
                    value={draft.service || SELECT_SENTINEL}
                    onValueChange={(value) => {
                      if (value === SELECT_SENTINEL) {
                        setDraft((prev) => ({ ...prev, service: null }));
                        return;
                      }
                      const selectedService = services.find((item) => serviceValue(item) === value);
                      const defaultDuration = selectedService ? resolveDuration(selectedService) : null;
                      setDraft((prev) => ({
                        ...prev,
                        service: value,
                        duration: defaultDuration || prev.duration || { hours: 2, minutes: 0 },
                        customDetails: value === "CUSTOM" ? prev.customDetails : null,
                      }));
                      if (value !== "CUSTOM") setCustomDetailsInput("");
                    }}
                    disabled={!canReadServices}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select service" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SELECT_SENTINEL}>Choose service</SelectItem>
                      {services.map((service) => {
                        const value = serviceValue(service);
                        return (
                          <SelectItem key={value} value={value}>
                            {serviceLabel(service)}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {!canReadServices && (
                    <p className="text-xs text-muted-foreground font-mono-data">
                      Missing permission: GET:/admins/service-definitions
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="duration-hours">Duration (hours)</Label>
                    <Input
                      id="duration-hours"
                      type="number"
                      min={0}
                      value={draft.duration?.hours ?? 0}
                      onChange={(event) => {
                        const nextValue = Math.max(0, Number(event.target.value || 0));
                        setDraft((prev) => ({
                          ...prev,
                          duration: {
                            hours: nextValue,
                            minutes: prev.duration?.minutes || 0,
                          },
                        }));
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="duration-minutes">Duration (minutes)</Label>
                    <Input
                      id="duration-minutes"
                      type="number"
                      min={0}
                      max={59}
                      value={draft.duration?.minutes ?? 0}
                      onChange={(event) => {
                        const nextValue = Math.min(59, Math.max(0, Number(event.target.value || 0)));
                        setDraft((prev) => ({
                          ...prev,
                          duration: {
                            hours: prev.duration?.hours || 0,
                            minutes: nextValue,
                          },
                        }));
                      }}
                    />
                  </div>
                </div>

                {draft.service === "CUSTOM" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="custom-details">Custom details (JSON object)</Label>
                    <Textarea
                      id="custom-details"
                      value={customDetailsInput}
                      onChange={(event) => setCustomDetailsInput(event.target.value)}
                      placeholder='{"notes":"Deep kitchen clean","rooms":3}'
                      rows={6}
                    />
                    {parsedCustomDetails.error && <p className="text-xs text-destructive">{parsedCustomDetails.error}</p>}
                  </div>
                )}
              </div>
            )}

            {step === 4 && (
              <div className="space-y-3">
                {!canReadAddOns ? (
                  <p className="text-sm text-muted-foreground font-mono-data">Missing permission: GET:/admins/add-ons</p>
                ) : addOns.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No add-ons available. You can continue without add-ons.</p>
                ) : (
                  <div className="max-h-64 overflow-y-auto rounded-md border">
                    {addOns.map((item) => {
                      const id = getItemId(item) || String(item.code || item.name || "");
                      const title = typeof item.name === "string" ? item.name : String(item.code || id || "Add-on");
                      const selected = draft.extras.add_ons.includes(id);
                      return (
                        <button
                          key={id || title}
                          type="button"
                          className={`w-full border-b px-3 py-2 text-left last:border-b-0 ${selected ? "bg-primary/5" : "hover:bg-muted/40"}`}
                          onClick={() => {
                            setDraft((prev) => {
                              const selectedItems = prev.extras.add_ons;
                              const nextAddOns = selectedItems.includes(id)
                                ? selectedItems.filter((entry) => entry !== id)
                                : [...selectedItems, id];
                              return {
                                ...prev,
                                extras: {
                                  ...prev.extras,
                                  add_ons: nextAddOns,
                                },
                              };
                            });
                          }}
                        >
                          <p className="text-sm font-medium">{title}</p>
                          <p className="text-xs text-muted-foreground font-mono-data">{id || "-"}</p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {step === 5 && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="schedule">Schedule</Label>
                  <Input
                    id="schedule"
                    type="datetime-local"
                    value={scheduleInput || toDatetimeLocal(draft.schedule)}
                    onChange={(event) => {
                      setScheduleInput(event.target.value);
                      setDraft((prev) => ({ ...prev, schedule: toUnixSeconds(event.target.value) }));
                    }}
                  />
                  {scheduleValidationError && <p className="text-xs text-destructive">{scheduleValidationError}</p>}
                </div>

                <div className="rounded-md border bg-muted/30 p-3 text-xs font-mono-data space-y-1">
                  <p>customer_id: {draft.customerId || "-"}</p>
                  <p>place_id: {draft.placeId || "-"}</p>
                  <p>cleaner_id: {draft.cleanerId || "-"}</p>
                  <p>service: {draft.service || "-"}</p>
                  <p>duration: {draft.duration ? `${draft.duration.hours}h ${draft.duration.minutes}m` : "-"}</p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex items-center justify-between">
            <div className="mr-auto text-xs text-muted-foreground">
              Step {step + 1} of {STEP_LABELS.length}: {STEP_LABELS[step]}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={prevStep} disabled={step === 0 || submitMutation.isPending}>
                Back
              </Button>
              {step < STEP_LABELS.length - 1 ? (
                <Button onClick={nextStep} disabled={!canAdvance || submitMutation.isPending}>
                  Next
                </Button>
              ) : (
                <Button onClick={submit} disabled={!canAdvance || submitMutation.isPending || !canCreate}>
                  {submitMutation.isPending ? "Submitting..." : "Create Booking"}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
