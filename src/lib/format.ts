/** Money is stored in integer cents; format only at the edge (UI). */
export const eur = (cents: number) =>
  new Intl.NumberFormat("en-FI", { style: "currency", currency: "EUR" }).format(cents / 100);
