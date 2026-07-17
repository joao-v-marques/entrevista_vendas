from models.application_form_models import ApplicationFormModel, ApplicationForm

class ApplicationFormService:
    # GET de todos cadastrados no sistema
    def get_all():
        try:
            application_forms = ApplicationFormModel.get_all()

            return application_forms
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