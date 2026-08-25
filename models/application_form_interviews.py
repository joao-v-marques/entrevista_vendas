from database.connect_db import get_db_connection
from models.application_form_models import ApplicationFormModel

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
    
# DTO para entrevistas já realizadas/analisadas
class CompletedInterview:
    def __init__(self, id, interview_date, interview_approved, interview_observation, interview_reviewed_at,
                 application_form_id, interviewer_id, interviewer_name, beneficiary_name, beneficiary_cpf,
                 inclusion_type, consultant_id, consultant_name, form_status_id, form_status_name,
                 qualify_interview_id=None):
        self.id = id
        self.interview_date = interview_date
        self.interview_approved = interview_approved
        self.interview_observation = interview_observation
        self.interview_reviewed_at = interview_reviewed_at
        self.application_form_id = application_form_id
        self.interviewer_id = interviewer_id
        self.interviewer_name = interviewer_name
        self.beneficiary_name = beneficiary_name
        self.beneficiary_cpf = beneficiary_cpf
        self.inclusion_type = inclusion_type
        self.consultant_id = consultant_id
        self.consultant_name = consultant_name
        self.form_status_id = form_status_id
        self.form_status_name = form_status_name
        # id da entrevista qualificada vinculada, que o PDF vai precisar para saber o que renderizar
        self.qualify_interview_id = qualify_interview_id

    def to_dict(self):
        return {
            "id": self.id,
            "interview_date": self.interview_date,
            "interview_approved": self.interview_approved,
            "interview_observation": self.interview_observation,
            "interview_reviewed_at": self.interview_reviewed_at,
            "application_form_id": self.application_form_id,
            "interviewer_id": self.interviewer_id,
            "interviewer_name": self.interviewer_name,
            "beneficiary_name": self.beneficiary_name,
            "beneficiary_cpf": self.beneficiary_cpf,
            "inclusion_type": self.inclusion_type,
            "consultant_id": self.consultant_id,
            "consultant_name": self.consultant_name,
            "form_status_id": self.form_status_id,
            "form_status_name": self.form_status_name,
            "qualify_interview_id": self.qualify_interview_id
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

    # GET das entrevistas JÁ ANALISADAS (aprovadas e reprovadas), para a tela de Entrevistas
    @staticmethod
    def get_completed():
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                SELECT
                    ai.id,
                    ai.interview_date,
                    ai.interview_approved,
                    ai.interview_observation,
                    ai.interview_reviewed_at,
                    ai.application_form_id,
                    ai.interviewer_id,
                    ui.name AS interviewer_name,
                    af.beneficiary_name,
                    af.beneficiary_cpf,
                    af.inclusion_type,
                    af.consultant_id,
                    uc.name AS consultant_name,
                    af.form_status_id,
                    fs.name AS form_status_name,
                    qi.id AS qualify_interview_id
                FROM application_form_interviews ai
                INNER JOIN application_forms af ON af.id = ai.application_form_id
                INNER JOIN users uc ON uc.id = af.consultant_id
                INNER JOIN form_status fs ON fs.id = af.form_status_id
                LEFT JOIN users ui ON ui.id = ai.interviewer_id
                LEFT JOIN qualify_interviews qi ON qi.application_form_interview_id = ai.id
                WHERE ai.interview_reviewed_at IS NOT NULL
                ORDER BY ai.interview_reviewed_at DESC
            """
            cursor.execute(sql_query)

            completed_interviews_data = cursor.fetchall()

            completed_interviews = [
                CompletedInterview(**completed_interview)
                for completed_interview in completed_interviews_data
            ]

            return completed_interviews
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    # GET da entrevista de um formulário específico (com nome do entrevistador)
    @staticmethod
    def get_by_application_form_id(application_form_id):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                SELECT ai.id, ai.interview_date, ai.schedule_observation, ai.interviewer_id, u.name AS interviewer_name,
                       ai.interview_approved, ai.interview_observation, ai.interview_reviewed_at, ai.application_form_id, ai.created_at
                FROM application_form_interviews ai
                LEFT JOIN users u ON u.id = ai.interviewer_id
                WHERE ai.application_form_id = %s
                ORDER BY ai.id DESC
                LIMIT 1
            """
            values = (application_form_id,)

            cursor.execute(sql_query, values)
            form_interview_data = cursor.fetchone()

            if not form_interview_data:
                return None

            return ApplicationFormInterview(**form_interview_data)
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
            
            # 2) move o status da ficha para 3
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

    # Executa a análise da entrevista com um cursor externo, sem commit/close.
    # Não abre conexão de propósito: a análise nunca é gravada sozinha, ela sempre participa da
    # transação que grava também a entrevista qualificada. Exigir o cursor torna impossível
    # commitar metade da operação por engano.
    @staticmethod
    def analyze_interview(cursor, form_interview):
        # 1) grava o parecer do entrevistador no agendamento que já existe.
        # o RETURNING devolve o id da entrevista efetivamente atualizada, e é ele que amarra a
        # entrevista qualificada — assim o vínculo não depende de nenhum id vindo do front
        update_interview_query = """
            UPDATE application_form_interviews
            SET interviewer_id = %s,
                interview_approved = %s,
                interview_observation = %s,
                interview_reviewed_at = %s
            WHERE application_form_id = %s
            RETURNING id
        """
        values_interview_update = (form_interview.interviewer_id, form_interview.interview_approved, form_interview.interview_observation, form_interview.interview_reviewed_at, form_interview.application_form_id)
        cursor.execute(update_interview_query, values_interview_update)

        updated_interview = cursor.fetchone()

        # nenhuma linha atualizada significa ficha sem entrevista agendada: aborta a transação inteira
        if not updated_interview:
            raise ValueError("Entrevista não encontrada para esta ficha")

        # 2) move a ficha para 4. Aguardando Aprovação da Gerência quando aprovada,
        # e para 9. Reprovado na Entrevista quando reprovada
        new_status_id = 4 if form_interview.interview_approved else 9
        ApplicationFormModel.update_status_with_cursor(cursor, new_status_id, form_interview.application_form_id)

        form_interview.id = updated_interview["id"]

        return updated_interview["id"]
