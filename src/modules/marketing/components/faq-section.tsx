import { FAQ_ITEMS } from '../config/site';

export function FaqSection({
  items = FAQ_ITEMS,
  title = 'Questions agencies ask us',
}: {
  items?: readonly { q: string; a: string }[];
  title?: string;
}) {
  return (
    <section className="mx-auto max-w-3xl px-6 py-20">
      <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">{title}</h2>
      <div className="mt-10 divide-y divide-[#E8E8E4]">
        {items.map((item) => (
          <details key={item.q} className="group py-5">
            <summary className="cursor-pointer list-none text-base font-semibold tracking-tight marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="flex items-start justify-between gap-4">
                {item.q}
                <span className="text-muted-foreground text-xl leading-none group-open:rotate-45">
                  +
                </span>
              </span>
            </summary>
            <p className="text-muted-foreground mt-3 text-sm leading-relaxed">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
