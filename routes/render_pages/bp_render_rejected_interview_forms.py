from flask import Blueprint, render_template
from middlewares.jwt_middleware import token_required

bp_render_rejected_interview_forms = Blueprint("bp_render_rejected_interview_forms", __name__)

@bp_render_rejected_interview_forms.route("/fichas-reprovadas-entrevista")
@token_required
def render_fichas_reprovadas_entrevista():
    return render_template("rejected_interview_forms.html")
