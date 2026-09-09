from flask import Blueprint, render_template
from middlewares.jwt_middleware import token_required
from middlewares.permissions import role_required

bp_render_configs = Blueprint("bp_render_configs", __name__)

@bp_render_configs.route("/configs", methods=['GET'])
@token_required
@role_required("administrator")
def render_config():
    return render_template("configs.html")