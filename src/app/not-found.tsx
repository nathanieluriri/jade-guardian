import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">404</h1>
        <p className="text-muted-foreground">Page not found.</p>
        <Link href="/admin/overview" className="text-primary underline underline-offset-4">
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
