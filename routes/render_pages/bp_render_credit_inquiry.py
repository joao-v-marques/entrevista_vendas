from flask import Blueprint, render_template
from middlewares.jwt_middleware import token_required

bp_render_credit_inquiry = Blueprint("bp_render_credit_inquiry", __name__)

@bp_render_credit_inquiry.route("/consulta-credito")
@token_required
def render_consulta_credito():
    return render_template("credit_inquiry.html")
