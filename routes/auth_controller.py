from flask import Blueprint, request, jsonify
from services.auth_services import AuthService
from middlewares.jwt_middleware import token_required

bp_auth = Blueprint("bp_auth", __name__)

@bp_auth.route("/login", methods=['POST'])
def user_login():
    try:
        data = request.get_json()

        token = AuthService.login(data)

        response = jsonify({
            "message": "Login realizado com sucesso"
        })

        response.set_cookie(
            'token',
            token,
            httponly=True,
            samesite='Lax',
            secure=False,
            max_age=8 * 60 * 60
        )

        return response, 200
    except ValueError as e:
        return jsonify({
            "message": str(e)
        }), 401
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500
    
@bp_auth.route("/me", methods=['GET'])
@token_required
def get_me():
    try:
        user_id = request.user["id"]

        user = AuthService.get_me(user_id)

        return jsonify(user)
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500
    
@bp_auth.route("/logout", methods=['POST'])
def logout():
    response = jsonify({
        "message": "Logout realizado com sucesso"
    })

    response.set_cookie(
        'token',
        '',
        httponly=True,
        samesite='Lax',
        secure=False,
        max_age=0
    )

    return response, 200