import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { placeOrder, type CheckoutState } from "@/app/checkout/actions";
import { CheckoutForm } from "@/components/CheckoutForm";

// The real action is a server function. In a component test we only care how the form
// behaves for the results the action can return, so we replace it with a mock.
jest.mock("@/app/checkout/actions", () => ({ placeOrder: jest.fn() }));
const placeOrderMock = jest.mocked(placeOrder);

const KEY = "3b241101-e2bb-4255-8caf-4136c566a962";

function setup() {
  return { user: userEvent.setup(), ...render(<CheckoutForm idempotencyKey={KEY} totalLabel="€358.00" />) };
}

beforeEach(() => placeOrderMock.mockReset());

describe("CheckoutForm", () => {
  it("renders the fields and a submit button with the total", () => {
    setup();
    expect(screen.getByLabelText("Full name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Postal code")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Place order (€358.00)" })).toBeEnabled();
  });

  it("sends the idempotency key and what the user typed to the action", async () => {
    placeOrderMock.mockResolvedValue({ ok: false, message: "stop here" });
    const { user } = setup();

    await user.type(screen.getByLabelText("Full name"), "Anh Tu Le");
    await user.click(screen.getByRole("button", { name: /place order/i }));

    await waitFor(() => expect(placeOrderMock).toHaveBeenCalledTimes(1));
    const formData = placeOrderMock.mock.calls[0][1];
    expect(formData.get("idempotencyKey")).toBe(KEY);
    expect(formData.get("fullName")).toBe("Anh Tu Le");
    expect(formData.get("country")).toBe("FI");
  });

  it("shows field errors from the server and keeps the typed values", async () => {
    const result: CheckoutState = {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: { email: ["Enter a valid email address"] },
      values: { fullName: "Anh Tu Le", email: "nope", country: "SE" },
    };
    placeOrderMock.mockResolvedValue(result);
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: /place order/i }));

    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    expect(screen.getByText("Please fix the highlighted fields.")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Full name")).toHaveValue("Anh Tu Le"); // not wiped by the form reset
    expect(screen.getByLabelText("Country")).toHaveValue("SE");
  });

  it("disables the button while the action is running", async () => {
    let finish: (state: CheckoutState) => void = () => {};
    placeOrderMock.mockImplementation(() => new Promise<CheckoutState>((resolve) => (finish = resolve)));
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: /place order/i }));

    const pending = await screen.findByRole("button", { name: "Placing order..." });
    expect(pending).toBeDisabled();

    finish({ ok: false, message: "Your cart is empty." });
    expect(await screen.findByText("Your cart is empty.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /place order/i })).toBeEnabled();
  });
});
