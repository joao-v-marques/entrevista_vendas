import io

from flask import Blueprint, request, jsonify, send_file
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

# GET que baixa, em um único .zip, todos os documentos anexados a um formulário
@bp_application_form_documents.route("/application-form-documents/<int:application_form_id>/download", methods=['GET'])
def download_all(application_form_id):
    try:
        zip_bytes, zip_filename = ApplicationFormDocumentService.build_documents_zip(application_form_id)

        return send_file(
            io.BytesIO(zip_bytes),
            mimetype="application/zip",
            as_attachment=True,
            download_name=zip_filename,
        )
    except ValueError as e:
        return jsonify({
            "message": str(e)
        }), 404
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500

# GET que devolve UM documento específico. Por padrão abre no navegador (inline), o que
# permite visualizar o laudo médico da reanálise; com ?download=true força o download.
@bp_application_form_documents.route("/application-form-documents/<int:document_id>/file", methods=['GET'])
def download_file(document_id):
    try:
        absolute_path, document = ApplicationFormDocumentService.get_document_file(document_id)

        return send_file(
            absolute_path,
            mimetype=document.content_type,
            as_attachment=request.args.get("download") == "true",
            download_name=document.original_filename,
        )
    except ValueError as e:
        return jsonify({
            "message": str(e)
        }), 404
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
