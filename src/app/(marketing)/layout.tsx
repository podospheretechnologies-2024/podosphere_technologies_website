import Link from 'next/link';
import { Sparkles } from 'lucide-react';

export default function MarketingLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <header className="fixed inset-x-0 top-0 z-50 px-4">
        <nav className="border-border bg-surface/80 mx-auto mt-4 flex max-w-6xl items-center justify-between rounded-2xl border px-5 py-3 backdrop-blur-xl">
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
            <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
              <Sparkles className="size-4" />
            </span>
            Podo Social
          </Link>
          <div className="flex items-center gap-1 text-sm">
            <Link
              href="/#features"
              className="text-muted-foreground hover:text-foreground rounded-lg px-3 py-2 max-sm:hidden"
            >
              Features
            </Link>
            <Link
              href="/#agent"
              className="text-muted-foreground hover:text-foreground rounded-lg px-3 py-2 max-sm:hidden"
            >
              Podo AI
            </Link>
            <Link href="/login" className="text-muted-foreground hover:text-foreground rounded-lg px-3 py-2">
              Log in
            </Link>
            <Link
              href="/register"
              className="bg-primary text-primary-foreground rounded-lg px-4 py-2 font-medium hover:opacity-90"
            >
              Get started
            </Link>
          </div>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-border text-muted-foreground border-t py-10 text-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6">
          <p>© {new Date().getFullYear()} PodoSphere Technologies Pvt Ltd</p>
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
            <Link href="/data-deletion" className="hover:text-foreground">Data deletion</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
