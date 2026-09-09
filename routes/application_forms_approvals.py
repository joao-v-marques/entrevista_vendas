from flask import Blueprint, jsonify, request
from services.application_forms_approvals import ApplicationFormApprovalService
from middlewares.jwt_middleware import token_required
from middlewares.permissions import role_required
from utils.exceptions import ConflictError, NotFoundError, ValidationError

bp_application_form_approval = Blueprint("bp_application_form_approval", __name__)

# GET de todos cadastrados no sistema
@bp_application_form_approval.route("/application_form_approval", methods=['GET'])
@token_required
@role_required("administrator", "director", "finance_employee", "sales_employee")
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
@token_required
@role_required("administrator", "director", "finance_employee")
def create():
    try:
        data = request.get_json(silent=True)

        # o service grava o parecer e move a ficha de status na mesma transação
        created_approval_form = ApplicationFormApprovalService.create(data)

        return jsonify(created_approval_form.to_dict()), 201
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
