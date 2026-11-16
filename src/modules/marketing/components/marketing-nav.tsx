'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChevronDown, Menu, X } from 'lucide-react';
import { legal } from '../config/legal';
import { PRODUCT_NAV } from '../config/site';
import { PodoWordmark } from './wordmark';

export function MarketingNav() {
  const [open, setOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4">
      <nav className="border-border bg-surface/90 mx-auto mt-4 flex max-w-6xl items-center justify-between rounded-2xl border px-4 py-3 shadow-sm backdrop-blur-md md:px-5">
        <PodoWordmark />

        <div className="hidden items-center gap-1 text-sm md:flex">
          <div
            className="relative"
            onMouseEnter={() => setProductOpen(true)}
            onMouseLeave={() => setProductOpen(false)}
          >
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 rounded-lg px-3 py-2"
              aria-expanded={productOpen}
            >
              Product <ChevronDown className="size-3.5 opacity-70" />
            </button>
            {productOpen ? (
              <div className="border-border bg-surface absolute left-0 top-full z-20 mt-1 w-52 rounded-xl border p-2 shadow-lg">
                {PRODUCT_NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="hover:bg-surface-muted block rounded-lg px-3 py-2 text-sm"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
          <Link href="/features/whatsapp" className="text-muted-foreground hover:text-foreground rounded-lg px-3 py-2">
            WhatsApp
          </Link>
          <Link href="/pricing" className="text-muted-foreground hover:text-foreground rounded-lg px-3 py-2">
            Pricing
          </Link>
          <Link href="/docs/api" className="text-muted-foreground hover:text-foreground rounded-lg px-3 py-2">
            API
          </Link>
          <Link href="/login" className="text-muted-foreground hover:text-foreground rounded-lg px-3 py-2">
            Log in
          </Link>
          <Link
            href="/register"
            className="bg-primary text-primary-foreground ml-1 rounded-lg px-4 py-2 font-medium hover:opacity-90"
          >
            Start free
          </Link>
        </div>

        <button
          type="button"
          className="text-foreground rounded-lg p-2 md:hidden"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </nav>

      {open ? (
        <div className="border-border bg-surface mx-auto mt-2 max-w-6xl rounded-2xl border p-4 shadow-lg md:hidden">
          <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
            Product
          </p>
          <div className="mb-3 grid gap-1">
            {PRODUCT_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="hover:bg-surface-muted rounded-lg px-3 py-2 text-sm"
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="grid gap-1 text-sm">
            <Link href="/features/whatsapp" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2">
              WhatsApp
            </Link>
            <Link href="/pricing" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2">
              Pricing
            </Link>
            <Link href="/docs/api" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2">
              API
            </Link>
            <Link href="/login" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2">
              Log in
            </Link>
            <a
              href={legal.whatsappLink}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg px-3 py-2"
            >
              WhatsApp demo
            </a>
            <Link
              href="/register"
              onClick={() => setOpen(false)}
              className="bg-primary text-primary-foreground mt-2 rounded-lg px-4 py-2.5 text-center font-medium"
            >
              Start free
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
