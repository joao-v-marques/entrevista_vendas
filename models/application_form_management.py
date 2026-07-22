from database.connect_db import get_db_connection

class ApplicationFormManagement:
    def __init__(self, manager_id, management_approved, management_observation, management_reviewed_at, application_form_id, manager_name=None, created_at=None, id=None):
        self.manager_id = manager_id
        self.manager_name = manager_name
        self.management_approved = management_approved
        self.management_observation = management_observation
        self.management_reviewed_at = management_reviewed_at
        self.application_form_id = application_form_id
        self.created_at = created_at
        self.id = id

    def to_dict(self):
        return {
            "id": self.id,
            "manager_id": self.manager_id,
            "manager_name": self.manager_name,
            "management_approved": self.management_approved,
            "management_observation": self.management_observation,
            "management_reviewed_at": self.management_reviewed_at,
            "application_form_id": self.application_form_id,
            "created_at": self.created_at,
        }

class ApplicationFormManagementModel:
    # GET de todos os formulários de aprovação da gerência
    def get_all():
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                SELECT fm.id, fm.manager_id, fm.management_approved, fm.management_observation, fm.management_reviewed_at, fm.application_form_id, fm.created_at
                FROM application_form_management fm
            """

            cursor.execute(sql_query)
            management_form_data = cursor.fetchall()

            management_forms = [
                ApplicationFormManagement(**management_form)
                for management_form in management_form_data
            ]

            return management_forms
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    # GET da aprovação da gerência de um formulário específico (com nome do gerente)
    @staticmethod
    def get_by_application_form_id(application_form_id):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                SELECT fm.id, fm.manager_id, u.name AS manager_name, fm.management_approved, fm.management_observation,
                       fm.management_reviewed_at, fm.application_form_id, fm.created_at
                FROM application_form_management fm
                LEFT JOIN users u ON u.id = fm.manager_id
                WHERE fm.application_form_id = %s
                ORDER BY fm.id DESC
                LIMIT 1
            """
            values = (application_form_id,)

            cursor.execute(sql_query, values)
            management_form_data = cursor.fetchone()

            if not management_form_data:
                return None

            return ApplicationFormManagement(**management_form_data)
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    # POST/Cadastro de um formulário de aprovação da gerência
    def create(management_form):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                INSERT INTO application_form_management (
                    manager_id,
                    management_approved,
                    management_observation,
                    management_reviewed_at,
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
                management_form.manager_id,
                management_form.management_approved,
                management_form.management_observation,
                management_form.management_reviewed_at,
                management_form.application_form_id
            )

            cursor.execute(sql_query, values)
            new_id = cursor.fetchone()["id"]
            conn.commit()

            management_form.id = new_id
            return management_form
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()
