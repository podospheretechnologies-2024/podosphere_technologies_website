import Link from 'next/link';
import { legal } from '../config/legal';
import { PRODUCT_NAV } from '../config/site';
import { PodoWordmark } from './wordmark';

export function MarketingFooter() {
  return (
    <footer className="border-border border-t bg-[#F7F7F5]">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-4">
        <div className="md:col-span-1">
          <PodoWordmark />
          <p className="text-muted-foreground mt-4 max-w-xs text-sm leading-relaxed">
            Social publishing, WhatsApp, ads and client reporting for Indian agencies.
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold">Product</p>
          <ul className="text-muted-foreground mt-3 space-y-2 text-sm">
            {PRODUCT_NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:text-foreground">
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/features/link-in-bio" className="hover:text-foreground">
                Link in bio
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold">Company</p>
          <ul className="text-muted-foreground mt-3 space-y-2 text-sm">
            <li>
              <Link href="/pricing" className="hover:text-foreground">
                Pricing
              </Link>
            </li>
            <li>
              <Link href="/docs/api" className="hover:text-foreground">
                API docs
              </Link>
            </li>
            <li>
              <Link href="/for/agencies" className="hover:text-foreground">
                For agencies
              </Link>
            </li>
            <li>
              <Link href="/support" className="hover:text-foreground">
                Support
              </Link>
            </li>
            <li>
              <a
                href={legal.whatsappLink}
                target="_blank"
                rel="noreferrer"
                className="hover:text-foreground"
              >
                WhatsApp
              </a>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold">Account & legal</p>
          <ul className="text-muted-foreground mt-3 space-y-2 text-sm">
            <li>
              <Link href="/login" className="hover:text-foreground">
                Agency log in
              </Link>
            </li>
            <li>
              <Link href="/login" className="hover:text-foreground">
                Client portal log in
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="hover:text-foreground">
                Privacy
              </Link>
            </li>
            <li>
              <Link href="/terms" className="hover:text-foreground">
                Terms
              </Link>
            </li>
            <li>
              <Link href="/data-deletion" className="hover:text-foreground">
                Data deletion
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-border text-muted-foreground border-t py-6 text-center text-sm">
        © {new Date().getFullYear()} {legal.company}
      </div>
    </footer>
  );
}
