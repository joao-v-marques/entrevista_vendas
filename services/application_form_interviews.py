from models.application_form_interviews import ApplicationFormInterviewModel, ApplicationFormInterview

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