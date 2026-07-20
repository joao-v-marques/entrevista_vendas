from flask import Blueprint, jsonify, request
from services.application_form_interviews import ApplicationFormInterviewService
from services.application_form_services import ApplicationFormService

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
    
@bp_form_interviews.route("/application-form-interviews", methods=['POST'])
def schedule_interview():
    try:
        data = request.get_json()

        # cadastrar os campos do agendamento da entrevista no banco de dados
        created_form_interview = ApplicationFormInterviewService.schedule_interview(data)

        return jsonify(created_form_interview.to_dict()), 201
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500