from routes.render_pages.bp_home import bp_render_home
from routes.render_pages.bp_render_new_form import bp_render_new_form
from routes.render_pages.bp_render_form import bp_render_forms
from routes.render_pages.bp_render_dashboard import bp_render_dashboard
from routes.render_pages.bp_render_approve_form import bp_render_approve_form
from routes.render_pages.bp_render_rejected_forms import bp_render_rejected_forms
from routes.render_pages.bp_render_schedule_interview import bp_render_schedule_interview
from routes.render_pages.bp_render_analyze_interview import bp_render_analyze_interview
from routes.render_pages.bp_render_rejected_interview_forms import bp_render_rejected_interview_forms
from routes.render_pages.bp_render_management_approval import bp_render_management_approval
from routes.render_pages.bp_render_rejected_management_forms import bp_render_rejected_management_forms
from routes.render_pages.bp_render_users import bp_render_users
from routes.render_pages.bp_render_login import bp_render_login

from routes.users_controller import bp_users
from routes.application_form_controller import bp_application_form
from routes.inclusion_responsibles_controller import bp_inclusion_responsibles
from routes.application_form_documents_controller import bp_application_form_documents
from routes.application_forms_approvals import bp_application_form_approval
from routes.auth_controller import bp_auth
from routes.application_form_interviews import bp_form_interviews
from routes.application_form_management import bp_application_form_management
from routes.sectors_controller import bp_sectors
from routes.roles_controller import bp_roles
from routes.qualify_interview_controller import bp_qualify_interview

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
    app.register_blueprint(bp_render_rejected_forms, url_prefix=prefix)
    app.register_blueprint(bp_render_schedule_interview, url_prefix=prefix)
    app.register_blueprint(bp_render_analyze_interview, url_prefix=prefix)
    app.register_blueprint(bp_render_rejected_interview_forms, url_prefix=prefix)
    app.register_blueprint(bp_render_management_approval, url_prefix=prefix)
    app.register_blueprint(bp_render_rejected_management_forms, url_prefix=prefix)
    app.register_blueprint(bp_render_users, url_prefix=prefix)
    app.register_blueprint(bp_render_login, url_prefix=prefix)

    # registro de endpoints
    app.register_blueprint(bp_users, url_prefix=prefix)
    app.register_blueprint(bp_auth, url_prefix=prefix)
    app.register_blueprint(bp_application_form, url_prefix=prefix)
    app.register_blueprint(bp_inclusion_responsibles, url_prefix=prefix)
    app.register_blueprint(bp_application_form_documents, url_prefix=prefix)
    app.register_blueprint(bp_application_form_approval, url_prefix=prefix)
    app.register_blueprint(bp_form_interviews, url_prefix=prefix)
    app.register_blueprint(bp_application_form_management, url_prefix=prefix)
    app.register_blueprint(bp_sectors, url_prefix=prefix)
    app.register_blueprint(bp_roles, url_prefix=prefix)
    app.register_blueprint(bp_qualify_interview, url_prefix=prefix)