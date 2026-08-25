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

class ApplicationFormService:
    # GET de todos cadastrados no sistema
    def get_all():
        try:
            application_forms = ApplicationFormModel.get_all()

            return application_forms
        except Exception as e:
            raise Exception(str(e))

    # GET agregado com TODOS os dados de um formulário: dados principais, responsáveis
    # pela inclusão, aprovação financeira, entrevista, aprovação da gerência, solicitações de
    # reanálise e documentos.
    # Usado pela tela de visualização (modal), servindo de base para o cadastro no outro sistema.
    def get_full_details(application_form_id):
        try:
            application_form = ApplicationFormModel.get_by_id(application_form_id)

            if not application_form:
                raise ValueError("Formulário não encontrado")

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
        except ValueError:
            raise
        except Exception as e:
            raise Exception(str(e))
    
    # GET por status
    def get_by_status(status_id):
        try:
            application_forms = ApplicationFormModel.get_by_status(status_id)

            return application_forms
        except Exception as e:
            raise Exception(str(e))

    # POST de um application form no sistema
    def create_form(data):
        try:
            # VALIDAÇÕES AQUI

            # discount_percentage é salvo como fração (ex: 50% -> 0.50) para caber em numeric(3, 2)
            discount_percentage = data.get("discount_percentage")
            if discount_percentage not in (None, ""):
                discount_percentage = float(discount_percentage) / 100

            new_application_form = ApplicationForm(
                beneficiary_type=data.get("beneficiary_type"),
                consultant_id=data.get("consultant_id"),
                inclusion_type=data.get("inclusion_type"),
                cnpj=data.get("cnpj"),
                previous_plan=data.get("previous_plan"),
                inclusion_date=data.get("inclusion_date"),
                contract_type=data.get("contract_type"),
                plan_type=data.get("plan_type"),
                model_proposal=data.get("model_proposal"),
                expiration_month=data.get("expiration_month"),
                is_pa_digital=data.get("is_pa_digital"),
                is_aeromedic=data.get("is_aeromedic"),
                is_discount=data.get("is_discount"),
                discount_percentage=discount_percentage,
                discount_observation=data.get("discount_observation"),
                beneficiary_name=data.get("beneficiary_name"),
                beneficiary_cpf=data.get("beneficiary_cpf"),
                beneficiary_birth_date=data.get("beneficiary_birth_date"),
                beneficiary_phone=data.get("beneficiary_phone"),
                beneficiary_email=data.get("beneficiary_email"),
                beneficiary_marital_state=data.get("beneficiary_marital_state"),
                billing_email=data.get("billing_email"),
                secondary_beneficiary_primary_name=data.get("secondary_beneficiary_primary_name"),
                secondary_beneficiary_kinship=data.get("secondary_beneficiary_kinship"),
                is_portability=data.get("is_portability"),
                portability_accepted=data.get("portability_accepted"),
                portability_accepted_date=data.get("portability_accepted_date"),
                portability_observation=data.get("portability_observation"),
                grace_option=data.get("grace_option"),
                especial_observations=data.get("especial_observations"),
                form_status_id=data.get("form_status_id"),
                form_status_name=data.get("form_status_name"),
            )

            created_application_form = ApplicationFormModel.create_form(new_application_form)

            return created_application_form
        except Exception as e:
            raise Exception(str(e))

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
                raise ValueError("É necessário informar ao menos um responsável pela inclusão")

            if not files:
                raise ValueError("É necessário anexar ao menos um documento")

            # discount_percentage é salvo como fração (ex: 50% -> 0.50) para caber em numeric(3, 2)
            discount_percentage = form_data.get("discount_percentage")
            if discount_percentage not in (None, ""):
                discount_percentage = float(discount_percentage) / 100

            new_application_form = ApplicationForm(
                beneficiary_type=form_data.get("beneficiary_type"),
                consultant_id=form_data.get("consultant_id"),
                inclusion_type=form_data.get("inclusion_type"),
                cnpj=form_data.get("cnpj"),
                previous_plan=form_data.get("previous_plan"),
                inclusion_date=form_data.get("inclusion_date"),
                contract_type=form_data.get("contract_type"),
                plan_type=form_data.get("plan_type"),
                model_proposal=form_data.get("model_proposal"),
                expiration_month=form_data.get("expiration_month"),
                is_pa_digital=form_data.get("is_pa_digital"),
                is_aeromedic=form_data.get("is_aeromedic"),
                is_discount=form_data.get("is_discount"),
                discount_percentage=discount_percentage,
                discount_observation=form_data.get("discount_observation"),
                beneficiary_name=form_data.get("beneficiary_name"),
                beneficiary_cpf=form_data.get("beneficiary_cpf"),
                beneficiary_birth_date=form_data.get("beneficiary_birth_date"),
                beneficiary_phone=form_data.get("beneficiary_phone"),
                beneficiary_email=form_data.get("beneficiary_email"),
                beneficiary_marital_state=form_data.get("beneficiary_marital_state"),
                billing_email=form_data.get("billing_email"),
                secondary_beneficiary_primary_name=form_data.get("secondary_beneficiary_primary_name"),
                secondary_beneficiary_kinship=form_data.get("secondary_beneficiary_kinship"),
                is_portability=form_data.get("is_portability"),
                portability_accepted=form_data.get("portability_accepted"),
                portability_accepted_date=form_data.get("portability_accepted_date"),
                portability_observation=form_data.get("portability_observation"),
                grace_option=form_data.get("grace_option"),
                especial_observations=form_data.get("especial_observations"),
                form_status_id=form_data.get("form_status_id"),
                form_status_name=form_data.get("form_status_name"),
            )

            new_responsibles = [
                InclusionResponsibles(
                    name=responsible.get("name"),
                    cpf=responsible.get("cpf"),
                    marital_state=responsible.get("marital_state"),
                    profession=responsible.get("profession"),
                    application_form_id=None,
                )
                for responsible in responsibles_data
            ]

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
        except ValueError:
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
                raise ValueError("Ficha não encontrada")

            if application_form.form_status_id != 7:
                raise ValueError("Só é possível solicitar reanálise de fichas reprovadas pelo financeiro")

            ApplicationFormModel.update_status(1, application_form_id)

            return True
        except Exception as e:
            raise Exception(str(e))

    # Encerra a negociação de uma ficha reprovada pelo financeiro (soft delete, status 8)
    def close_negotiation(application_form_id):
        try:
            application_form = ApplicationFormModel.get_by_id(application_form_id)

            if not application_form:
                raise ValueError("Ficha não encontrada")

            if application_form.form_status_id != 7:
                raise ValueError("Só é possível encerrar a negociação de fichas reprovadas pelo financeiro")

            ApplicationFormModel.close_negotiation(application_form_id)

            return True
        except Exception as e:
            raise Exception(str(e))

    # Finaliza o cadastro de um formulário que está aguardando cadastro no Backoffice
    # (status 5), movendo-o para o status 6. Finalizado
    def finalize_registration(application_form_id):
        try:
            application_form = ApplicationFormModel.get_by_id(application_form_id)

            if not application_form:
                raise ValueError("Formulário não encontrado")

            if application_form.form_status_id != 5:
                raise ValueError("Só é possível finalizar o cadastro de formulários aguardando cadastro no Backoffice")

            ApplicationFormModel.update_status(6, application_form_id)

            return True
        except ValueError:
            raise
        except Exception as e:
            raise Exception(str(e))