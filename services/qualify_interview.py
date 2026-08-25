from models.qualify_interview import QualifyInterviewModel

class QualifyInterviewService:
    def get_all():
        try:
            qualify_interviews = QualifyInterviewModel.get_all()

            return qualify_interviews
        except Exception as e:
            raise Exception(str(e))