from flask import Blueprint, jsonify, request
from psycopg.errors import UniqueViolation
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
    
# GET das entrevistas já realizadas (analisadas), para a tela de Entrevistas Realizadas
@bp_form_interviews.route("/application-form-interviews/completed", methods=['GET'])
def get_completed():
    try:
        completed_interviews = ApplicationFormInterviewService.get_completed()

        return jsonify([
            completed_interview.to_dict()
            for completed_interview in completed_interviews
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
    
@bp_form_interviews.route("/application-form-interviews", methods=['DELETE'])
def reschedule_interview():
    try:
        application_form_id = request.args.get("application-form-id")

        ApplicationFormInterviewService.reschedule_interview(application_form_id)

        return jsonify({
            "message": "Solicitado reagendamento da entrevista"
        }), 200
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500
    
# PUT que grava a análise da entrevista e a entrevista qualificada juntas, numa transação só
@bp_form_interviews.route("/application-form-interviews", methods=['PUT'])
def analyze_interview():
    try:
        data = request.get_json()

        ApplicationFormInterviewService.analyze_interview(data)

        return jsonify({
            "message": "Entrevista análisada com sucesso!"
        }), 200
    except ValueError as e:
        return jsonify({
            "message": str(e)
        }), 400
    except UniqueViolation:
        # constraint UNIQUE de qualify_interviews.application_form_interview_id: a entrevista já foi
        # analisada. O rollback já desfez tudo, aqui só traduzimos o erro cru do Postgres
        return jsonify({
            "message": "Esta entrevista já foi analisada."
        }), 409
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500

# POST para solicitar reanálise de uma ficha reprovada na entrevista
@bp_form_interviews.route("/application-form-interviews/<int:application_form_id>/request-reanalysis", methods=['POST'])
def request_reanalysis(application_form_id):
    try:
        ApplicationFormInterviewService.request_reanalysis(application_form_id)

        return jsonify({"message": "Reanálise solicitada com sucesso"}), 200
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500

# POST para encerrar a negociação de uma ficha reprovada na entrevista
@bp_form_interviews.route("/application-form-interviews/<int:application_form_id>/close-negotiation", methods=['POST'])
def close_negotiation(application_form_id):
    try:
        ApplicationFormInterviewService.close_negotiation(application_form_id)

        return jsonify({"message": "Negociação encerrada com sucesso"}), 200
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500