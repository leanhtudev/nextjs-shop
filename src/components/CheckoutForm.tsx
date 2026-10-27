"use client";

import { useActionState } from "react";
import { placeOrder, type CheckoutState } from "@/app/checkout/actions";
import { COUNTRIES } from "@/lib/checkout-schema";

const initialState: CheckoutState = { ok: false };

type FieldProps = {
  name: string;
  label: string;
  state: CheckoutState;
  type?: string;
  autoComplete?: string;
};

function Field({ name, label, state, type = "text", autoComplete }: FieldProps) {
  const error = state.fieldErrors?.[name]?.[0];
  return (
    <div className="field">
      <label>
        {label}
        <input
          name={name}
          type={type}
          autoComplete={autoComplete}
          // React 19 resets uncontrolled forms after an action, so the server echoes the values back.
          defaultValue={state.values?.[name] ?? ""}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${name}-error` : undefined}
        />
      </label>
      {/* Outside the <label>, so the error text does not become part of the input's accessible name. */}
      {error && (
        <span id={`${name}-error`} className="field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

/**
 * Checkout form driven by a Server Action (`placeOrder`).
 * It works as a plain HTML form submit even before JavaScript has loaded.
 * `useActionState` gives us the action's last result and a pending flag.
 */
export function CheckoutForm({ idempotencyKey, totalLabel }: { idempotencyKey: string; totalLabel: string }) {
  const [state, formAction, pending] = useActionState(placeOrder, initialState);

  return (
    <form action={formAction} className="form" noValidate>
      {/* Created when the page was rendered. Submitting the same form twice yields ONE order. */}
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      <Field name="fullName" label="Full name" state={state} autoComplete="name" />
      <Field name="email" label="Email" type="email" state={state} autoComplete="email" />
      <Field name="address" label="Street address" state={state} autoComplete="street-address" />
      <div className="row">
        <Field name="postalCode" label="Postal code" state={state} autoComplete="postal-code" />
        <Field name="city" label="City" state={state} autoComplete="address-level2" />
      </div>
      <div className="field">
        <label>
          Country
          {/* React does not apply a changed defaultValue to a <select> after mount, so the key remounts it
              with the echoed value (otherwise a failed submit would reset "SE" back to "FI"). */}
          <select key={state.values?.country ?? "initial"} name="country" defaultValue={state.values?.country ?? "FI"}>
            {COUNTRIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>
        {state.fieldErrors?.country?.[0] && (
          <span className="field-error" role="alert">
            {state.fieldErrors.country[0]}
          </span>
        )}
      </div>

      <p className="muted">Demo checkout: no payment is taken and no card data is collected.</p>

      <button type="submit" disabled={pending}>
        {pending ? "Placing order..." : `Place order (${totalLabel})`}
      </button>
      {state.message && (
        <p className={state.ok ? "ok" : "err"} role="alert">
          {state.message}
        </p>
      )}
    </form>
  );
}
