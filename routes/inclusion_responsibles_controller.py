from flask import Blueprint, request, jsonify
from services.inclusion_responsibles_services import InclusionResponsiblesService
from utils.exceptions import ConflictError, NotFoundError, ValidationError
from middlewares.jwt_middleware import token_required
from middlewares.permissions import role_required

bp_inclusion_responsibles = Blueprint("bp_inclusion_responsibles", __name__)

@bp_inclusion_responsibles.route("/inclusion-responsibles", methods=['GET'])
@token_required
@role_required("administrator", "director")
def get_all():
    try:
        inclusion_responsibles = InclusionResponsiblesService.get_all()

        return jsonify([
            inclusion_responsible.to_dict()
            for inclusion_responsible in inclusion_responsibles
        ]), 200
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500

@bp_inclusion_responsibles.route("/inclusion-responsibles", methods=['POST'])
@token_required
@role_required("administrator", "director", "sales_employee")
def create():
    try:
        data = request.get_json()

        inclusion_responsible = InclusionResponsiblesService.create(data)

        return jsonify(inclusion_responsible.to_dict()), 201
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
