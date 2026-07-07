from flask import Blueprint, render_template

bp_render_approve_form = Blueprint("bp_render_approve_form", __name__)

@bp_render_approve_form.route("/aprovar-ficha")
def render_aprovar_ficha():
    """
    Renderiza página.
    ---
    responses:
      200:
        description: Página renderizada com sucesso.
    """
    return render_template("approve_form.html")
