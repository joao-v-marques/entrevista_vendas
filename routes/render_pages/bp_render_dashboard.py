from flask import Blueprint, render_template
from middlewares.jwt_middleware import token_required
from middlewares.permissions import role_required

bp_render_dashboard = Blueprint("bp_render_dashboard", __name__)

@bp_render_dashboard.route("/dashboard")
@token_required
@role_required("administrator", "director")
def render_dashboard():
    return render_template("dashboard.html")
