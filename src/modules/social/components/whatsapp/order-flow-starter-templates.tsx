'use client';

import {
  ORDER_FLOW_BY_KEY,
  ORDER_FLOW_KEYS,
  ORDER_FLOW_STARTER_TEMPLATES,
} from '../../config/order-flows';

/** Read-only copy of suggested Meta template wording for the agency to submit. */
export function OrderFlowStarterTemplates() {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Starter templates for Meta</h3>
        <p className="text-muted-foreground text-sm">
          Submit these (or similar) from Meta Business Manager on the client&apos;s WhatsApp
          Business account. Names are suggestions; blanks map to order fields in each flow.
        </p>
      </div>
      <ul className="space-y-3">
        {ORDER_FLOW_KEYS.map((key) => {
          const def = ORDER_FLOW_BY_KEY[key];
          const starter = ORDER_FLOW_STARTER_TEMPLATES[key];
          return (
            <li key={key} className="border-border rounded-lg border p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium">
                  {def.label}{' '}
                  <span className="text-muted-foreground font-normal">· {starter.name}</span>
                </p>
                <span className="text-muted-foreground text-xs uppercase tracking-wide">
                  {starter.category}
                </span>
              </div>
              <p className="mt-2 text-sm whitespace-pre-wrap">{starter.body}</p>
              {starter.buttonText ? (
                <p className="text-muted-foreground mt-1 text-xs">
                  Button: {starter.buttonText}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
