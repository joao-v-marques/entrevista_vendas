from flask import Blueprint, jsonify, request
from services.users_services import UserService
from utils.exceptions import ConflictError, NotFoundError, ValidationError
from middlewares.jwt_middleware import token_required
from middlewares.permissions import role_required

bp_users = Blueprint("bp_users", __name__)

# GET de todos
@bp_users.route("/users", methods=['GET'])
@token_required
@role_required("administrator")
def get_all():
    try:
        users = UserService.get_all()

        return jsonify([
            user.to_dict()
            for user in users
        ])
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500

@bp_users.route("/users/<string:username>", methods=['GET'])
@token_required
@role_required("administrator")
def get_by_username(username):
    try:
        user = UserService.get_by_username(username)

        if not user:
            return jsonify({"message": "Nenhum usuário encontrado com esse username"}), 404

        return jsonify(user.to_dict())
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500
    
@bp_users.route("/users/<int:user_id>", methods=['GET'])
@token_required
@role_required("administrator")
def get_by_id(user_id):
    try:
        user = UserService.get_by_id(user_id)

        if not user:
            return jsonify({"message": "Nenhum usuário encontrado com esse ID"}), 404
        
        return jsonify(user.to_dict())
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500

# create novo user
@bp_users.route("/users", methods=['POST'])
@token_required
@role_required("administrator")
def create():
    try:
        data = request.get_json()

        created_user = UserService.create(data)

        return jsonify(created_user.to_dict()), 201
    except ValidationError as e:
        return jsonify({
            "message": str(e)
        }), 400
    except ConflictError as e:
        return jsonify({
            "message": str(e)
        }), 409
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500

# update do usuário
@bp_users.route("/users/<int:id>", methods=['PUT'])
@token_required
@role_required("administrator")
def update(id):
    try:
        data = request.get_json()

        updated_user = UserService.update(id, data)

        return jsonify(updated_user.to_dict()), 200
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

# delete do usuário
@bp_users.route("/users/<int:id>", methods=['DELETE'])
@token_required
@role_required("administrator")
def delete(id):
    try:
        UserService.delete(id)

        return jsonify({
            "message": "Usuário deletado com sucesso"
        }), 200
    except NotFoundError as e:
        return jsonify({
            "message": str(e)
        }), 404
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500
