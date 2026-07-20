from models.application_form_interviews import ApplicationFormInterviewModel, ApplicationFormInterview
from models.application_form_models import ApplicationFormModel

class ApplicationFormInterviewService:
    def get_all():
        try:
            form_interviews = ApplicationFormInterviewModel.get_all()

            return form_interviews
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
        
    def analyze_interview(data):
        try:
            application_form_id = data['application_form_id']

            application_form = ApplicationFormModel.get_by_id(application_form_id)
            if not application_form:
                raise ValueError("Formulário não foi encontrado")

            if application_form.form_status_id != 3:
                raise ValueError("Só é possivel analisar entrevistas de formulários com status 3. Aguardando Aprovação de Entrevista")

            form_interview = ApplicationFormInterview(
                interviewer_id=data['interviewer_id'],
                interview_approved=data['interview_approved'],
                interview_observation=data['interview_observation'],
                interview_reviewed_at=data['interview_reviewed_at'],
                application_form_id=application_form_id
            )

            ApplicationFormInterviewModel.analyze_interview(form_interview)

            return True
        except Exception as e:
            raise Exception(str(e))
        