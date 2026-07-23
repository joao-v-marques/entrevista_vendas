from flask import Blueprint, render_template
from middlewares.jwt_middleware import token_required

bp_render_users = Blueprint("bp_render_users", __name__)

@bp_render_users.route("/usuarios")
@token_required
def render_usuarios():
    return render_template("users.html")
