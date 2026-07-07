from flask import Blueprint, render_template

bp_render_forms = Blueprint("bp_render_forms", __name__)

@bp_render_forms.route("/fichas")
def render_fichas():
    """
    Renderiza página.
    ---
    responses:
      200:
        description: Página renderizada com sucesso. 
    """
    return render_template("forms.html")