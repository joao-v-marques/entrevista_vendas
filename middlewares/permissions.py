from functools import wraps
from flask import request, jsonify, redirect, url_for

HOME_ENDPOINT = "bp_render_home.render_home"
LOGIN_ENDPOINT = "bp_render_login.render_login"


# rotas de página (blueprints bp_render_*) devolvem um redirect em vez do JSON de 403,
# senão o usuário que digita a URL direto recebe a resposta técnica na tela
def access_denied():
    blueprint = request.blueprint or ""

    if not blueprint.startswith("bp_render"):
        return jsonify({
            "message": "Acesso negado"
        }), 403

    # sem essa guarda, uma role sem acesso à home entraria em redirect infinito
    if request.endpoint == HOME_ENDPOINT:
        return redirect(url_for(LOGIN_ENDPOINT))

    return redirect(url_for(HOME_ENDPOINT))


def role_required(*allowed_roles):
    def decorator(f):

        @wraps(f)
        def decorated(*args, **kwargs):
            user = getattr(request, "user", None)

            if not user:
                return jsonify({
                    "message": "Usuário não autenticado"
                }), 401
            
            user_role = user.get("role_name")

            if isinstance(user_role, str):
                user_role = user_role.lower()

            allowed_roles_normalized = {
                role.lower() if isinstance(role, str) else role
                for role in allowed_roles
            }

            if user_role not in allowed_roles_normalized:
                return access_denied()
            
            return f(*args, **kwargs)
        return decorated
    return decorator