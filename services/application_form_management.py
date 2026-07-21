from models.application_form_management import ApplicationFormManagementModel, ApplicationFormManagement
from models.application_form_models import ApplicationFormModel

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

    # Solicita reanálise de uma ficha reprovada pela gerência (volta o status para 4)
    def request_reanalysis(application_form_id):
        try:
            application_form = ApplicationFormModel.get_by_id(application_form_id)

            if not application_form:
                raise ValueError("Ficha não encontrada")

            if application_form.form_status_id != 11:
                raise ValueError("Só é possível solicitar reanálise de fichas reprovadas pela gerência")

            ApplicationFormModel.update_status(4, application_form_id)

            return True
        except Exception as e:
            raise Exception(str(e))

    # Encerra a negociação de uma ficha reprovada pela gerência (soft delete, status 12)
    def close_negotiation(application_form_id):
        try:
            application_form = ApplicationFormModel.get_by_id(application_form_id)

            if not application_form:
                raise ValueError("Ficha não encontrada")

            if application_form.form_status_id != 11:
                raise ValueError("Só é possível encerrar a negociação de fichas reprovadas pela gerência")

            ApplicationFormModel.close_management_negotiation(application_form_id)

            return True
        except Exception as e:
            raise Exception(str(e))
