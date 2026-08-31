const originalButtonContent = new WeakMap();

export function getFormSubmitButton(form) {
    if (!form) return null;

    return form.querySelector('[type="submit"]')
        || document.querySelector(`[type="submit"][form="${form.id}"]`);
}

export function setSubmitLoading(button, isLoading, loadingText = "Enviando...") {
    if (!button) return;

    if (isLoading) {
        if (button.dataset.loading === "true") return;

        originalButtonContent.set(button, button.innerHTML);
        button.dataset.loading = "true";
        button.disabled = true;
        button.classList.add("is-loading");
        button.innerHTML = `<span class="btn-spinner" aria-hidden="true"></span>${loadingText}`;
        button.setAttribute("aria-busy", "true");
        return;
    }

    button.innerHTML = originalButtonContent.get(button) ?? button.innerHTML;
    originalButtonContent.delete(button);
    button.dataset.loading = "false";
    button.disabled = false;
    button.classList.remove("is-loading");
    button.removeAttribute("aria-busy");
}
