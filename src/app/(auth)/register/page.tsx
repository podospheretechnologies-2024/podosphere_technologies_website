import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Create account' };

export default function RegisterPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Invite only</h1>
      <p className="text-muted-foreground mt-1 mb-6 text-sm">
        New workspaces are not open yet. Ask your admin for an invite, then log in with that account.
      </p>
      <Link
        href="/login"
        className="bg-primary text-primary-foreground inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium"
      >
        Log in
      </Link>
    </>
  );
}
