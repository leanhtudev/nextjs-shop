import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "@/components/Modal";

// An intercepted-route modal closes by going back in history, so the router is the thing to check.
const mockBack = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ back: mockBack }) }));

beforeEach(() => mockBack.mockClear());

describe("Modal (shell for an intercepting route)", () => {
  it("renders an accessible dialog with its content and moves focus into it", () => {
    render(
      <Modal title="Phone Alpha">
        <p>Quick view content</p>
      </Modal>,
    );
    const dialog = screen.getByRole("dialog", { name: "Phone Alpha" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Quick view content")).toBeInTheDocument();
    expect(dialog).toHaveFocus();
  });

  it("closes (router.back) with the close button", async () => {
    render(<Modal title="x">content</Modal>);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape", async () => {
    render(<Modal title="x">content</Modal>);
    await userEvent.keyboard("{Escape}");
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("closes when the backdrop is clicked, but not when the dialog itself is clicked", async () => {
    const { container } = render(
      <Modal title="x">
        <p>inside</p>
      </Modal>,
    );
    await userEvent.click(screen.getByText("inside"));
    expect(mockBack).not.toHaveBeenCalled();

    await userEvent.click(container.querySelector(".modal-backdrop") as HTMLElement);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("locks page scroll while open and restores it on close", () => {
    document.body.style.overflow = "auto";
    const { unmount } = render(<Modal title="x">content</Modal>);
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("auto");
  });
});
