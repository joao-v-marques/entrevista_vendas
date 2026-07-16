from flask import Blueprint, render_template
from middlewares.jwt_middleware import token_required

bp_render_analyze_interview = Blueprint("bp_render_analyze_interview", __name__)

@bp_render_analyze_interview.route("/analisar-entrevista")
@token_required
def render_analisar_entrevista():
    return render_template("analyze_interview.html")
