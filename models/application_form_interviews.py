from database.connect_db import get_db_connection

class ApplicationFormInterview:
    def __init__(self, application_form_id, interview_date=None, schedule_observation=None, interviewer_id=None, interview_approved=None, interview_observation=None, interview_reviewed_at=None, interviewer_name=None, id=None, created_at=None):
        self.interview_date = interview_date
        self.schedule_observation = schedule_observation
        self.interviewer_id = interviewer_id
        self.interviewer_approved = interview_approved
        self.interview_observation = interview_observation
        self.interview_reviewed_at = interview_reviewed_at
        self.application_form_id = application_form_id
        self.interviewer_name = interviewer_name
        self.id = id
        self.created_at = created_at

    def to_dict(self):
        return {
            "id": self.id,
            "interview_date": self.interview_date,
            "schedule_observation": self.schedule_observation,
            "interviewer_id": self.interviewer_id,
            "interviewer_approved": self.interviewer_approved,
            "interview_observation": self.interview_observation,
            "interview_reviewed_at": self.interview_reviewed_at,
            "application_form_id": self.application_form_id,
            "interviewer_name": self.interviewer_name,
            "created_at": self.created_at
        }
    
class ApplicationFormInterviewModel:
    # GET de todos cadastrados no sistema
    @staticmethod
    def get_all():
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                SELECT ai.id, ai.interview_date, ai.schedule_observation, ai.interviewer_id, u.name AS interviewer_name, ai.interview_approved, ai.interview_observation, ai.interview_reviewed_at, ai.application_form_id, ai.created_at
                FROM application_form_interviews ai
                LEFT JOIN users u ON u.id = ai.interviewer_id
            """
            cursor.execute(sql_query)

            form_interview_data = cursor.fetchall()

            form_interviews = [
                ApplicationFormInterview(**form_interview)
                for form_interview in form_interview_data
            ]

            return form_interviews
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    # função para realizar agendamento (PRIMEIRO POST)
    @staticmethod
    def schedule_interview(form_interview):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            # 1) Realiza a inserção do agendamento no banco de dados
            insert_query = """
                INSERT INTO application_form_interviews (interview_date, schedule_observation, application_form_id)
                VALUES (%s, %s, %s)
                RETURNING id
            """
            values_insert = (form_interview.interview_date, form_interview.schedule_observation, form_interview.application_form_id)
            cursor.execute(insert_query, values_insert)
            new_id = cursor.fetchone()["id"]
            
            # 2) move o status da fichha para 3
            update_query = """
                UPDATE application_forms
                SET form_status_id = %s
                WHERE id = %s
            """
            values_update = (3, form_interview.application_form_id)
            cursor.execute(update_query, values_update)
            
            # único commit para as duas querys
            conn.commit()
            
            form_interview.id = new_id
            return form_interview
        except Exception as e:
            if conn:
                conn.rollback() # desfaz o INSERT se o UPDATE (ou qualquer outra coisa) falhar
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()