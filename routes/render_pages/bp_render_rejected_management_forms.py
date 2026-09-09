from flask import Blueprint, render_template
from middlewares.jwt_middleware import token_required
from middlewares.permissions import role_required

bp_render_rejected_management_forms = Blueprint("bp_render_rejected_management_forms", __name__)

@bp_render_rejected_management_forms.route("/fichas-reprovadas-gerencia")
@token_required
@role_required("administrator", "director", "sales_employee")
def render_fichas_reprovadas_gerencia():
    return render_template("rejected_management_forms.html")
