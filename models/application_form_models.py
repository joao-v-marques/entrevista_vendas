from database.connect_db import get_db_connection

class ApplicationForm:
    def __init__(self, beneficiary_type, inclusion_type, inclusion_date, contract_type, plan_type, model_proposal, expiration_month, is_pa_digital, is_aeromedic, is_discount, beneficiary_name, beneficiary_birth_date, beneficiary_phone, beneficiary_email, beneficiary_marital_state, billing_email, is_portability, especial_observations, form_status_id, form_status_name, created_at=None, portability_accepted=None, portability_accepted_date=None, portability_observation=None, grace_option=None, beneficiary_cpf=None, secondary_beneficiary_primary_name=None, secondary_beneficiary_kinship=None,  discount_percentage=None, discount_observation=None, consultant_id=None, consultant_name=None, id=None, cnpj=None, previous_plan=None):
        self.beneficiary_type = beneficiary_type
        self.inclusion_type = inclusion_type
        self.inclusion_date = inclusion_date
        self.contract_type = contract_type
        self.plan_type = plan_type
        self.model_proposal = model_proposal
        self.expiration_month = expiration_month
        self.is_pa_digital = is_pa_digital
        self.is_aeromedic = is_aeromedic
        self.is_discount = is_discount
        self.beneficiary_name = beneficiary_name
        self.beneficiary_cpf = beneficiary_cpf
        self.beneficiary_birth_date = beneficiary_birth_date
        self.beneficiary_phone = beneficiary_phone
        self.beneficiary_email = beneficiary_email
        self.beneficiary_marital_state = beneficiary_marital_state
        self.billing_email = billing_email
        self.is_portability = is_portability
        self.especial_observations = especial_observations
        self.form_status_id = form_status_id
        self.created_at = created_at
        self.portability_accepted = portability_accepted
        self.portability_accepted_date = portability_accepted_date
        self.portability_observation = portability_observation
        self.grace_option = grace_option
        self.secondary_beneficiary_primary_name = secondary_beneficiary_primary_name
        self.secondary_beneficiary_kinship = secondary_beneficiary_kinship
        self.discount_percentage = discount_percentage
        self.discount_observation = discount_observation
        self.consultant_id = consultant_id
        self.consultant_name = consultant_name
        self.id = id
        self.cnpj = cnpj
        self.previous_plan = previous_plan
        self.form_status_name = form_status_name

    def to_dict(self):
        return {
            "id": self.id,
            "beneficiary_type": self.beneficiary_type,
            "consultant_id": self.consultant_id,
            "consultant_name": self.consultant_name,
            "inclusion_type": self.inclusion_type,
            "cnpj": self.cnpj,
            "previous_plan": self.previous_plan,
            "inclusion_date": self.inclusion_date,
            "contract_type": self.contract_type,
            "plan_type": self.plan_type,
            "model_proposal": self.model_proposal,
            "expiration_month": self.expiration_month,
            "is_pa_digital": self.is_pa_digital,
            "is_aeromedic": self.is_aeromedic,
            "is_discount": self.is_discount,
            "discount_percentage": self.discount_percentage,
            "discount_observation": self.discount_observation,
            "beneficiary_name": self.beneficiary_name,
            "beneficiary_cpf": self.beneficiary_cpf,
            "beneficiary_birth_date": self.beneficiary_birth_date,
            "beneficiary_phone": self.beneficiary_phone,
            "beneficiary_email": self.beneficiary_email,
            "beneficiary_marital_state": self.beneficiary_marital_state,
            "billing_email": self.billing_email,
            "secondary_beneficiary_primary_name": self.secondary_beneficiary_primary_name,
            "secondary_beneficiary_kinship": self.secondary_beneficiary_kinship,
            "is_portability": self.is_portability,
            "portability_accepted": self.portability_accepted,
            "portability_accepted_date": self.portability_accepted_date,
            "portability_observation": self.portability_observation,
            "grace_option": self.grace_option,
            "especial_observations": self.especial_observations,
            "created_at": self.created_at,
            "form_status_id": self.form_status_id,
            "form_status_name": self.form_status_name,
        }
    
