from flask import Blueprint, render_template, request, redirect, url_for

bp_render_new_form = Blueprint('bp_render_new_form', __name__)

TIPOS_VALIDOS = ('primary', 'secondary')

@bp_render_new_form.route('/nova-ficha')
def render_nova_ficha():
    return render_template('select_form_type.html')

@bp_render_new_form.route('/nova-ficha/formulario')
def render_formulario_ficha():
    tipo = request.args.get('type')

    if tipo not in TIPOS_VALIDOS:
        return redirect(url_for('bp_render_new_form.render_nova_ficha'))

    return render_template('new_form.html', tipo=tipo)