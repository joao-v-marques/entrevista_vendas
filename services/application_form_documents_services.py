import os
import re
import unicodedata
from datetime import datetime
from werkzeug.utils import secure_filename

from models.application_form_documents import ApplicationFormDocumentModel, ApplicationFormDocument
from models.application_form_models import ApplicationFormModel

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_ROOT = os.path.join(PROJECT_ROOT, "upload_docs")

class ApplicationFormDocumentService:
    # GET de todos os documentos cadastrados no sistema
    def get_all():
        try:
            application_form_documents = ApplicationFormDocumentModel.get_all()

            return application_form_documents
        except Exception as e:
            raise Exception(str(e))

    # POST de um ou mais documentos anexados a um form
    def create(application_form_id, files):
        try:
            # VALIDAÇÕES AQUI

            beneficiary_name = ApplicationFormModel.get_beneficiary_name(application_form_id)
            uploaded_at = datetime.now()

            folder_name = ApplicationFormDocumentService._build_folder_name(beneficiary_name, application_form_id, uploaded_at)
            folder_path = os.path.join(UPLOAD_ROOT, folder_name)
            os.makedirs(folder_path, exist_ok=True)

            new_application_form_documents = []
            for file in files:
                safe_filename = secure_filename(file.filename)

                file.stream.seek(0, os.SEEK_END)
                size_bytes = file.stream.tell()
                file.stream.seek(0)

                absolute_path = os.path.join(folder_path, safe_filename)
                file.save(absolute_path)

                stored_path = os.path.join("upload_docs", folder_name, safe_filename)

                new_application_form_documents.append(ApplicationFormDocument(
                    original_filename=file.filename,
                    content_type=file.mimetype,
                    stored_path=stored_path,
                    size_bytes=size_bytes,
                    uploaded_at=uploaded_at,
                    application_form_id=application_form_id,
                ))

            created_application_form_documents = ApplicationFormDocumentModel.create(new_application_form_documents)

            return created_application_form_documents
        except Exception as e:
            raise Exception(str(e))

    # monta o nome da subpasta: nome_do_beneficiario_id_do_form_uploaded_at
    @staticmethod
    def _build_folder_name(beneficiary_name, application_form_id, uploaded_at):
        normalized_name = unicodedata.normalize("NFKD", beneficiary_name or "sem_nome").encode("ascii", "ignore").decode("ascii")
        safe_name = re.sub(r"[^a-zA-Z0-9]+", "_", normalized_name).strip("_").lower()
        timestamp = uploaded_at.strftime("%Y%m%d_%H%M%S")

        return f"{safe_name}_{application_form_id}_{timestamp}"