class ApplicationFormModel:
    # GET de todos os forms do sistema
    @staticmethod
    def get_all():
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                SELECT 
                    af.id,
                    af.beneficiary_type,
                    af.consultant_id,
                    u.name AS consultant_name,
                    af.inclusion_type,
                    af.cnpj,
                    af.previous_plan,
                    af.inclusion_date,
                    af.contract_type,
                    af.plan_type,
                    af.model_proposal,
                    af.expiration_month,
                    af.is_pa_digital,
                    af.is_aeromedic,
                    af.is_discount,
                    af.discount_percentage,
                    af.discount_observation,
                    af.beneficiary_name,
                    af.beneficiary_cpf,
                    af.beneficiary_birth_date,
                    af.beneficiary_phone,
                    af.beneficiary_email,
                    af.beneficiary_marital_state,
                    af.billing_email,
                    af.secondary_beneficiary_primary_name,
                    af.secondary_beneficiary_kinship,
                    af.is_portability,
                    af.portability_accepted,
                    af.portability_accepted_date,
                    af.portability_observation,
                    af.grace_option,
                    af.especial_observations,
                    af.created_at,
                    af.form_status_id,
                    fs.name AS form_status_name
                FROM application_forms af
                INNER JOIN users u ON u.id = af.consultant_id
                INNER JOIN form_status fs ON fs.id = af.form_status_id
            """

            cursor.execute(sql_query)
            application_forms_data = cursor.fetchall()

            application_forms = [
                ApplicationForm(**application_form)
                for application_form in application_forms_data
            ]

            return application_forms
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()
    
    # GET de todos os forms cadastrados no sistema pelo status
    @staticmethod
    def get_by_status(status_id):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                SELECT 
                    af.id,
                    af.beneficiary_type,
                    af.consultant_id,
                    u.name AS consultant_name,
                    af.inclusion_type,
                    af.cnpj,
                    af.previous_plan,
                    af.inclusion_date,
                    af.contract_type,
                    af.plan_type,
                    af.model_proposal,
                    af.expiration_month,
                    af.is_pa_digital,
                    af.is_aeromedic,
                    af.is_discount,
                    af.discount_percentage,
                    af.discount_observation,
                    af.beneficiary_name,
                    af.beneficiary_cpf,
                    af.beneficiary_birth_date,
                    af.beneficiary_phone,
                    af.beneficiary_email,
                    af.beneficiary_marital_state,
                    af.billing_email,
                    af.secondary_beneficiary_primary_name,
                    af.secondary_beneficiary_kinship,
                    af.is_portability,
                    af.portability_accepted,
                    af.portability_accepted_date,
                    af.portability_observation,
                    af.grace_option,
                    af.especial_observations,
                    af.created_at,
                    af.form_status_id,
                    fs.name AS form_status_name
                FROM application_forms af
                INNER JOIN users u ON u.id = af.consultant_id
                INNER JOIN form_status fs ON fs.id = af.form_status_id
                WHERE af.form_status_id = %s
            """
            values = (status_id,)

            cursor.execute(sql_query, values)
            application_forms_data = cursor.fetchall()

            application_forms = [
                ApplicationForm(**application_form)
                for application_form in application_forms_data
            ]

            return application_forms
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    # POST de um form no sistema
    @staticmethod
    def create_form(application_form):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                INSERT INTO application_forms (
                    beneficiary_type, consultant_id, inclusion_type, cnpj, previous_plan,
                    inclusion_date, contract_type, plan_type, model_proposal, expiration_month,
                    is_pa_digital, is_aeromedic, is_discount, discount_percentage, discount_observation,
                    beneficiary_name, beneficiary_cpf, beneficiary_birth_date, beneficiary_phone, beneficiary_email,
                    beneficiary_marital_state, billing_email,
                    secondary_beneficiary_primary_name, secondary_beneficiary_kinship,
                    is_portability, portability_accepted, portability_accepted_date, portability_observation,
                    grace_option, especial_observations, form_status_id
                ) VALUES (
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s,
                    %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s
                )
                RETURNING id
            """
            values = (
                application_form.beneficiary_type, application_form.consultant_id, application_form.inclusion_type, application_form.cnpj, application_form.previous_plan,
                application_form.inclusion_date, application_form.contract_type, application_form.plan_type, application_form.model_proposal, application_form.expiration_month,
                application_form.is_pa_digital, application_form.is_aeromedic, application_form.is_discount, application_form.discount_percentage, application_form.discount_observation,
                application_form.beneficiary_name, application_form.beneficiary_cpf, application_form.beneficiary_birth_date, application_form.beneficiary_phone, application_form.beneficiary_email,
                application_form.beneficiary_marital_state, application_form.billing_email,
                application_form.secondary_beneficiary_primary_name, application_form.secondary_beneficiary_kinship,
                application_form.is_portability, application_form.portability_accepted, application_form.portability_accepted_date, application_form.portability_observation,
                application_form.grace_option, application_form.especial_observations, application_form.form_status_id,
            )

            cursor.execute(sql_query, values)
            new_id = cursor.fetchone()["id"]
            conn.commit()

            application_form.id = new_id
            return application_form
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    # GET apenas do nome do beneficiário, usado para montar a pasta de upload dos documentos
    @staticmethod
    def get_beneficiary_name(application_form_id):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                SELECT beneficiary_name
                FROM application_forms
                WHERE id = %s
            """
            values = (application_form_id,)

            cursor.execute(sql_query, values)
            application_form_data = cursor.fetchone()

            if not application_form_data:
                return None

            return application_form_data["beneficiary_name"]
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    # UPDATE do campo de status do formulário
    def update_status(new_status_id, application_form_id):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                UPDATE application_forms
                SET form_status_id = %s
                WHERE id = %s
            """
            values = (new_status_id, application_form_id)

            cursor.execute(sql_query, values)
            conn.commit()

            return True
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()