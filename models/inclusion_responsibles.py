from database.connect_db import get_db_connection

class InclusionResponsibles:
    def __init__(self, name, cpf, marital_state, profession, application_form_id, id=None):
        self.name = name
        self.cpf = cpf
        self.marital_state = marital_state
        self.profession = profession
        self.application_form_id = application_form_id
        self.id = id
    
    def to_dict(self):
        return {
            "name": self.name,
            "cpf": self.cpf,
            "marital_state": self.marital_state,
            "profession": self.profession,
            "application_form_id": self.application_form_id,
            "id": self.id
        }

class InclusionResponsiblesModel:
    # GET de todos os responsáveis pela inclusão cadastrados no sistema
    @staticmethod
    def get_all():
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                SELECT id, name, cpf, marital_state, profession, application_form_id
                FROM inclusion_responsibles
            """

            cursor.execute(sql_query)
            inclusion_responsibles_data = cursor.fetchall()

            inclusion_responsibles = [
                InclusionResponsibles(**inclusion_responsible)
                for inclusion_responsible in inclusion_responsibles_data
            ]

            return inclusion_responsibles
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    # GET de todos os responsáveis pela inclusão de um formulário específico
    @staticmethod
    def get_by_application_form_id(application_form_id):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                SELECT id, name, cpf, marital_state, profession, application_form_id
                FROM inclusion_responsibles
                WHERE application_form_id = %s
                ORDER BY id
            """
            values = (application_form_id,)

            cursor.execute(sql_query, values)
            inclusion_responsibles_data = cursor.fetchall()

            inclusion_responsibles = [
                InclusionResponsibles(**inclusion_responsible)
                for inclusion_responsible in inclusion_responsibles_data
            ]

            return inclusion_responsibles
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    # Executa apenas o INSERT usando um cursor externo, sem commit/close.
    # Permite que o cadastro participe de uma transação maior (cadastro atômico).
    @staticmethod
    def insert(cursor, inclusion_responsible):
        sql_query = """
            INSERT INTO inclusion_responsibles (
                name, cpf, marital_state, profession, application_form_id
            ) VALUES (
                %s, %s, %s, %s, %s
            )
            RETURNING id
        """
        values = (
            inclusion_responsible.name,
            inclusion_responsible.cpf,
            inclusion_responsible.marital_state,
            inclusion_responsible.profession,
            inclusion_responsible.application_form_id,
        )

        cursor.execute(sql_query, values)
        inclusion_responsible.id = cursor.fetchone()["id"]

        return inclusion_responsible

    # POST de um responsável pela inclusão no sistema
    @staticmethod
    def create(inclusion_responsible):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            InclusionResponsiblesModel.insert(cursor, inclusion_responsible)
            conn.commit()

            return inclusion_responsible
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()