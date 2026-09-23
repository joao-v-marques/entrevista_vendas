import { fetchWithAuth, getErrorMessage } from "../utils/apiHelper.js";
import { escapeHtml, formatCPF, formatCNPJ, formatPhone, formatDateTime, formatBeneficiaryType } from "../utils/detailsView.js";
import { bindOverlayDismiss } from "../utils/modalOverlay.js";
import { syncBodyScrollLock } from "../utils/modalControl.js";
import { getStatusPillClass } from "../utils/statusPill.js";
import { setSubmitLoading } from "../utils/submitLoading.js";

// Modal de edição da ficha (PUT /application-forms/<id>). Os campos e as regras condicionais
// espelham o cadastro (new_form.html + validate_new_form.js); aquele script é clássico e preso
// aos ids da página de cadastro, por isso as regras são reescritas aqui para o modal.

const overlay = document.getElementById("editFormModalOverlay");
const idLabel = document.getElementById("editFormModalId");
const subtitle = document.getElementById("editFormModalSubtitle");
const statusBox = document.getElementById("editFormModalStatus");
const body = document.getElementById("editFormModalBody");
const footer = document.getElementById("editFormFooter");
const sectionNav = document.getElementById("editFormNav");
const form = document.getElementById("editForm");

const footerMain = document.getElementById("editFooterMain");
const footerDiscard = document.getElementById("editFooterDiscard");
const dirtyIndicator = document.getElementById("editDirtyIndicator");
const saveButton = document.getElementById("editFormSave");

const responsiblesContainer = document.getElementById("editResponsiblesContainer");
const responsibleTemplate = document.getElementById("editResponsibleTemplate");

const field = (name) => form.elements.namedItem(name);

const inclusionTypeSelect = field("inclusion_type");
const isDiscountSelect = field("is_discount");
const isPortabilitySelect = field("is_portability");

// estado da edição aberta
let currentFormId = null;
let currentBeneficiaryType = null;
let onSavedCallback = null;
let initialSnapshot = "";
let isSaving = false;
let responsibleSeq = 0;

/* ============================================================
   Máscaras e transformações (mesmas do cadastro)
   ============================================================ */

function maskCpf(digits) {
    let masked = digits.slice(0, 3);
    if (digits.length > 3) masked += "." + digits.slice(3, 6);
    if (digits.length > 6) masked += "." + digits.slice(6, 9);
    if (digits.length > 9) masked += "-" + digits.slice(9, 11);
    return masked;
}

function maskCnpj(digits) {
    let masked = digits.slice(0, 2);
    if (digits.length > 2) masked += "." + digits.slice(2, 5);
    if (digits.length > 5) masked += "." + digits.slice(5, 8);
    if (digits.length > 8) masked += "/" + digits.slice(8, 12);
    if (digits.length > 12) masked += "-" + digits.slice(12, 14);
    return masked;
}

// padrão 00/0000 do Plano anterior e do Mod./Prop.
function maskPlan(digits) {
    let masked = digits.slice(0, 2);
    if (digits.length > 2) masked += "/" + digits.slice(2, 6);
    return masked;
}

function maskPhone(digits) {
    let masked = "";

    if (digits.length > 0) masked += "(" + digits.slice(0, 2);
    if (digits.length > 2) masked += ") ";

    if (digits.length > 10) {
        masked += digits.slice(2, 7);
        if (digits.length > 7) masked += "-" + digits.slice(7, 11);
    } else if (digits.length > 2) {
        masked += digits.slice(2, 6);
        if (digits.length > 6) masked += "-" + digits.slice(6, 10);
    }

    return masked;
}

function toUpperNoAccent(value) {
    return value
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toUpperCase();
}

function bindMask(input, maxDigits, mask) {
    input.addEventListener("input", () => {
        input.value = mask(input.value.replace(/\D/g, "").slice(0, maxDigits));
    });
}

function bindUpperNoAccent(input) {
    input.addEventListener("input", () => {
        input.value = toUpperNoAccent(input.value);
    });
}

const onlyDigits = (value) => (value || "").replace(/\D/g, "");

bindMask(field("beneficiary_cpf"), 11, maskCpf);
bindMask(field("cnpj"), 14, maskCnpj);
bindMask(field("previous_plan"), 6, maskPlan);
bindMask(field("model_proposal"), 6, maskPlan);
bindMask(field("beneficiary_phone"), 11, maskPhone);
bindUpperNoAccent(field("beneficiary_name"));

