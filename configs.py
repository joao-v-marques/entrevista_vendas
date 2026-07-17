from routes.render_pages.bp_home import bp_render_home
from routes.render_pages.bp_render_new_form import bp_render_new_form
from routes.render_pages.bp_render_form import bp_render_forms
from routes.render_pages.bp_render_dashboard import bp_render_dashboard
from routes.render_pages.bp_render_approve_form import bp_render_approve_form
from routes.render_pages.bp_render_credit_inquiry import bp_render_credit_inquiry
from routes.render_pages.bp_render_schedule_interview import bp_render_schedule_interview
from routes.render_pages.bp_render_analyze_interview import bp_render_analyze_interview
from routes.render_pages.bp_render_login import bp_render_login

from routes.users_controller import bp_users
from routes.application_form_controller import bp_application_form
from routes.inclusion_responsibles_controller import bp_inclusion_responsibles
from routes.application_form_documents_controller import bp_application_form_documents
from routes.application_forms_approvals import bp_application_form_approval
from routes.auth_controller import bp_auth

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
    app.register_blueprint(bp_render_schedule_interview, url_prefix=prefix)
    app.register_blueprint(bp_render_analyze_interview, url_prefix=prefix)
    app.register_blueprint(bp_render_login, url_prefix=prefix)

    # registro de endpoints
    app.register_blueprint(bp_users, url_prefix=prefix)
    app.register_blueprint(bp_auth, url_prefix=prefix)
    app.register_blueprint(bp_application_form, url_prefix=prefix)
    app.register_blueprint(bp_inclusion_responsibles, url_prefix=prefix)
    app.register_blueprint(bp_application_form_documents, url_prefix=prefix)
    app.register_blueprint(bp_application_form_approval, url_prefix=prefix)