from models.application_form_management import ApplicationFormManagementModel, ApplicationFormManagement
from models.application_form_models import ApplicationFormModel
from models.application_form_reanalysis_request import ApplicationFormReanalysisRequestModel, ApplicationFormReanalysisRequest
from models.users_models import UserModel
from services.application_form_documents_services import ApplicationFormDocumentService
from utils.validations import to_id, to_bool
from utils.exceptions import AppError, ConflictError, NotFoundError, ValidationError

# a ficha só pode receber o parecer da gerência enquanto estiver aguardando essa etapa
STATUS_AGUARDANDO_APROVACAO_GERENCIA = 4

class ApplicationFormManagementService:
    def get_all():
        try:
            management_forms = ApplicationFormManagementModel.get_all()

            return management_forms
        except Exception as e:
            raise Exception(str(e))

    def create(data):
        try:
            # Validação caso receba o payload vazio (Apenas para a API)
            if not data:
                raise ValidationError("Nenhum dado foi recebido para a análise da gerência")

            application_form_id = to_id(data.get('application_form_id'), "formulário")

            application_form = ApplicationFormModel.get_by_id(application_form_id)

            if not application_form:
                raise NotFoundError("Ficha não encontrada")

            # não checamos se a ficha já tem parecer: a reanálise devolve a ficha para o status 4
            # e gera um segundo parecer. O status é o que impede o envio duplicado.
            if application_form.form_status_id != STATUS_AGUARDANDO_APROVACAO_GERENCIA:
                raise ConflictError("Só é possível analisar fichas aguardando aprovação da gerência")

            if data.get('management_approved') is None:
                raise ValidationError("O campo management_approved é obrigatório")

            management_approved = to_bool(data['management_approved'])

            manager_id = to_id(data.get('manager_id'), "gerente")

            if not UserModel.get_by_id(manager_id):
                raise ValidationError("O gerente informado não existe")

            management_reviewed_at = data.get('management_reviewed_at')

            if not str(management_reviewed_at or "").strip():
                raise ValidationError("A data de análise da gerência é obrigatória")

            management_observation = str(data.get('management_observation') or "").strip()

            # a observação registra o motivo da decisão, tanto na aprovação quanto na reprovação
            if not management_observation:
                raise ValidationError("A observação da análise da gerência é obrigatória")

            management_form = ApplicationFormManagement(
                manager_id=manager_id,
                management_approved=management_approved,
                management_observation=management_observation,
                management_reviewed_at=management_reviewed_at,
                application_form_id=application_form_id
            )

            created_management_form = ApplicationFormManagementModel.create(management_form)

            return created_management_form
        except AppError:
            raise
        except Exception as e:
            raise Exception(str(e))

    # Solicita reanálise de uma ficha reprovada pela gerência, retorna para o status 4.
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
                application_form_id=application_form_id,
                stage="management"
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
