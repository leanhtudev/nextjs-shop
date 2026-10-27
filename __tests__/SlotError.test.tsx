import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SlotError } from "@/components/SlotError";

describe("SlotError (error.tsx of one parallel-route slot)", () => {
  it("announces the failure for this panel and shows the server log reference", () => {
    const error = Object.assign(new Error("secret internal message"), { digest: "abc123" });
    render(<SlotError title="Recent activity" error={error} reset={() => {}} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Recent activity");
    expect(screen.getByText("This panel could not be loaded.")).toBeInTheDocument();
    expect(screen.getByText("Reference: abc123")).toBeInTheDocument();
    // The raw error message must not be rendered: in production it is hidden from the browser on purpose.
    expect(screen.queryByText(/secret internal message/)).not.toBeInTheDocument();
  });

  it("lets the user retry through reset()", async () => {
    const reset = jest.fn();
    render(<SlotError title="Revenue" error={new Error("boom")} reset={reset} />);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
