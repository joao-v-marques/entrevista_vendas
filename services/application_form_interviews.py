from database.connect_db import get_db_connection
from models.application_form_interviews import ApplicationFormInterviewModel, ApplicationFormInterview
from models.application_form_models import ApplicationFormModel
from models.qualify_interview import QualifyInterviewModel
from services.qualify_interview import QualifyInterviewService

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
                raise ValueError("ID do formulário passado é inválido")

            application_form = ApplicationFormModel.get_by_id(application_form_id)
            if not application_form:
                raise ValueError("Formulário não foi encontrado")
            
            if application_form.form_status_id != 3:
                raise ValueError("Só é possivel reagendar entrevistas de formulários com status 3. Aguardando Aprovação de Entrevista")

            ApplicationFormInterviewModel.reschedule_interview(application_form_id)

            return True
        except Exception as e:
            raise Exception(str(e))
        
    # PUT da análise da entrevista em uma ÚNICA transação: grava o parecer do entrevistador,
    # move a ficha de status e grava a entrevista qualificada. As duas sempre são enviadas juntas,
    # então se qualquer passo falhar nada é gravado (rollback), evitando que uma ficha fique
    # analisada e movida de status sem o questionário de saúde que justifica a decisão.
    @staticmethod
    def analyze_interview(data):
        # FASE 1: validação fora da transação. Payload inválido é recusado sem abrir conexão
        # nenhuma, e a transação só começa quando os dados já são sabidamente válidos.
        qualify_data = data.get('qualify_interview')

        if not qualify_data:
            raise ValueError("Os dados da entrevista qualificada são obrigatórios")

        form_interview = ApplicationFormInterview(
            interviewer_id=data['interviewer_id'],
            interview_approved=data['interview_approved'],
            interview_observation=data['interview_observation'],
            interview_reviewed_at=data['interview_reviewed_at'],
            application_form_id=data['application_form_id']
        )

        # quem assina a análise é quem registra a entrevista qualificada
        qualify_interview = QualifyInterviewService.build(qualify_data, data['interviewer_id'])

        # FASE 2: transação única, com um commit só para as duas gravações
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            # trava a ficha ANTES de validar o status. Sem o lock existe a janela entre
            # "conferi que está no status 3" e "gravei", e duas análises simultâneas da mesma
            # entrevista passariam as duas pela checagem
            application_form = ApplicationFormModel.lock_for_interview_analysis(cursor, data['application_form_id'])

            if not application_form:
                raise ValueError("Formulário não foi encontrado")

            if application_form["form_status_id"] != 3:
                raise ValueError("Só é possivel analisar entrevistas de formulários com status 3. Aguardando Aprovação de Entrevista")

            # 1. análise da entrevista: devolve o id da entrevista que acabou de ser atualizada
            application_form_interview_id = ApplicationFormInterviewModel.analyze_interview(cursor, form_interview)

            # 2. entrevista qualificada, amarrada nesse id (e não em um id vindo do front)
            qualify_interview.application_form_interview_id = application_form_interview_id
            QualifyInterviewModel.insert(cursor, qualify_interview)

            conn.commit()

            return qualify_interview
        except Exception:
            if conn:
                conn.rollback()
            # repassa a exceção original: achatar tudo em Exception faria um ValueError de
            # validação virar 500 no controller em vez de 400
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
                raise ValueError("Ficha não encontrada")

            if application_form.form_status_id != 9:
                raise ValueError("Só é possível solicitar reanálise de fichas reprovadas na entrevista")

            ApplicationFormInterviewModel.reschedule_interview(application_form_id)

            return True
        except Exception as e:
            raise Exception(str(e))

    # Encerra a negociação de uma ficha reprovada na entrevista (soft delete, status 10)
    def close_negotiation(application_form_id):
        try:
            application_form = ApplicationFormModel.get_by_id(application_form_id)

            if not application_form:
                raise ValueError("Ficha não encontrada")

            if application_form.form_status_id != 9:
                raise ValueError("Só é possível encerrar a negociação de fichas reprovadas na entrevista")

            ApplicationFormModel.close_interview_negotiation(application_form_id)

            return True
        except Exception as e:
            raise Exception(str(e))
