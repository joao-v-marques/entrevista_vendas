from flask import Blueprint, render_template

bp_render_dashboard = Blueprint("bp_render_dashboard", __name__)

@bp_render_dashboard.route("/dashboard")
def render_dashboard():
    """
    Renderiza página.
    ---
    responses:
      200:
        description: Página renderizada com sucesso.
    """
    return render_template("dashboard.html")
