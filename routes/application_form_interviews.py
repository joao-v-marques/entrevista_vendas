from flask import Blueprint, jsonify
from services.application_form_interviews import ApplicationFormInterviewService

bp_form_interviews = Blueprint("bp_form_interviews", __name__)

@bp_form_interviews.route("/application-form-interviews", methods=['GET'])
def get_all():
    try:
        form_interviews = ApplicationFormInterviewService.get_all()

        return jsonify([
            form_interview.to_dict()
            for form_interview in form_interviews
        ]), 200
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500