/* ============================================================
   Conversões do que vem do backend para os campos
   ============================================================ */

// "Mon, 01 Jan 2001 00:00:00 GMT" -> "YYYY-MM-DD" (UTC, formato do <input type="date">)
function toDateInputValue(value) {
    if (!value) return "";

    const date = new Date(value);
    if (isNaN(date)) return "";

    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

// booleanos viram o value dos selects SIM/NÃO
function toBoolValue(value) {
    return value === true || value === "true" ? "true" : "false";
}

// o desconto é gravado como fração (0.50) e editado como percentual (50)
function toPercentValue(value) {
    if (value === null || value === undefined || value === "") return "";
    const number = Number(value);
    return isNaN(number) ? "" : String(Math.round(number * 10000) / 100);
}

function getLocalToday() {
    const date = new Date();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
}

/* ============================================================
   Regras condicionais (mesmas do cadastro)
   ============================================================ */

// mostra/oculta um grupo; campo desabilitado não entra no FormData, então não é enviado
function setGroupVisible(groupId, visible) {
    const group = document.getElementById(groupId);
    group.hidden = !visible;

    group.querySelectorAll("input, select, textarea").forEach(input => {
        input.disabled = !visible;
        if (!visible) input.value = input.tagName === "SELECT" ? input.options[0].value : "";
    });
}

// alterna o obrigatório no campo e o asterisco no label
function setRequired(input, required) {
    input.required = required;
    input.closest(".form-group").querySelector(".form-label")?.classList.toggle("required", required);
}

function applyInclusionTypeRules() {
    const type = inclusionTypeSelect.value;
    const isNewContract = type === "Novo Contrato";
    const isPlanChange = type === "Troca de Plano";
    const isExisting = type === "Existente";

    setGroupVisible("edit_cnpj_group", isNewContract);
    setGroupVisible("edit_previous_plan_group", isPlanChange);
    setGroupVisible("edit_previous_plan_cancellation_date_group", isPlanChange);

    // Mod./Prop.: some em Novo Contrato e é opcional em Troca de Plano
    setGroupVisible("edit_model_proposal_group", !isNewContract);
    setRequired(field("model_proposal"), !isPlanChange && !isNewContract);

    // Existente não possui desconto: trava em NÃO (o valor é forçado no payload)
    if (isExisting) isDiscountSelect.value = "false";
    isDiscountSelect.disabled = isExisting;
    document.getElementById("edit_is_discount_hint").hidden = !isExisting;
    applyDiscountRules();

    // Existente dispensa Estado civil e Profissão dos responsáveis
    responsiblesContainer.querySelectorAll(".edit-responsible").forEach(applyExistingRuleToResponsible);
}

function applyDiscountRules() {
    const hasDiscount = isDiscountSelect.value === "true";

    setGroupVisible("edit_discount_percentage_group", hasDiscount);
    setGroupVisible("edit_discount_observation_group", hasDiscount);
}

function applyPortabilityRules() {
    const isPortability = isPortabilitySelect.value === "true";

    setGroupVisible("edit_portability_accepted_group", isPortability);
    setGroupVisible("edit_portability_accepted_date_group", isPortability);
    setGroupVisible("edit_portability_observation_group", isPortability);
}

// titular do dependente e parentesco só existem para beneficiário dependente
function applyBeneficiaryTypeRules() {
    const isDependent = currentBeneficiaryType === "secondary";

    setGroupVisible("edit_primary_name_group", isDependent);
    setGroupVisible("edit_kinship_group", isDependent);
}

inclusionTypeSelect.addEventListener("change", applyInclusionTypeRules);
isDiscountSelect.addEventListener("change", applyDiscountRules);
isPortabilitySelect.addEventListener("change", applyPortabilityRules);

/* ============================================================
   Responsáveis pela inclusão
   ============================================================ */

function applyExistingRuleToResponsible(card) {
    const isExisting = inclusionTypeSelect.value === "Existente";

    ["marital_state", "profession"].forEach(name => {
        const input = card.querySelector(`[data-field="${name}"]`);
        input.closest(".form-group").hidden = isExisting;
        input.disabled = isExisting;
        if (isExisting && name === "profession") input.value = "";
    });
}

function renumberResponsibles() {
    const cards = responsiblesContainer.querySelectorAll(".edit-responsible");

    cards.forEach((card, index) => {
        card.querySelector(".edit-responsible-index").textContent = index + 1;
        // a ficha precisa de ao menos um responsável
        card.querySelector(".edit-responsible-remove").hidden = cards.length === 1;
    });
}

function addResponsible(data = {}) {
    responsibleSeq += 1;

    const fragment = responsibleTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".edit-responsible");

    // liga cada label ao seu campo com ids únicos
    card.querySelectorAll(".form-group").forEach(group => {
        const input = group.querySelector("[data-field]");
        input.id = `edit_responsible_${input.dataset.field}_${responsibleSeq}`;
        group.querySelector(".form-label").htmlFor = input.id;
    });

    const nameInput = card.querySelector('[data-field="name"]');
    const cpfInput = card.querySelector('[data-field="cpf"]');
    const maritalSelect = card.querySelector('[data-field="marital_state"]');
    const professionInput = card.querySelector('[data-field="profession"]');

    nameInput.value = data.name || "";
    cpfInput.value = data.cpf ? formatCPF(data.cpf) : "";
    if (data.marital_state) maritalSelect.value = data.marital_state;
    professionInput.value = data.profession || "";

    bindMask(cpfInput, 11, maskCpf);
    bindUpperNoAccent(nameInput);
    bindUpperNoAccent(professionInput);

    card.querySelector(".edit-responsible-remove").addEventListener("click", () => {
        card.remove();
        renumberResponsibles();
        updateDirtyState();
    });

    responsiblesContainer.appendChild(fragment);
    applyExistingRuleToResponsible(card);
    renumberResponsibles();

    return card;
}

