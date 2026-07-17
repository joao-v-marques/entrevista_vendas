from database.connect_db import get_db_connection

class ApplicationFormApproval:
    def __init__(self, financial_approved, financial_reviewer_id, financial_reviewed_at, financial_observation, application_form_id, created_at=None, id=None):
        self.financial_approved = financial_approved
        self.financial_reviewer_id = financial_reviewer_id
        self.financial_reviewed_at = financial_reviewed_at
        self.financial_observation = financial_observation
        self.application_form_id = application_form_id
        self.created_at = created_at
        self.id = id

    def to_dict(self):
        return {
            "id": self.id,
            "financial_approved": self.financial_approved,
            "financial_reviewer_id": self.financial_reviewer_id,
            "financial_reviewed_at": self.financial_reviewed_at,
            "financial_observation": self.financial_observation,
            "application_form_id": self.application_form_id,
            "created_at": self.created_at,
        }
    
class ApplicationFormApprovalModel:
    # GET de todos os formulários de aprovação
    def get_all():
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                SELECT fa.id, fa.financial_approved, fa.financial_reviewer_id, fa.financial_reviewed_at, fa.financial_observation, fa.application_form_id, fa.created_at
                FROM application_form_approvals fa
            """

            cursor.execute(sql_query)
            approve_form_data = cursor.fetchall()

            approve_forms = [
                ApplicationFormApproval(**approve_form)
                for approve_form in approve_form_data
            ]

            return approve_forms
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()