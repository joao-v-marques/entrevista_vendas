import { bindOverlayDismiss } from "./modalOverlay.js";

// Enquanto houver algum modal aberto o fundo não pode rolar. A trava é derivada do
// estado real dos overlays (e não de um contador), então qualquer caminho de
// fechamento — X, Cancelar, Esc ou clique fora — chega ao mesmo resultado.
export function syncBodyScrollLock() {
    const anyOpen = [...document.querySelectorAll(".modal-overlay")].some(overlay => !overlay.hidden);
    const root = document.documentElement;

    if (anyOpen === root.classList.contains("modal-open")) return;

    // mede a barra de rolagem ANTES de travar; depois de travar ela já sumiu
    const scrollbarWidth = window.innerWidth - root.clientWidth;

    root.classList.toggle("modal-open", anyOpen);
    root.style.paddingRight = anyOpen && scrollbarWidth > 0 ? `${scrollbarWidth}px` : "";
}

export function setModalVisible(overlayId, visible) {
    document.getElementById(overlayId).hidden = !visible;
    syncBodyScrollLock();
}

// Cada seção da página registra aqui os seus próprios overlays. Antes isso era um
// querySelectorAll(".modal-overlay") global rodando dentro da seção de usuários —
// com mais de uma seção na página o mesmo overlay acabaria com o bind duplicado.
export function registerModalDismiss(overlayId, onClose) {
    const overlay = document.getElementById(overlayId);
    if (!overlay) return;

    const close = onClose || (() => setModalVisible(overlayId, false));

    bindOverlayDismiss(overlay, close);

    // só o modal aberto reage ao Esc; os outros registros ignoram a tecla
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !overlay.hidden) close();
    });
}