document.getElementById("editAddResponsible").addEventListener("click", () => {
    const card = addResponsible();
    card.querySelector('[data-field="name"]').focus();
    updateDirtyState();
});

/* ============================================================
   Preenchimento e payload
   ============================================================ */

function fillForm(applicationForm, responsibles) {
    form.reset();
    responsiblesContainer.innerHTML = "";
    currentBeneficiaryType = applicationForm.beneficiary_type;

    // primeiro os campos que controlam a visibilidade, depois as regras e só então os
    // dependentes, senão as regras limpariam os valores recém-preenchidos
    inclusionTypeSelect.value = applicationForm.inclusion_type || "Existente";
    isDiscountSelect.value = toBoolValue(applicationForm.is_discount);
    isPortabilitySelect.value = toBoolValue(applicationForm.is_portability);

    applyInclusionTypeRules();
    applyPortabilityRules();
    applyBeneficiaryTypeRules();

    const values = {
        previous_plan: applicationForm.previous_plan || "",
        previous_plan_cancellation_date: toDateInputValue(applicationForm.previous_plan_cancellation_date),
        cnpj: applicationForm.cnpj ? formatCNPJ(applicationForm.cnpj) : "",
        inclusion_date: toDateInputValue(applicationForm.inclusion_date),
        contract_type: applicationForm.contract_type,
        model_proposal: applicationForm.model_proposal || "",
        plan_type: applicationForm.plan_type,
        expiration_month: applicationForm.expiration_month != null ? String(applicationForm.expiration_month) : "",
        is_pa_digital: toBoolValue(applicationForm.is_pa_digital),
        is_aeromedic: toBoolValue(applicationForm.is_aeromedic),
        discount_percentage: toPercentValue(applicationForm.discount_percentage),
        discount_observation: applicationForm.discount_observation || "",
        beneficiary_name: applicationForm.beneficiary_name || "",
        beneficiary_cpf: applicationForm.beneficiary_cpf ? formatCPF(applicationForm.beneficiary_cpf) : "",
        beneficiary_birth_date: toDateInputValue(applicationForm.beneficiary_birth_date),
        beneficiary_phone: applicationForm.beneficiary_phone ? formatPhone(applicationForm.beneficiary_phone) : "",
        beneficiary_email: applicationForm.beneficiary_email || "",
        billing_email: applicationForm.billing_email || "",
        beneficiary_marital_state: applicationForm.beneficiary_marital_state,
        secondary_beneficiary_primary_name: applicationForm.secondary_beneficiary_primary_name || "",
        secondary_beneficiary_kinship: applicationForm.secondary_beneficiary_kinship || "",
        portability_accepted: toBoolValue(applicationForm.portability_accepted),
        portability_accepted_date: toDateInputValue(applicationForm.portability_accepted_date),
        portability_observation: applicationForm.portability_observation || "",
        especial_observations: applicationForm.especial_observations || "",
    };

    Object.entries(values).forEach(([name, value]) => {
        const input = field(name);
        // campos ocultos pela regra ficam vazios; value indefinido mantém o padrão do select
        if (!input || input.disabled || value === undefined || value === null) return;
        input.value = value;
    });

    const graceRadio = [...form.querySelectorAll('input[name="grace_option"]')]
        .find(radio => radio.value === applicationForm.grace_option);
    if (graceRadio) graceRadio.checked = true;

    const list = responsibles && responsibles.length ? responsibles : [{}];
    list.forEach(responsible => addResponsible(responsible));
}

