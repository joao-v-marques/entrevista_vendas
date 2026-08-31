from flask import Blueprint, jsonify
from services.roles_services import RoleService
from middlewares.jwt_middleware import token_required
from middlewares.permissions import role_required

bp_roles = Blueprint("bp_roles", __name__)

@bp_roles.route("/roles", methods=['GET'])
@token_required
@role_required("administrator")
def get_all():
    try:
        roles = RoleService.get_all()

        return jsonify([
            role.to_dict()
            for role in roles 
        ]), 200
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500
