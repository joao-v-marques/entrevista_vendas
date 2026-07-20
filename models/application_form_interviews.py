from database.connect_db import get_db_connection

class ApplicationFormInterview:
    def __init__(self, application_form_id, interview_date=None, schedule_observation=None, interviewer_id=None, interview_approved=None, interview_observation=None, interview_reviewed_at=None, interviewer_name=None, id=None, created_at=None):
        self.interview_date = interview_date
        self.schedule_observation = schedule_observation
        self.interviewer_id = interviewer_id
        self.interview_approved = interview_approved
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
            "interview_approved": self.interview_approved,
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

    # função para reagendar uma entrevista (excluir o registro e voltar o status)
    @staticmethod
    def reschedule_interview(application_form_id):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            # 1) apaga o registro da entrevista do formulário
            delete_query = """
                DELETE FROM application_form_interviews
                WHERE application_form_id = %s
            """
            values_delete = (application_form_id,)
            cursor.execute(delete_query, values_delete)

            # 2) volta o status da ficha para  o 2. Aguardando Agendamento da Entrevista
            update_query = """
                UPDATE application_forms
                SET form_status_id = %s
                WHERE id = %s
            """
            values_update = (2, application_form_id)
            cursor.execute(update_query, values_update)
            
            conn.commit()

            return True
        except Exception as e:
            if conn:
                conn.rollback() # se o UPDATE (ou qualquer coisa falhar), o DELETE também é desfeito
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    # função para realizar a análise da entrevista (reprovado/aprovado)
    @staticmethod
    def analyze_interview(form_interview):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            # 1) fazer o update no agendamento
            update_interview_query = """
                UPDATE application_form_interviews
                SET interviewer_id = %s,
                    interview_approved = %s,
                    interview_observation = %s,
                    interview_reviewed_at = %s
                WHERE application_form_id = %s
            """
            values_interview_update = (form_interview.interviewer_id, form_interview.interview_approved, form_interview.interview_observation, form_interview.interview_reviewed_at, form_interview.application_form_id)
            cursor.execute(update_interview_query, values_interview_update)

            # 2) fazer a atualização do status para o 4. Aguardando Aprovação da Gerência caso seja aprovado e 9. Reprovado na Entrevista
            if form_interview.interview_approved:
                update_query = """
                    UPDATE application_forms
                    SET form_status_id = %s
                    WHERE id = %s
                """
                values_update = (4, form_interview.application_form_id)
                cursor.execute(update_query, values_update)
            else:
                update_query = """
                    UPDATE application_forms
                    SET form_status_id = %s
                    WHERE id = %s
                """
                values_update = (9, form_interview.application_form_id)
                cursor.execute(update_query, values_update)

            conn.commit()

            return True
        except Exception as e:
            if conn:
                conn.rollback() # se o UPDATE (ou qualquer coisa falhar), o DELETE também é desfeito
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()