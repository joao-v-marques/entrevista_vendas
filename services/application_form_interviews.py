from database.connect_db import get_db_connection
from models.application_form_interviews import ApplicationFormInterviewModel, ApplicationFormInterview
from models.application_form_models import ApplicationFormModel
from models.qualify_interview import QualifyInterviewModel
from services.qualify_interview import QualifyInterviewService
from utils.exceptions import AppError, ConflictError, NotFoundError, ValidationError

class ApplicationFormInterviewService:
    def get_all():
        try:
            form_interviews = ApplicationFormInterviewModel.get_all()

            return form_interviews
        except Exception as e:
            raise Exception(str(e))

    # GET das entrevistas já analisadas, usado pela tela de Entrevistas Realizadas
    def get_completed():
        try:
            completed_interviews = ApplicationFormInterviewModel.get_completed()

            return completed_interviews
        except Exception as e:
            raise Exception(str(e))
        
    def schedule_interview(data):
        try:
            form_interview = ApplicationFormInterview(
                interview_date=data['interview_date'],
                schedule_observation=data['schedule_observation'],
                application_form_id=data['application_form_id']
            )

            created_form_interview = ApplicationFormInterviewModel.schedule_interview(form_interview)

            return created_form_interview
        except Exception as e:
            raise Exception(str(e))
        
    def reschedule_interview(application_form_id):
        try:
            if not application_form_id:
                raise ValidationError("ID do formulário passado é inválido")

            application_form = ApplicationFormModel.get_by_id(application_form_id)
            if not application_form:
                raise NotFoundError("Formulário não foi encontrado")
            
            if application_form.form_status_id != 3:
                raise ConflictError("Só é possivel reagendar entrevistas de formulários com status 3. Aguardando Aprovação de Entrevista")

            ApplicationFormInterviewModel.reschedule_interview(application_form_id)

            return True
        except AppError:
            raise
        except Exception as e:
            raise Exception(str(e))
        
    # PUT da análise da entrevista em uma ÚNICA transação: grava o parecer do entrevistador, move a ficha de status e grava a entrevista qualificada
    @staticmethod
    def analyze_interview(data):
        qualify_data = data.get('qualify_interview')

        if not qualify_data:
            raise ValidationError("Os dados da entrevista qualificada são obrigatórios")

        form_interview = ApplicationFormInterview(
            interviewer_id=data['interviewer_id'],
            # regra de negócio: toda entrevista analisada é aprovada, independente do que vier no payload
            interview_approved=True,
            interview_observation=data['interview_observation'],
            interview_reviewed_at=data['interview_reviewed_at'],
            application_form_id=data['application_form_id']
        )

        qualify_interview = QualifyInterviewService.build(qualify_data, data['interviewer_id'])

        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            application_form = ApplicationFormModel.lock_for_interview_analysis(cursor, data['application_form_id'])

            if not application_form:
                raise NotFoundError("Formulário não foi encontrado")

            if application_form["form_status_id"] != 3:
                raise ConflictError("Só é possivel analisar entrevistas de formulários com status 3. Aguardando Aprovação de Entrevista")

            application_form_interview_id = ApplicationFormInterviewModel.analyze_interview(cursor, form_interview)

            qualify_interview.application_form_interview_id = application_form_interview_id
            QualifyInterviewModel.insert(cursor, qualify_interview)

            conn.commit()

            return qualify_interview
        except Exception:
            if conn:
                conn.rollback()
            raise
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    # Solicita reanálise de uma ficha reprovada na entrevista (apaga a entrevista e volta o status para 2)
    def request_reanalysis(application_form_id):
        try:
            application_form = ApplicationFormModel.get_by_id(application_form_id)

            if not application_form:
                raise NotFoundError("Ficha não encontrada")

            if application_form.form_status_id != 9:
                raise ConflictError("Só é possível solicitar reanálise de fichas reprovadas na entrevista")

            ApplicationFormInterviewModel.reschedule_interview(application_form_id)

            return True
        except AppError:
            raise
        except Exception as e:
            raise Exception(str(e))

    # Encerra a negociação de uma ficha reprovada na entrevista (soft delete, status 10)
    def close_negotiation(application_form_id):
        try:
            application_form = ApplicationFormModel.get_by_id(application_form_id)

            if not application_form:
                raise NotFoundError("Ficha não encontrada")

            if application_form.form_status_id != 9:
                raise ConflictError("Só é possível encerrar a negociação de fichas reprovadas na entrevista")

            ApplicationFormModel.close_interview_negotiation(application_form_id)

            return True
        except AppError:
            raise
        except Exception as e:
            raise Exception(str(e))
