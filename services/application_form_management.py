from models.application_form_management import ApplicationFormManagementModel, ApplicationFormManagement
from models.application_form_models import ApplicationFormModel
from models.application_form_reanalysis_request import ApplicationFormReanalysisRequestModel, ApplicationFormReanalysisRequest
from services.application_form_documents_services import ApplicationFormDocumentService
from utils.exceptions import AppError, ConflictError, NotFoundError, ValidationError

class ApplicationFormManagementService:
    def get_all():
        try:
            management_forms = ApplicationFormManagementModel.get_all()

            return management_forms
        except Exception as e:
            raise Exception(str(e))

    def create(data):
        try:
            # ! COLOCAR VALIDAÇÕES NOS CAMPOS AQUI

            management_form = ApplicationFormManagement(
                manager_id=data['manager_id'],
                management_approved=data['management_approved'],
                management_observation=data['management_observation'],
                management_reviewed_at=data['management_reviewed_at'],
                application_form_id=data['application_form_id']
            )

            created_management_form = ApplicationFormManagementModel.create(management_form)

            return created_management_form
        except Exception as e:
            raise Exception(str(e))

    # Solicita reanálise de uma ficha reprovada pela gerência: registra a solicitação com a
    # observação, anexa os laudos médicos (opcional) e volta o status para 4.
    def request_reanalysis(application_form_id, requester_id, reanalysis_observation, files):
        try:
            application_form = ApplicationFormModel.get_by_id(application_form_id)

            if not application_form:
                raise NotFoundError("Ficha não encontrada")

            if application_form.form_status_id != 11:
                raise ConflictError("Só é possível solicitar reanálise de fichas reprovadas pela gerência")

            if not requester_id:
                raise ValidationError("Não foi possível identificar o usuário que está solicitando a reanálise")

            observation = (reanalysis_observation or "").strip()

            if not observation:
                raise ValidationError("A observação da reanálise é obrigatória")

            # o laudo é opcional: só grava arquivos se algum foi realmente enviado
            valid_files = ApplicationFormDocumentService.validate_files(files)

            documents = []
            saved_paths = []

            if valid_files:
                documents, saved_paths = ApplicationFormDocumentService.save_files(
                    application_form_id, application_form.beneficiary_name, valid_files
                )

                for document in documents:
                    document.document_type = "laudo_medico"

            reanalysis_request = ApplicationFormReanalysisRequest(
                requester_id=requester_id,
                reanalysis_observation=observation,
                application_form_id=application_form_id
            )

            try:
                return ApplicationFormReanalysisRequestModel.create_with_documents(reanalysis_request, documents)
            except Exception:
                ApplicationFormDocumentService.delete_files(saved_paths)
                raise
        except AppError:
            raise
        except Exception as e:
            raise Exception(str(e))

    # Encerra a negociação de uma ficha reprovada pela gerência (soft delete, status 12)
    def close_negotiation(application_form_id):
        try:
            application_form = ApplicationFormModel.get_by_id(application_form_id)

            if not application_form:
                raise NotFoundError("Ficha não encontrada")

            if application_form.form_status_id != 11:
                raise ConflictError("Só é possível encerrar a negociação de fichas reprovadas pela gerência")

            ApplicationFormModel.close_management_negotiation(application_form_id)

            return True
        except AppError:
            raise
        except Exception as e:
            raise Exception(str(e))
