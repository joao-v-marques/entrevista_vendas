from flask import Blueprint, jsonify
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
        })