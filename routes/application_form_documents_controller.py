from flask import Blueprint, request, jsonify
from services.application_form_documents_services import ApplicationFormDocumentService

bp_application_form_documents = Blueprint("bp_application_form_documents", __name__)

@bp_application_form_documents.route("/application-form-documents", methods=['GET'])
def get_all():
    try:
        application_form_documents = ApplicationFormDocumentService.get_all()

        return jsonify([
            application_form_document.to_dict()
            for application_form_document in application_form_documents
        ]), 200
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500

@bp_application_form_documents.route("/application-form-documents", methods=['POST'])
def create():
    try:
        application_form_id = request.form.get("application_form_id")
        files = request.files.getlist("anexed_docs")

        application_form_documents = ApplicationFormDocumentService.create(application_form_id, files)

        return jsonify([
            application_form_document.to_dict()
            for application_form_document in application_form_documents
        ]), 201
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500
