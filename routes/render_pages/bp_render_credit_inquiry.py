from flask import Blueprint, render_template

bp_render_credit_inquiry = Blueprint("bp_render_credit_inquiry", __name__)

@bp_render_credit_inquiry.route("/consulta-credito")
def render_consulta_credito():
    """
    Renderiza página.
    ---
    responses:
      200:
        description: Página renderizada com sucesso.
    """
    return render_template("credit_inquiry.html")
