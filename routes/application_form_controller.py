from flask import Blueprint, request, jsonify
from services.application_form_services import ApplicationFormService

bp_application_form = Blueprint("bp_application_form", __name__)

@bp_application_form.route("/application-forms", methods=['GET'])
def get_all():
    try:
        application_forms = ApplicationFormService.get_all()

        return jsonify([
            application_form.to_dict()
            for application_form in application_forms
        ]), 200
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500

@bp_application_form.route("/application-forms", methods=['POST'])
def create_form():
    try:
        data = request.get_json()

        application_form = ApplicationFormService.create_form(data)

        return jsonify(application_form.to_dict()), 201
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500