function buildPayload() {
    const applicationFormData = Object.fromEntries(new FormData(form).entries());

    // o select de desconto fica desabilitado (fora do FormData) quando o tipo é Existente
    if (inclusionTypeSelect.value === "Existente") applicationFormData.is_discount = "false";

    // CNPJ, telefone e CPF mantêm a máscara na tela, mas são enviados só com os dígitos
    ["cnpj", "beneficiary_phone", "beneficiary_cpf"].forEach(name => {
        if (applicationFormData[name]) applicationFormData[name] = onlyDigits(applicationFormData[name]);
    });

    const responsibles = [...responsiblesContainer.querySelectorAll(".edit-responsible")].map(card => {
        const read = (name) => {
            const input = card.querySelector(`[data-field="${name}"]`);
            return input.disabled ? null : input.value;
        };

        return {
            name: read("name"),
            cpf: onlyDigits(read("cpf")),
            marital_state: read("marital_state"),
            profession: read("profession"),
        };
    });

    return { form: applicationFormData, responsibles };
}

/* ============================================================
   Alterações não salvas
   ============================================================ */

function isDirty() {
    return JSON.stringify(buildPayload()) !== initialSnapshot;
}

function updateDirtyState() {
    const dirty = isDirty();

    dirtyIndicator.hidden = !dirty;
    if (!isSaving) saveButton.disabled = !dirty;
    if (!dirty) showDiscardPrompt(false);
}

form.addEventListener("input", updateDirtyState);
form.addEventListener("change", updateDirtyState);

function showDiscardPrompt(visible) {
    footerDiscard.hidden = !visible;
    footerMain.hidden = visible;
}

/* ============================================================
   Navegação entre seções
   ============================================================ */

const navLinks = [...sectionNav.querySelectorAll(".edit-form-nav-link")];

navLinks.forEach(link => {
    link.addEventListener("click", () => {
        document.getElementById(link.dataset.target).scrollIntoView({ behavior: "smooth", block: "start" });
    });
});

// destaca a seção que está no topo da área rolável
function updateActiveNavLink() {
    const threshold = body.getBoundingClientRect().top + 24;

    let activeId = navLinks[0].dataset.target;
    navLinks.forEach(link => {
        if (document.getElementById(link.dataset.target).getBoundingClientRect().top <= threshold) {
            activeId = link.dataset.target;
        }
    });

    // no fim da rolagem a última seção pode não alcançar o topo, então ela vira a ativa
    if (body.scrollTop + body.clientHeight >= body.scrollHeight - 4) {
        activeId = navLinks[navLinks.length - 1].dataset.target;
    }

    navLinks.forEach(link => link.classList.toggle("is-active", link.dataset.target === activeId));
}

body.addEventListener("scroll", updateActiveNavLink, { passive: true });

/* ============================================================
   Controle do modal
   ============================================================ */

function renderContext(applicationForm) {
    const status = applicationForm.form_status_name || "—";

    document.getElementById("editContextStatus").innerHTML =
        `<span class="pill ${getStatusPillClass(status)}">${escapeHtml(status)}</span>`;
    document.getElementById("editContextType").textContent = formatBeneficiaryType(applicationForm.beneficiary_type) || "—";
    document.getElementById("editContextConsultant").textContent = applicationForm.consultant_name || "—";
    document.getElementById("editContextCreatedAt").textContent =
        applicationForm.created_at ? formatDateTime(applicationForm.created_at) : "—";

    subtitle.textContent = applicationForm.beneficiary_name || "";
}

