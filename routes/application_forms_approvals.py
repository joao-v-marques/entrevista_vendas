from flask import Blueprint, jsonify, request
from services.application_forms_approvals import ApplicationFormApprovalService
from services.application_form_services import ApplicationFormService

bp_application_form_approval = Blueprint("bp_application_form_approval", __name__)

# GET de todos cadastrados no sistema
@bp_application_form_approval.route("/application_form_approval", methods=['GET'])
def get_all():
    try:
        approval_forms = ApplicationFormApprovalService.get_all()

        return jsonify([
            approval_form.to_dict()
            for approval_form in approval_forms
        ]), 200
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500
    
# POST de um novo formulário de aprovação
@bp_application_form_approval.route("/application_form_approval", methods=['POST'])
def create():
    try:
        data = request.get_json()

        # realiza o cadsatro do formulário de aprovação no banco
        created_approval_form = ApplicationFormApprovalService.create(data)
        # faz o update do status para o próximo (2)
        ApplicationFormService.update_status(2, data)
        
        return jsonify(created_approval_form.to_dict()), 201
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500