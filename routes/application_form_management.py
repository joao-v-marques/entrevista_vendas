from flask import Blueprint, jsonify, request
from services.application_form_management import ApplicationFormManagementService
from services.application_form_services import ApplicationFormService

bp_application_form_management = Blueprint("bp_application_form_management", __name__)

# GET de todos cadastrados no sistema
@bp_application_form_management.route("/application_form_management", methods=['GET'])
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
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500

# POST para solicitar reanálise de uma ficha reprovada pela gerência
@bp_application_form_management.route("/application_form_management/<int:application_form_id>/request-reanalysis", methods=['POST'])
def request_reanalysis(application_form_id):
    try:
        ApplicationFormManagementService.request_reanalysis(application_form_id)

        return jsonify({"message": "Reanálise solicitada com sucesso"}), 200
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500

# POST para encerrar a negociação de uma ficha reprovada pela gerência
@bp_application_form_management.route("/application_form_management/<int:application_form_id>/close-negotiation", methods=['POST'])
def close_negotiation(application_form_id):
    try:
        ApplicationFormManagementService.close_negotiation(application_form_id)

        return jsonify({"message": "Negociação encerrada com sucesso"}), 200
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500