function showStatus(html) {
    statusBox.innerHTML = html;
    statusBox.hidden = false;
    body.hidden = true;
    sectionNav.hidden = true;
    footer.hidden = true;
}

function closeModal() {
    overlay.hidden = true;
    syncBodyScrollLock();

    form.reset();
    responsiblesContainer.innerHTML = "";
    showDiscardPrompt(false);
    currentFormId = null;
    onSavedCallback = null;
    initialSnapshot = "";
}

// X, Cancelar, Esc e clique fora passam por aqui: com alterações pendentes, pede confirmação
function requestClose() {
    if (isSaving) return;

    if (!body.hidden && isDirty()) {
        showDiscardPrompt(true);
        document.getElementById("editDiscardKeep").focus();
        return;
    }

    closeModal();
}

export async function openEditFormModal(applicationFormId, { onSaved } = {}) {
    currentFormId = applicationFormId;
    onSavedCallback = onSaved || null;

    idLabel.textContent = applicationFormId;
    subtitle.textContent = "";
    showStatus(`<p class="modal-loading">Carregando informações...</p>`);
    showDiscardPrompt(false);
    overlay.hidden = false;
    syncBodyScrollLock();

    try {
        const response = await fetchWithAuth(`/entrevista-adesao/application-forms/${applicationFormId}/details`);

        if (!response.ok) {
            throw new Error(await getErrorMessage(response, "Erro ao carregar as informações do formulário"));
        }

        const details = await response.json();

        // o usuário pode ter fechado (ou aberto outra ficha) enquanto a requisição corria
        if (currentFormId !== applicationFormId) return;

        field("beneficiary_birth_date").max = getLocalToday();

        renderContext(details.form);
        fillForm(details.form, details.responsibles);

        statusBox.hidden = true;
        body.hidden = false;
        sectionNav.hidden = false;
        footer.hidden = false;
        body.scrollTop = 0;

        initialSnapshot = JSON.stringify(buildPayload());
        updateDirtyState();
        updateActiveNavLink();
    } catch (error) {
        showStatus(`<p class="modal-error">${escapeHtml(error.message || "Erro ao carregar as informações do formulário")}</p>`);
        notyf.error(error.message || "Houve um erro ao carregar as informações do formulário");
    }
}

/* ============================================================
   Envio
   ============================================================ */

// um único aviso por tentativa de envio, rolando até o primeiro campo em falta
let invalidNoticeShown = false;

form.addEventListener("invalid", (event) => {
    if (invalidNoticeShown) return;
    invalidNoticeShown = true;

    notyf.error("Preencha todos os campos obrigatórios antes de salvar.");
    event.target.scrollIntoView({ behavior: "smooth", block: "center" });

    setTimeout(() => {
        invalidNoticeShown = false;
    }, 0);
}, true); // captura, pois o evento "invalid" não borbulha

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (isSaving || !currentFormId) return;

    isSaving = true;
    setSubmitLoading(saveButton, true, "Salvando...");

    try {
        const response = await fetchWithAuth(`/entrevista-adesao/application-forms/${currentFormId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(buildPayload()),
        });

        if (!response.ok) {
            throw new Error(await getErrorMessage(response, "Erro ao salvar as alterações"));
        }

        notyf.success("Formulário atualizado com sucesso");

        const onSaved = onSavedCallback;
        isSaving = false;
        closeModal();
        if (onSaved) onSaved();
    } catch (error) {
        notyf.error(error.message || "Houve um erro ao salvar as alterações");
    } finally {
        isSaving = false;
        setSubmitLoading(saveButton, false);
        // setSubmitLoading reabilita o botão; ele só fica ativo se ainda houver alteração
        if (!overlay.hidden) updateDirtyState();
    }
});

/* ============================================================
   Eventos de fechamento
   ============================================================ */

document.getElementById("editFormModalClose").addEventListener("click", requestClose);
document.getElementById("editFormCancel").addEventListener("click", requestClose);
document.getElementById("editDiscardKeep").addEventListener("click", () => {
    showDiscardPrompt(false);
    saveButton.focus();
});
document.getElementById("editDiscardConfirm").addEventListener("click", closeModal);

bindOverlayDismiss(overlay, requestClose);
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !overlay.hidden) requestClose();
});
