import json

from flask import Blueprint, request, jsonify
from services.application_form_services import ApplicationFormService
from utils.exceptions import ConflictError, ForbiddenError, NotFoundError, ValidationError
from middlewares.jwt_middleware import token_required
from middlewares.permissions import role_required

bp_application_form = Blueprint("bp_application_form", __name__)

@bp_application_form.route("/application-forms", methods=['GET'])
@token_required
@role_required("administrator", "director", "finance_employee", "sales_employee", "interview_employee")
def get_all():
    try:
        user_id = request.user.get("id")
        role_name = request.user.get("role_name", "").lower()

        # diretoria e administradores veem tudo, vendas só o que lançou, financeiro só o que
        # analisou por último e a entrevista não acompanha fichas (só aprova pela fila)
        if role_name in ("administrator", "director"):
            application_forms = ApplicationFormService.get_all()
        elif role_name == "sales_employee":
            application_forms = ApplicationFormService.get_all(consultant_id=user_id)
        elif role_name == "finance_employee":
            application_forms = ApplicationFormService.get_all(financial_reviewer_id=user_id)
        else:
            application_forms = []

        return jsonify([
            application_form.to_dict()
            for application_form in application_forms
        ]), 200
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500

# GET de todos por status (USANDO QUERY PARAMS, VARIÁVEL É status_id)
@bp_application_form.route("/application-forms/status", methods=['GET'])
@token_required
@role_required("administrator", "director", "finance_employee", "sales_employee", "interview_employee")
def get_by_status():
    try:
        status_id = request.args.get('status_id')

        if not status_id:
            raise ValidationError("ID do status é inválido, verifique e tente novamente")

        user_id = request.user.get("id")
        role_name = request.user.get("role_name", "").lower()

        # as filas de aprovação (1. financeiro, 3. entrevista) ficam inteiras para quem aprova;
        # fora delas vale a mesma regra de visibilidade do GET geral
        if role_name in ("administrator", "director"):
            application_forms = ApplicationFormService.get_by_status(status_id)
        elif role_name == "sales_employee":
            application_forms = ApplicationFormService.get_by_status(status_id, consultant_id=user_id)
        elif role_name == "finance_employee" and status_id == "1":
            application_forms = ApplicationFormService.get_by_status(status_id)
        elif role_name == "finance_employee":
            application_forms = ApplicationFormService.get_by_status(status_id, financial_reviewer_id=user_id)
        elif role_name == "interview_employee" and status_id == "3":
            application_forms = ApplicationFormService.get_by_status(status_id)
        else:
            application_forms = []

        return jsonify([
            application_form.to_dict()
            for application_form in application_forms
        ])
    except ValidationError as e:
        return jsonify({
            "message": str(e)
        }), 400
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500

# GET das fichas pendentes de aprovação da gerência (status 4), junto com a entrevista qualificada
@bp_application_form.route("/application-forms/management-pending", methods=['GET'])
@token_required
@role_required("administrator", "director", "sales_employee")
def get_pending_management_approval():
    try:
        # vendas acompanha só as fichas que lançou; diretoria e administradores veem todas
        if request.user.get("role_name", "").lower() == "sales_employee":
            pending_forms = ApplicationFormService.get_pending_management_approval(request.user.get("id"))
        else:
            pending_forms = ApplicationFormService.get_pending_management_approval()

        return jsonify(pending_forms)
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500


# GET agregado com TODOS os dados de um formulário (usado pela tela de visualização)
@bp_application_form.route("/application-forms/<int:application_form_id>/details", methods=['GET'])
@token_required
@role_required("administrator", "director", "finance_employee", "sales_employee")
def get_full_details(application_form_id):
    try:
        ApplicationFormService.check_access(application_form_id, request.user)

        details = ApplicationFormService.get_full_details(application_form_id)

        return jsonify(details), 200
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


# POST ATÔMICO: cria o formulário, seus responsáveis pela inclusão e os documentos
# anexados em uma única transação, evitando o cadastro de um registro sem os demais
# obrigatórios. Recebe multipart/form-data: "form" (JSON), "responsibles" (JSON) e os arquivos.
@bp_application_form.route("/application-forms/complete", methods=['POST'])
@token_required
@role_required("administrator", "director", "sales_employee")
def create_form_complete():
    try:
        form_data = json.loads(request.form.get("form") or "{}")
        responsibles_data = json.loads(request.form.get("responsibles") or "[]")
        files = request.files.getlist("anexed_docs")

        application_form, responsibles, documents = ApplicationFormService.create_complete(
            form_data, responsibles_data, files
        )

        return jsonify({
            "form": application_form.to_dict(),
            "responsibles": [responsible.to_dict() for responsible in responsibles],
            "documents": [document.to_dict() for document in documents],
        }), 201
    except ValidationError as e:
        return jsonify({
            "message": str(e)
        }), 400
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500

# PUT ATÔMICO: edita os dados editáveis do formulário e substitui os responsáveis pela inclusão.
# Recebe JSON: "form" (objeto) e "responsibles" (lista). Status, consultor, tipo de beneficiário
# e datas de controle não são alterados por aqui, mesmo que venham no corpo.
@bp_application_form.route("/application-forms/<int:application_form_id>", methods=['PUT'])
@token_required
@role_required("administrator", "director")
def update_form_complete(application_form_id):
    try:
        data = request.get_json(silent=True) or {}

        application_form, responsibles = ApplicationFormService.update_complete(
            application_form_id, data.get("form"), data.get("responsibles")
        )

        return jsonify({
            "form": application_form.to_dict(),
            "responsibles": [responsible.to_dict() for responsible in responsibles],
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
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500

# POST para solicitar reanálise financeira de uma ficha reprovada.
# Recebe JSON com requester_id e reanalysis_observation (opcional).
@bp_application_form.route("/application-forms/<int:application_form_id>/request-reanalysis", methods=['POST'])
@token_required
@role_required("administrator", "director", "sales_employee")
def request_reanalysis(application_form_id):
    try:
        data = request.get_json(silent=True) or {}

        ApplicationFormService.check_access(application_form_id, request.user)

        reanalysis_request = ApplicationFormService.request_reanalysis(
            application_form_id, data.get("requester_id"), data.get("reanalysis_observation")
        )

        return jsonify({
            "message": "Reanálise solicitada com sucesso",
            "reanalysis_request": reanalysis_request.to_dict(),
        }), 201
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

# POST para encerrar a negociação de uma ficha reprovada pelo financeiro
@bp_application_form.route("/application-forms/<int:application_form_id>/close-negotiation", methods=['POST'])
@token_required
@role_required("administrator", "director", "sales_employee")
def close_negotiation(application_form_id):
    try:
        ApplicationFormService.check_access(application_form_id, request.user)

        ApplicationFormService.close_negotiation(application_form_id)

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

# POST para finalizar o cadastro (status 5 -> 6. Finalizado)
@bp_application_form.route("/application-forms/<int:application_form_id>/finalize", methods=['POST'])
@token_required
@role_required("administrator", "director", "sales_employee")
def finalize_registration(application_form_id):
    try:
        ApplicationFormService.check_access(application_form_id, request.user)

        ApplicationFormService.finalize_registration(application_form_id)

        return jsonify({"message": "Cadastro finalizado com sucesso"}), 200
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
