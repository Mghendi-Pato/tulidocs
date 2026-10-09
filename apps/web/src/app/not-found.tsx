import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <h1 className="text-3xl font-extrabold tracking-tight">Page not found</h1>
      <p className="mt-2 text-muted">The page you’re looking for doesn’t exist.</p>
      <Link href="/" className="link mt-6">
        Go home
      </Link>
    </div>
  );
}
