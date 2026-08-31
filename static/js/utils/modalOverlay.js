export function bindOverlayDismiss(overlay, closeModal) {
    let startedOnOverlay = false;

    overlay.addEventListener("pointerdown", (event) => {
        startedOnOverlay = event.target === overlay;
    });

    overlay.addEventListener("pointercancel", () => {
        startedOnOverlay = false;
    });

    overlay.addEventListener("click", (event) => {
        const endedOnOverlay = event.target === overlay;

        if (startedOnOverlay && endedOnOverlay) closeModal();

        startedOnOverlay = false;
    });
}
