from database.connect_db import get_db_connection
from models.application_form_models import ApplicationFormModel

class ApplicationFormApproval:
    def __init__(self, financial_approved, financial_reviewer_id, financial_reviewed_at, financial_observation, application_form_id, financial_reviewer_name=None, created_at=None, id=None):
        self.financial_approved = financial_approved
        self.financial_reviewer_id = financial_reviewer_id
        self.financial_reviewer_name = financial_reviewer_name
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
            "financial_reviewer_name": self.financial_reviewer_name,
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

    # GET da aprovação financeira de um formulário específico (com nome do revisor)
    @staticmethod
    def get_by_application_form_id(application_form_id):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                SELECT fa.id, fa.financial_approved, fa.financial_reviewer_id, u.name AS financial_reviewer_name,
                       fa.financial_reviewed_at, fa.financial_observation, fa.application_form_id, fa.created_at
                FROM application_form_approvals fa
                LEFT JOIN users u ON u.id = fa.financial_reviewer_id
                WHERE fa.application_form_id = %s
                ORDER BY fa.id DESC
                LIMIT 1
            """
            values = (application_form_id,)

            cursor.execute(sql_query, values)
            approve_form_data = cursor.fetchone()

            if not approve_form_data:
                return None

            return ApplicationFormApproval(**approve_form_data)
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    # Executa apenas o INSERT usando um cursor externo, sem commit/close.
    # Não abre conexão de propósito: o parecer financeiro nunca é gravado sozinho, ele sempre
    # participa da transação que também move a ficha de status. Exigir o cursor torna impossível
    # commitar metade da operação por engano.
    @staticmethod
    def insert(cursor, approve_form):
        sql_query = """
            INSERT INTO application_form_approvals (
                financial_approved,
                financial_reviewer_id,
                financial_reviewed_at,
                financial_observation,
                application_form_id
            ) VALUES (
                %s,
                %s,
                %s,
                %s,
                %s
            )
            RETURNING id
        """
        values = (
            approve_form.financial_approved,
            approve_form.financial_reviewer_id,
            approve_form.financial_reviewed_at,
            approve_form.financial_observation,
            approve_form.application_form_id
        )

        cursor.execute(sql_query, values)
        approve_form.id = cursor.fetchone()["id"]

        return approve_form

    # POST do parecer financeiro em uma ÚNICA transação: grava a aprovação e move a ficha para o
    # status decidido pelo service. Se qualquer um dos passos falhar, nada é gravado (rollback),
    # evitando que o parecer fique registrado com a ficha presa aguardando aprovação financeira —
    # o que permitiria analisar a mesma ficha de novo e gerar um parecer duplicado.
    @staticmethod
    def create_with_status(approve_form, new_status_id):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            ApplicationFormApprovalModel.insert(cursor, approve_form)

            ApplicationFormModel.update_status_with_cursor(cursor, new_status_id, approve_form.application_form_id)

            conn.commit()

            return approve_form
        except Exception as e:
            if conn:
                conn.rollback() # desfaz o INSERT se o UPDATE (ou qualquer outra coisa) falhar
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()