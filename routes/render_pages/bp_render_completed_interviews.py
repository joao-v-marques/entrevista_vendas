from flask import Blueprint, render_template
from middlewares.jwt_middleware import token_required

bp_render_completed_interviews = Blueprint("bp_render_completed_interviews", __name__)

@bp_render_completed_interviews.route("/entrevistas-realizadas")
@token_required
def render_entrevistas_realizadas():
    return render_template("completed_interviews.html")
