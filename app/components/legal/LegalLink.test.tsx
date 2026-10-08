// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MODAL_LEGAL_DOCUMENTS } from "@/lib/legal/modal-documents";
import { PRIVACY_SECTIONS, TERMS_SECTIONS } from "@/lib/legal/site-documents";
import LegalLink from "./LegalLink";

function setup() {
  render(
    <div>
      <input aria-label="name" />
      <LegalLink doc="terms">Terms</LegalLink> <LegalLink doc="privacy">Privacy</LegalLink>
    </div>,
  );
}

describe("LegalLink / LegalDocumentModal", () => {
  it("keeps a real href", () => {
    setup();
    expect(screen.getByText("Terms").getAttribute("href")).toBe("/terms");
    expect(screen.getByText("Privacy").getAttribute("href")).toBe("/privacy");
  });

  it("opens an accessible dialog on plain click, with the pages' content", async () => {
    setup();
    fireEvent.click(screen.getByText("Terms"));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(screen.getByRole("dialog", { name: "Terms of Use" })).toBe(dialog);
    expect(dialog.textContent).toContain("Last updated: October 6, 2026");
    for (const s of TERMS_SECTIONS) expect(dialog.textContent).toContain(s.title);
    expect(MODAL_LEGAL_DOCUMENTS.terms.sections).toBe(TERMS_SECTIONS);
    expect(MODAL_LEGAL_DOCUMENTS.privacy.sections).toBe(PRIVACY_SECTIONS);
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  });

  it("ESC closes and focus returns to the trigger", async () => {
    setup();
    const link = screen.getByText("Privacy");
    link.focus();
    fireEvent.click(link);
    await screen.findByRole("dialog", { name: "Privacy Policy" });
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(link);
  });

  it("Close button and backdrop close it", async () => {
    setup();
    fireEvent.click(screen.getByText("Terms"));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getAllByRole("button", { name: "Close" })[0]);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getByText("Terms"));
    fireEvent.mouseDown(await screen.findByTestId("legal-backdrop"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("does not intercept modified / middle clicks", () => {
    setup();
    const link = screen.getByText("Terms");
    fireEvent.click(link, { ctrlKey: true });
    fireEvent.click(link, { metaKey: true });
    fireEvent.click(link, { button: 1 });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("traps Tab focus inside the dialog", async () => {
    setup();
    fireEvent.click(screen.getByText("Terms"));
    const dialog = await screen.findByRole("dialog");
    const buttons = dialog.querySelectorAll("button");
    const last = buttons[buttons.length - 1] as HTMLElement;
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(dialog.contains(document.activeElement)).toBe(true);
  });
});
