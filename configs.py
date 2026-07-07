from routes.render_pages.bp_home import bp_render_home
from routes.render_pages.bp_render_new_form import bp_render_new_form
from routes.render_pages.bp_render_form import bp_render_forms
from routes.render_pages.bp_render_dashboard import bp_render_dashboard
from routes.render_pages.bp_render_approve_form import bp_render_approve_form
from routes.render_pages.bp_render_credit_inquiry import bp_render_credit_inquiry

prefix = "/entrevista-adesao"

def config_all(app):
    config_bps(app)

def config_bps(app):
    # registros para renderização
    app.register_blueprint(bp_render_home, url_prefix=prefix)
    app.register_blueprint(bp_render_new_form, url_prefix=prefix)
    app.register_blueprint(bp_render_forms, url_prefix=prefix)
    app.register_blueprint(bp_render_dashboard, url_prefix=prefix)
    app.register_blueprint(bp_render_approve_form, url_prefix=prefix)
    app.register_blueprint(bp_render_credit_inquiry, url_prefix=prefix)

    # registro de endpoints