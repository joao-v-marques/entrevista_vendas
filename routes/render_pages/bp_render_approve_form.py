from flask import Blueprint, render_template
from middlewares.jwt_middleware import token_required
from middlewares.permissions import role_required

bp_render_approve_form = Blueprint("bp_render_approve_form", __name__)

@bp_render_approve_form.route("/aprovar-ficha")
@token_required
@role_required("administrator", "director", "finance_employee", "sales_employee")
def render_aprovar_ficha():
    return render_template("approve_form.html")
