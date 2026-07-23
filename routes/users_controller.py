from flask import Blueprint, jsonify, request
from services.users_services import UserService

bp_users = Blueprint("bp_users", __name__)

# GET de todos
@bp_users.route("/users", methods=['GET'])
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
def create():
    try:
        data = request.get_json()

        created_user = UserService.create(data)

        return jsonify(created_user.to_dict()), 201
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500