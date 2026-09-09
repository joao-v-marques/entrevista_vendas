from flask import Blueprint, render_template
from middlewares.jwt_middleware import token_required
from middlewares.permissions import role_required

bp_render_management_approval = Blueprint("bp_render_management_approval", __name__)

@bp_render_management_approval.route("/aprovar-gerencia")
@token_required
@role_required("administrator", "director", "sales_employee")
def render_aprovar_gerencia():
    return render_template("management_approval.html")
