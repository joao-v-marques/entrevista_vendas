import io

from flask import Blueprint, jsonify, request, send_file
from psycopg.errors import UniqueViolation
from services.application_form_interviews import ApplicationFormInterviewService
from services.application_form_services import ApplicationFormService
from services.interview_document_service import InterviewDocumentService
from utils.exceptions import ConflictError, ForbiddenError, NotFoundError, ValidationError
from utils.interview_pdf import render_interview_report
from middlewares.jwt_middleware import token_required
from middlewares.permissions import role_required

bp_form_interviews = Blueprint("bp_form_interviews", __name__)

@bp_form_interviews.route("/application-form-interviews", methods=['GET'])
@token_required
@role_required("administrator", "director")
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
@token_required
@role_required("administrator", "director", "sales_employee")
def get_completed():
    try:
        # vendas acompanha só as entrevistas das fichas que lançou
        if request.user.get("role_name", "").lower() == "sales_employee":
            completed_interviews = ApplicationFormInterviewService.get_completed(request.user.get("id"))
        else:
            completed_interviews = ApplicationFormInterviewService.get_completed()

        return jsonify([
            completed_interview.to_dict()
            for completed_interview in completed_interviews
        ]), 200
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500

# GET que gera e devolve o documento da entrevista em PDFs
@bp_form_interviews.route("/application-form-interviews/<int:application_form_id>/document", methods=['GET'])
@token_required
@role_required("administrator", "director", "sales_employee")
def download_document(application_form_id):
    try:
        ApplicationFormService.check_access(application_form_id, request.user)

        context = InterviewDocumentService.build_context(application_form_id)
        pdf_bytes = render_interview_report(context)

        return send_file(
            io.BytesIO(pdf_bytes),
            mimetype="application/pdf",
            as_attachment=True,
            download_name=context["nome_arquivo"],
        )
    except ForbiddenError as e:
        return jsonify({
            "message": str(e)
        }), 403
    except NotFoundError as e:
        return jsonify({
            "message": str(e)
        }), 404
    except ConflictError as e:
        return jsonify({
            "message": str(e)
        }), 409
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500


@bp_form_interviews.route("/application-form-interviews", methods=['POST'])
@token_required
@role_required("administrator", "director", "sales_employee")
def schedule_interview():
    try:
        data = request.get_json()

        ApplicationFormService.check_access(data.get("application_form_id"), request.user)

        # cadastrar os campos do agendamento da entrevista no banco de dados
        created_form_interview = ApplicationFormInterviewService.schedule_interview(data)

        return jsonify(created_form_interview.to_dict()), 201
    except ValidationError as e:
        return jsonify({
            "message": str(e)
        }), 400
    except ForbiddenError as e:
        return jsonify({
            "message": str(e)
        }), 403
    except NotFoundError as e:
        return jsonify({
            "message": str(e)
        }), 404
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500
    
@bp_form_interviews.route("/application-form-interviews", methods=['DELETE'])
@token_required
@role_required("administrator", "director", "sales_employee", "interview_employee")
def reschedule_interview():
    try:
        application_form_id = request.args.get("application-form-id")

        if not application_form_id:
            raise ValidationError("ID do formulário passado é inválido")

        # a entrevista trabalha a fila inteira de status 3, então não passa pela checagem de dono
        if request.user.get("role_name", "").lower() != "interview_employee":
            ApplicationFormService.check_access(application_form_id, request.user)

        ApplicationFormInterviewService.reschedule_interview(application_form_id)

        return jsonify({
            "message": "Solicitado reagendamento da entrevista"
        }), 200
    except ValidationError as e:
        return jsonify({
            "message": str(e)
        }), 400
    except ForbiddenError as e:
        return jsonify({
            "message": str(e)
        }), 403
    except NotFoundError as e:
        return jsonify({
            "message": str(e)
        }), 404
    except ConflictError as e:
        return jsonify({
            "message": str(e)
        }), 409
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500
    
# PUT que grava a análise da entrevista e a entrevista qualificada juntas, numa transação só
@bp_form_interviews.route("/application-form-interviews", methods=['PUT'])
@token_required
@role_required("administrator", "director", "interview_employee")
def analyze_interview():
    try:
        data = request.get_json()

        ApplicationFormInterviewService.analyze_interview(data)

        return jsonify({
            "message": "Entrevista análisada com sucesso!"
        }), 200
    except ValidationError as e:
        return jsonify({
            "message": str(e)
        }), 400
    except NotFoundError as e:
        return jsonify({
            "message": str(e)
        }), 404
    except ConflictError as e:
        return jsonify({
            "message": str(e)
        }), 409
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
@token_required
@role_required("administrator", "director", "sales_employee")
def request_reanalysis(application_form_id):
    try:
        ApplicationFormService.check_access(application_form_id, request.user)

        ApplicationFormInterviewService.request_reanalysis(application_form_id)

        return jsonify({"message": "Reanálise solicitada com sucesso"}), 200
    except ForbiddenError as e:
        return jsonify({
            "message": str(e)
        }), 403
    except NotFoundError as e:
        return jsonify({
            "message": str(e)
        }), 404
    except ConflictError as e:
        return jsonify({
            "message": str(e)
        }), 409
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500

# POST para encerrar a negociação de uma ficha reprovada na entrevista
@bp_form_interviews.route("/application-form-interviews/<int:application_form_id>/close-negotiation", methods=['POST'])
@token_required
@role_required("administrator", "director", "sales_employee")
def close_negotiation(application_form_id):
    try:
        ApplicationFormService.check_access(application_form_id, request.user)

        ApplicationFormInterviewService.close_negotiation(application_form_id)

        return jsonify({"message": "Negociação encerrada com sucesso"}), 200
    except ForbiddenError as e:
        return jsonify({
            "message": str(e)
        }), 403
    except NotFoundError as e:
        return jsonify({
            "message": str(e)
        }), 404
    except ConflictError as e:
        return jsonify({
            "message": str(e)
        }), 409
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500
