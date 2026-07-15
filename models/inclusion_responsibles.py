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

    # POST de um responsável pela inclusão no sistema
    @staticmethod
    def create(inclusion_responsible):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

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
            new_id = cursor.fetchone()["id"]
            conn.commit()

            inclusion_responsible.id = new_id
            return inclusion_responsible
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()