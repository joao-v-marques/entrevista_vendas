from flask import Blueprint, render_template

bp_render_new_form = Blueprint('bp_render_new_form', __name__)

@bp_render_new_form.route('/nova-ficha')
def render_nova_ficha():
    return render_template('new_form.html')