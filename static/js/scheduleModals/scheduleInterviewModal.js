import { renderBeneficiaryInfo } from "../approveModals/beneficiaryInfoView.js";
import { fetchWithAuth } from "../utils/apiHelper.js";
import { populateScheduleInterviewTable } from "../schedule_interview.js";
import { getFormSubmitButton, setSubmitLoading } from "../utils/submitLoading.js";
import { bindOverlayDismiss } from "../utils/modalOverlay.js";

const overlay = document.getElementById("scheduleInterviewModalOverlay");
const formIdLabel = document.getElementById("scheduleModalFormId");
const beneficiaryInfoGrid = document.getElementById("scheduleBeneficiaryInfoGrid");
const scheduleInterviewForm = document.getElementById("scheduleInterviewForm");
const closeButton = document.getElementById("scheduleModalClose");
const cancelButton = document.getElementById("scheduleModalCancel");
const applicationFormIdInput = document.getElementById("schedule_application_form_id");
const interviewDateInput = document.getElementById("interview_date");
const interviewDatePicker = flatpickr(interviewDateInput, {
    locale: "pt",
    enableTime: true,
    time_24hr: true,
    minuteIncrement: 15,
    minDate: "today",
    dateFormat: "Y-m-d\\TH:i",
    altInput: true,
    altFormat: "d/m/Y - H:i",
    altInputClass: "input schedule-date-picker",
    allowInput: false,
    disableMobile: true,
});

// O Flatpickr preserva o valor tecnico em um campo oculto e cria o campo visual.
// Replicamos o required para que o navegador continue impedindo envio sem selecao.
interviewDatePicker.altInput.required = true;

function closeModal() {
    overlay.hidden = true;
}

export function openScheduleInterviewModal(applicationForm) {
    formIdLabel.textContent = applicationForm.id;
    renderBeneficiaryInfo(beneficiaryInfoGrid, applicationForm);
    scheduleInterviewForm.reset();
    interviewDatePicker.clear();
    interviewDatePicker.set("minDate", new Date());

    // preenche o campo oculto que vai junto no envio pro backend
    applicationFormIdInput.value = applicationForm.id;

    overlay.hidden = false;
}

function submitForm() {
    const submitButton = getFormSubmitButton(scheduleInterviewForm);
    scheduleInterviewForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        // pega os dados do formulário
        const formData = new FormData(scheduleInterviewForm);

        // validação para remover espaços no inicio e final da string
        for (let [key, value] of formData.entries()) {
            if (typeof value === "string") {
                formData.set(key, value.trim());
            }
        }

        // monta o payload
        const data = Object.fromEntries(formData.entries());

        // COLOCAR VALIDAÇÕES DE REQUIRED FIELDS NO FUTURO

        setSubmitLoading(submitButton, true, "Agendando...");
        try {
            const response = await fetchWithAuth("/entrevista-adesao/application-form-interviews", {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                let errorMessage = "Houve um erro ao tentar agendar a entrevista";

                try {
                    const errorJSON = await response.json();

                    if (errorJSON?.message) {
                        errorMessage = errorJSON.message;
                    }

                    throw new Error(errorMessage);
                } catch (error) {
                    if (error instanceof SyntaxError) {
                        // resposta não é JSON, tenta ler como texto
                        errorMessage = `Erro ${response.status}: Falha ao agendar a entrevista`;
                    } else {
                        errorMessage = error.message;
                    }
                }

                throw new Error(errorMessage);
            }

            scheduleInterviewForm.reset();

            closeModal();
            notyf.success("Entrevista agendada com sucesso!");
            await populateScheduleInterviewTable();

        } catch (error) {
            notyf.error(error.message)
        } finally {
            setSubmitLoading(submitButton, false);
        }
    });
}

closeButton.addEventListener("click", closeModal);
cancelButton.addEventListener("click", closeModal);
bindOverlayDismiss(overlay, closeModal);
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !overlay.hidden) closeModal();
});

document.addEventListener("DOMContentLoaded", () => {
    submitForm();
})
