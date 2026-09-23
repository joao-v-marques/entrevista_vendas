from flask import Blueprint, render_template
from middlewares.jwt_middleware import token_required
from middlewares.permissions import role_required

bp_render_forms = Blueprint("bp_render_forms", __name__)

@bp_render_forms.route("/fichas")
@token_required
@role_required("administrator", "director", "finance_employee", "sales_employee")
def render_fichas():
    return render_template("forms.html")