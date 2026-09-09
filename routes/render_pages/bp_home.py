from flask import Blueprint, render_template
from middlewares.jwt_middleware import token_required
from middlewares.permissions import role_required

bp_render_home = Blueprint('bp_render_home', __name__)

@bp_render_home.route('/home')
@token_required
@role_required("administrator", "director", "finance_employee", "sales_employee", "interview_employee")
def render_home():
    return render_template('home.html')