import jwt, os
from functools import wraps
from flask import request, jsonify, flash, redirect, url_for

def token_required(f):

    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.cookies.get("token")

        if not token:
            flash("Faça login para acessar essa página")
            return redirect(url_for("bp_render_login.render_login"))
        
        try:
            data = jwt.decode(
                token,
                os.getenv("SECRET_KEY"),
                algorithms=["HS256"]
            )

            request.user = data
        except jwt.ExpiredSignatureError:
            return jsonify({
                "message": "Token expirado"
            }), 401
        except jwt.InvalidTokenError:
            return jsonify({
                "message": "Token inválido"
            }), 401
        
        return f(*args, **kwargs)
    
    return decorated