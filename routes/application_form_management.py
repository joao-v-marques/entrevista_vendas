from flask import Blueprint, jsonify, request
from services.application_form_management import ApplicationFormManagementService
from services.application_form_services import ApplicationFormService
from utils.exceptions import ConflictError, NotFoundError, ValidationError
from middlewares.jwt_middleware import token_required
from middlewares.permissions import role_required

bp_application_form_management = Blueprint("bp_application_form_management", __name__)

# GET de todos cadastrados no sistema
@bp_application_form_management.route("/application_form_management", methods=['GET'])
@token_required
@role_required("administrator", "employee")
def get_all():
    try:
        management_forms = ApplicationFormManagementService.get_all()

        return jsonify([
            management_form.to_dict()
            for management_form in management_forms
        ]), 200
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500

# POST de um novo formulário de aprovação da gerência
@bp_application_form_management.route("/application_form_management", methods=['POST'])
@token_required
@role_required("administrator", "employee")
def create():
    try:
        data = request.get_json()

        # realiza o cadastro do formulário de aprovação da gerência no banco
        created_management_form = ApplicationFormManagementService.create(data)

        if data['management_approved']:
            # faz o update do status para o próximo (5. Aguardando Cadastro no Backoffice)
            ApplicationFormService.update_status(5, data)
        else:
            ApplicationFormService.update_status(11, data)

        return jsonify(created_management_form.to_dict()), 201
    except ValidationError as e:
        return jsonify({
            "message": str(e)
        }), 400
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500

# POST para solicitar reanálise de uma ficha reprovada pela gerência.
# Recebe multipart/form-data (e não JSON) porque a solicitação carrega o laudo médico
# anexado junto da observação extra.
@bp_application_form_management.route("/application_form_management/<int:application_form_id>/request-reanalysis", methods=['POST'])
@token_required
@role_required("administrator", "employee")
def request_reanalysis(application_form_id):
    try:
        reanalysis_observation = request.form.get("reanalysis_observation")
        requester_id = request.form.get("requester_id")
        files = request.files.getlist("medical_report")

        # request.form sempre devolve string, mas requester_id é coluna int no banco
        if requester_id:
            if not requester_id.isdigit():
                raise ValidationError("Usuário solicitante inválido")

            requester_id = int(requester_id)

        reanalysis_request, documents = ApplicationFormManagementService.request_reanalysis(
            application_form_id, requester_id, reanalysis_observation, files
        )

        return jsonify({
            "message": "Reanálise solicitada com sucesso",
            "reanalysis_request": reanalysis_request.to_dict(),
            "documents": [document.to_dict() for document in documents],
        }), 201
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
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500

# POST para encerrar a negociação de uma ficha reprovada pela gerência
@bp_application_form_management.route("/application_form_management/<int:application_form_id>/close-negotiation", methods=['POST'])
@token_required
@role_required("administrator", "employee")
def close_negotiation(application_form_id):
    try:
        ApplicationFormManagementService.close_negotiation(application_form_id)

        return jsonify({"message": "Negociação encerrada com sucesso"}), 200
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
