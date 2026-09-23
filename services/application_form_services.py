from database.connect_db import get_db_connection
from models.application_form_models import ApplicationFormModel, ApplicationForm
from models.inclusion_responsibles import InclusionResponsiblesModel, InclusionResponsibles
from models.application_forms_approvals import ApplicationFormApprovalModel
from models.application_form_interviews import ApplicationFormInterviewModel
from models.qualify_interview import QualifyInterviewModel
from models.application_form_management import ApplicationFormManagementModel
from models.application_form_documents import ApplicationFormDocumentModel
from models.application_form_reanalysis_request import ApplicationFormReanalysisRequestModel
from services.application_form_documents_services import ApplicationFormDocumentService
from utils.exceptions import AppError, ConflictError, ForbiddenError, NotFoundError, ValidationError
from utils.validations import to_id

class ApplicationFormService:
    # GET de todos cadastrados no sistema, opcionalmente filtrados pelo colaborador
    def get_all(consultant_id=None, financial_reviewer_id=None):
        try:
            application_forms = ApplicationFormModel.get_all(consultant_id, financial_reviewer_id)

            return application_forms
        except Exception as e:
            raise Exception(str(e))

    # Garante que o usuário logado pode acessar uma ficha específica: diretoria e administradores
    # acessam todas, vendas só as que lançou e o financeiro só as que analisou por último
    def check_access(application_form_id, user):
        try:
            role_name = (user.get("role_name") or "").lower()

            if role_name in ("administrator", "director"):
                return True

            application_form = ApplicationFormModel.get_by_id(application_form_id)

            if not application_form:
                raise NotFoundError("Formulário não encontrado")

            if role_name == "sales_employee" and application_form.consultant_id == user.get("id"):
                return True

            if role_name == "finance_employee":
                approval = ApplicationFormApprovalModel.get_by_application_form_id(application_form_id)

                if approval and approval.financial_reviewer_id == user.get("id"):
                    return True

            raise ForbiddenError("Você não tem permissão para acessar este formulário")
        except AppError:
            raise
        except Exception as e:
            raise Exception(str(e))

    # GET agregado com TODOS os dados de um formulário. Usado para a tela de visualização geral
    def get_full_details(application_form_id):
        try:
            application_form = ApplicationFormModel.get_by_id(application_form_id)

            if not application_form:
                raise NotFoundError("Formulário não encontrado")

            responsibles = InclusionResponsiblesModel.get_by_application_form_id(application_form_id)
            approval = ApplicationFormApprovalModel.get_by_application_form_id(application_form_id)
            interview = ApplicationFormInterviewModel.get_by_application_form_id(application_form_id)
            management = ApplicationFormManagementModel.get_by_application_form_id(application_form_id)
            reanalysis_requests = ApplicationFormReanalysisRequestModel.get_by_application_form_id(application_form_id)
            documents = ApplicationFormDocumentModel.get_by_application_form_id(application_form_id)

            # a entrevista qualificada pende da entrevista, não da ficha: só existe se a
            # entrevista já foi analisada (as duas são gravadas na mesma transação)
            qualify_interview = (
                QualifyInterviewModel.get_by_application_form_interview_id(interview.id)
                if interview else None
            )

            return {
                "form": application_form.to_dict(),
                "responsibles": [responsible.to_dict() for responsible in responsibles],
                "approval": approval.to_dict() if approval else None,
                "interview": interview.to_dict() if interview else None,
                "qualify_interview": qualify_interview.to_dict() if qualify_interview else None,
                "management": management.to_dict() if management else None,
                "reanalysis_requests": [
                    reanalysis_request.to_dict()
                    for reanalysis_request in reanalysis_requests
                ],
                "documents": [document.to_dict() for document in documents],
            }
        except AppError:
            raise
        except Exception as e:
            raise Exception(str(e))
    
    # GET por status, opcionalmente filtrados pelo colaborador
    def get_by_status(status_id, consultant_id=None, financial_reviewer_id=None):
        try:
            application_forms = ApplicationFormModel.get_by_status(status_id, consultant_id, financial_reviewer_id)

            return application_forms
        except Exception as e:
            raise Exception(str(e))

    # GET das fichas aguardando aprovação da gerência (status 4) juntamente com as entrevistas qualificadas
    def get_pending_management_approval(consultant_id=None):
        try:
            application_forms = ApplicationFormModel.get_by_status(4, consultant_id)

            qualify_by_form_id = QualifyInterviewModel.get_by_application_form_ids(
                [application_form.id for application_form in application_forms]
            )

            return [
                {
                    "form": application_form.to_dict(),
                    "qualify_interview": qualify_by_form_id.get(application_form.id),
                }
                for application_form in application_forms
            ]
        except Exception as e:
            raise Exception(str(e))

    # Monta e valida os campos EDITÁVEIS da ficha a partir dos dados recebidos.
    # Compartilhado entre o cadastro e a edição, para que uma regra nova de campo valha nos dois.
    # Status, consultor, tipo de beneficiário e datas de controle ficam de fora de propósito.
    @staticmethod
    def _build_form_fields(form_data):
        # discount_percentage é salvo como fração (ex: 50% -> 0.50) para caber em numeric(3, 2)
        discount_percentage = form_data.get("discount_percentage")
        if discount_percentage not in (None, ""):
            discount_percentage = float(discount_percentage) / 100

        # validação para garantir que quando for troca de plano chegar a data do cancelamento do plano anterior
        if form_data.get("inclusion_type") == "Troca de Plano" and not form_data.get("previous_plan_cancellation_date"):
            raise ValidationError("Informe a data do cancelamento do plano anterior")

        return {
            "inclusion_type": form_data.get("inclusion_type"),
            "cnpj": form_data.get("cnpj"),
            "previous_plan": form_data.get("previous_plan"),
            "previous_plan_cancellation_date": form_data.get("previous_plan_cancellation_date") or None,
            "inclusion_date": form_data.get("inclusion_date"),
            "contract_type": form_data.get("contract_type"),
            "plan_type": form_data.get("plan_type"),
            "model_proposal": form_data.get("model_proposal") or None,
            "expiration_month": form_data.get("expiration_month"),
            "is_pa_digital": form_data.get("is_pa_digital"),
            "is_aeromedic": form_data.get("is_aeromedic"),
            "is_discount": form_data.get("is_discount"),
            "discount_percentage": discount_percentage,
            "discount_observation": form_data.get("discount_observation"),
            "beneficiary_name": form_data.get("beneficiary_name"),
            "beneficiary_cpf": form_data.get("beneficiary_cpf"),
            "beneficiary_birth_date": form_data.get("beneficiary_birth_date"),
            "beneficiary_phone": form_data.get("beneficiary_phone"),
            "beneficiary_email": form_data.get("beneficiary_email"),
            "beneficiary_marital_state": form_data.get("beneficiary_marital_state"),
            "billing_email": form_data.get("billing_email"),
            "secondary_beneficiary_primary_name": form_data.get("secondary_beneficiary_primary_name"),
            "secondary_beneficiary_kinship": form_data.get("secondary_beneficiary_kinship"),
            "is_portability": form_data.get("is_portability"),
            "portability_accepted": form_data.get("portability_accepted"),
            "portability_accepted_date": form_data.get("portability_accepted_date"),
            "portability_observation": form_data.get("portability_observation"),
            "grace_option": form_data.get("grace_option"),
            "especial_observations": form_data.get("especial_observations") or None,
        }

    # Monta os responsáveis pela inclusão a partir dos dados recebidos (cadastro e edição)
    @staticmethod
    def _build_responsibles(responsibles_data, application_form_id=None):
        return [
            InclusionResponsibles(
                name=responsible.get("name"),
                cpf=responsible.get("cpf"),
                marital_state=responsible.get("marital_state"),
                profession=responsible.get("profession"),
                application_form_id=application_form_id,
            )
            for responsible in responsibles_data
        ]

    # POST ATÔMICO: cria o formulário, seus responsáveis pela inclusão e os documentos
    # anexados numa única transação (tudo ou nada). Os arquivos são gravados em disco e,
    # se qualquer insert falhar, é feito rollback do banco E os arquivos salvos são removidos,
    # evitando o cadastro de um registro sem os demais obrigatórios.
    def create_complete(form_data, responsibles_data, files):
        conn = None
        cursor = None
        saved_paths = []
        try:
            responsibles_data = responsibles_data or []
            files = files or []

            if not responsibles_data:
                raise ValidationError("É necessário informar ao menos um responsável pela inclusão")

            if not files:
                raise ValidationError("É necessário anexar ao menos um documento")

            # validação para garantir que o status que chegar do formulário vai ser 1
            form_status_id = form_data.get("form_status_id")
            if form_status_id != "1":
                raise ValidationError("O status do formulário está incorreto. Entre em contato com o suporte.")

            new_application_form = ApplicationForm(
                beneficiary_type=form_data.get("beneficiary_type"),
                consultant_id=form_data.get("consultant_id"),
                form_status_id=form_status_id,
                form_status_name=form_data.get("form_status_name"),
                **ApplicationFormService._build_form_fields(form_data),
            )

            new_responsibles = ApplicationFormService._build_responsibles(responsibles_data)

            conn, cursor = get_db_connection()

            # 1. ficha (gera o id usado pelos demais registros)
            ApplicationFormModel.insert_form(cursor, new_application_form)

            # 2. responsáveis pela inclusão
            for responsible in new_responsibles:
                responsible.application_form_id = new_application_form.id
                InclusionResponsiblesModel.insert(cursor, responsible)

            # 3. documentos: grava os arquivos em disco e insere os registros na mesma transação
            new_documents, saved_paths = ApplicationFormDocumentService.save_files(
                new_application_form.id, new_application_form.beneficiary_name, files
            )
            for document in new_documents:
                ApplicationFormDocumentModel.insert(cursor, document)

            conn.commit()

            return new_application_form, new_responsibles, new_documents
        except AppError:
            if conn:
                conn.rollback()
            ApplicationFormDocumentService.delete_files(saved_paths)
            raise
        except Exception as e:
            if conn:
                conn.rollback()
            ApplicationFormDocumentService.delete_files(saved_paths)
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    # PUT ATÔMICO: edita os campos editáveis da ficha e substitui os responsáveis pela inclusão
    # numa única transação (tudo ou nada). Status, consultor, tipo de beneficiário e datas de
    # controle não são lidos do corpo, então nunca são alterados por aqui.
    def update_complete(application_form_id, form_data, responsibles_data):
        conn = None
        cursor = None
        try:
            application_form_id = to_id(application_form_id, "formulário")
            form_data = form_data or {}
            responsibles_data = responsibles_data or []

            if not responsibles_data:
                raise ValidationError("É necessário informar ao menos um responsável pela inclusão")

            # valida tudo antes de abrir a transação
            fields = ApplicationFormService._build_form_fields(form_data)
            new_responsibles = ApplicationFormService._build_responsibles(responsibles_data, application_form_id)

            conn, cursor = get_db_connection()

            # trava a ficha até o fim da transação, para o status não mudar entre a checagem e o update
            application_form = ApplicationFormModel.lock_for_update(cursor, application_form_id)

            if not application_form:
                raise NotFoundError("Formulário não encontrado")

            # 6. Finalizado, 8/10/12. Negociação Encerrada
            if application_form["form_status_id"] in (6, 8, 10, 12):
                raise ConflictError("Não é possível editar formulários finalizados ou com negociação encerrada")

            # 1. ficha
            ApplicationFormModel.update_form(cursor, application_form_id, fields)

            # 2. responsáveis: apaga os atuais e insere a lista recebida
            InclusionResponsiblesModel.delete_by_application_form_id(cursor, application_form_id)
            for responsible in new_responsibles:
                InclusionResponsiblesModel.insert(cursor, responsible)

            conn.commit()

            updated_application_form = ApplicationFormModel.get_by_id(application_form_id)

            return updated_application_form, new_responsibles
        except AppError:
            if conn:
                conn.rollback()
            raise
        except Exception as e:
            if conn:
                conn.rollback()
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    # UPDATE do campo de status do formulário
    def update_status(new_status_id, data):
        try:
            ApplicationFormModel.update_status(new_status_id, data['application_form_id'])

            return True
        except Exception as e:
            raise Exception(str(e))

    # Solicita reanálise financeira de uma ficha reprovada (volta o status para 1)
    def request_reanalysis(application_form_id):
        try:
            application_form = ApplicationFormModel.get_by_id(application_form_id)

            if not application_form:
                raise NotFoundError("Ficha não encontrada")

            if application_form.form_status_id != 7:
                raise ConflictError("Só é possível solicitar reanálise de fichas reprovadas pelo financeiro")

            ApplicationFormModel.update_status(1, application_form_id)

            return True
        except AppError:
            raise
        except Exception as e:
            raise Exception(str(e))

    # Encerra a negociação de uma ficha reprovada pelo financeiro (soft delete, status 8)
    def close_negotiation(application_form_id):
        try:
            application_form = ApplicationFormModel.get_by_id(application_form_id)

            if not application_form:
                raise NotFoundError("Ficha não encontrada")

            if application_form.form_status_id != 7:
                raise ConflictError("Só é possível encerrar a negociação de fichas reprovadas pelo financeiro")

            ApplicationFormModel.close_negotiation(application_form_id)

            return True
        except AppError:
            raise
        except Exception as e:
            raise Exception(str(e))

    # Finaliza o cadastro de um formulário que está aguardando cadastro no Backoffice. Muda de status 5 para status 6
    def finalize_registration(application_form_id):
        try:
            application_form = ApplicationFormModel.get_by_id(application_form_id)

            if not application_form:
                raise NotFoundError("Formulário não encontrado")

            if application_form.form_status_id != 5:
                raise ConflictError("Só é possível finalizar o cadastro de formulários aguardando cadastro no Backoffice")

            ApplicationFormModel.update_status(6, application_form_id)

            return True
        except AppError:
            raise
        except Exception as e:
            raise Exception(str(e))