from models.application_form_interviews import ApplicationFormInterviewModel

class ApplicationFormInterviewService:
    def get_all():
        try:
            form_interviews = ApplicationFormInterviewModel.get_all()

            return form_interviews
        except Exception as e:
            raise Exception(str(e))