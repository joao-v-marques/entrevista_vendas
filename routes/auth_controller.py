from flask import Blueprint, request, jsonify
from services.auth_services import AuthService
from services.users_services import UserService
from middlewares.jwt_middleware import token_required
from utils.exceptions import AuthError, NotFoundError, ValidationError

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
    except ValidationError as e:
        return jsonify({
            "message": str(e)
        }), 400
    except AuthError as e:
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
    except NotFoundError as e:
        return jsonify({
            "message": str(e)
        }), 404
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

# o próprio usuário troca a sua senha; o id vem do token, nunca do body, para não
# ser possível alterar a senha de outra pessoa por aqui
@bp_auth.route("/me/change-password", methods=['PATCH'])
@token_required
def change_own_password():
    try:
        user_id = request.user["id"]
        data = request.get_json()

        UserService.change_password(user_id, data)

        response = jsonify({
            "message": "Senha alterada com sucesso"
        })

        # troca de senha encerra a sessão: o usuário precisa entrar de novo com a senha nova
        response.set_cookie(
            'token',
            '',
            httponly=True,
            samesite='Lax',
            secure=False,
            max_age=0
        )

        return response, 200
    except ValidationError as e:
        return jsonify({
            "message": str(e)
        }), 400
    except NotFoundError as e:
        return jsonify({
            "message": str(e)
        }), 404
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500
