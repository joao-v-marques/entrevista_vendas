from flask import Blueprint, render_template
from middlewares.jwt_middleware import token_required

bp_render_rejected_forms = Blueprint("bp_render_rejected_forms", __name__)

@bp_render_rejected_forms.route("/fichas-reprovadas")
@token_required
def render_fichas_reprovadas():
    return render_template("rejected_forms.html")
