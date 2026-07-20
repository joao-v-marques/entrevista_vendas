from database.connect_db import get_db_connection

class ApplicationFormInterview:
    def __init__(self, interview_date, schedule_observation, interviewer_id, interview_approved, interview_observation, interview_reviewed_at, application_form_id, interviewer_name=None, id=None, created_at=None):
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
                INNER JOIN users u ON u.id = ai.interviewer_id
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