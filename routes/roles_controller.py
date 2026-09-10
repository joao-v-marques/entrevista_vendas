from flask import Blueprint, jsonify, request
from middlewares.jwt_middleware import token_required
from middlewares.permissions import role_required
from services.roles_services import RoleService
from utils.exceptions import ConflictError, NotFoundError, ValidationError


bp_roles = Blueprint("bp_roles", __name__)


@bp_roles.route("/roles", methods=["GET"])
@token_required
@role_required("administrator")
def get_all():
    try:
        return jsonify([role.to_dict() for role in RoleService.get_all()]), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500

@bp_roles.route("/roles/<int:role_id>", methods=["GET"])
@token_required
@role_required("administrator")
def get_by_id(role_id):
    try:
        return jsonify(RoleService.get_by_id(role_id).to_dict()), 200
    except NotFoundError as e:
        return jsonify({"message": str(e)}), 404
    except Exception as e:
        return jsonify({"message": str(e)}), 500


@bp_roles.route("/roles", methods=["POST"])
@token_required
@role_required("administrator")
def create():
    try:
        role = RoleService.create(request.get_json(silent=True))
        return jsonify(role.to_dict()), 201
    except ValidationError as e:
        return jsonify({"message": str(e)}), 400
    except ConflictError as e:
        return jsonify({"message": str(e)}), 409
    except Exception as e:
        return jsonify({"message": str(e)}), 500


@bp_roles.route("/roles/<int:role_id>", methods=["PUT"])
@token_required
@role_required("administrator")
def update(role_id):
    try:
        role = RoleService.update(role_id, request.get_json(silent=True))
        return jsonify(role.to_dict()), 200
    except ValidationError as e:
        return jsonify({"message": str(e)}), 400
    except NotFoundError as e:
        return jsonify({"message": str(e)}), 404
    except ConflictError as e:
        return jsonify({"message": str(e)}), 409
    except Exception as e:
        return jsonify({"message": str(e)}), 500


@bp_roles.route("/roles/<int:role_id>/deactivate", methods=["DELETE"])
@token_required
@role_required("administrator")
def deactivate(role_id):
    try:
        RoleService.deactivate(role_id)
        return jsonify({"message": "Cargo desativado com sucesso"}), 200
    except NotFoundError as e:
        return jsonify({"message": str(e)}), 404
    except Exception as e:
        return jsonify({"message": str(e)}), 500

@bp_roles.route("/roles/<int:role_id>/reactivate", methods=["PATCH"])
@token_required
@role_required("administrator")
def reactivate(role_id):
    try:
        RoleService.reactivate(role_id)

        return jsonify({
            "message": "Cargo reativado com sucesso"
        }), 200
    except NotFoundError as e:
        return jsonify({
            "message": str(e)
        }), 404
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500
