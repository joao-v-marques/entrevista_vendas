import io
import os
import re
import zipfile
import unicodedata
from datetime import datetime
from werkzeug.utils import secure_filename

from models.application_form_documents import ApplicationFormDocumentModel, ApplicationFormDocument
from models.application_form_models import ApplicationFormModel

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_ROOT = os.path.join(PROJECT_ROOT, "upload_docs")

# extensões aceitas nos uploads, mesmo conjunto do accept do input de arquivos no front
ALLOWED_EXTENSIONS = (".pdf", ".jpg", ".jpeg", ".png")

class ApplicationFormDocumentService:
    # GET de todos os documentos cadastrados no sistema
    def get_all():
        try:
            application_form_documents = ApplicationFormDocumentModel.get_all()

            return application_form_documents
        except Exception as e:
            raise Exception(str(e))

    # Monta um .zip em memória com todos os documentos anexados a um form.
    # Retorna (zip_bytes, zip_filename) para o controller enviar como download.
    def build_documents_zip(application_form_id):
        try:
            documents = ApplicationFormDocumentModel.get_by_application_form_id(application_form_id)

            if not documents:
                raise ValueError("Nenhum documento anexado foi encontrado para este formulário")

            zip_buffer = io.BytesIO()
            used_names = {}

            with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
                for document in documents:
                    absolute_path = os.path.join(PROJECT_ROOT, document.stored_path)

                    # ignora silenciosamente registros cujo arquivo físico não existe mais
                    if not os.path.isfile(absolute_path):
                        continue

                    arcname = ApplicationFormDocumentService._build_unique_arcname(
                        document.original_filename, used_names
                    )
                    zip_file.write(absolute_path, arcname)

            if not zip_buffer.getbuffer().nbytes or not used_names:
                raise ValueError("Os arquivos deste formulário não foram encontrados no servidor")

            zip_buffer.seek(0)

            beneficiary_name = ApplicationFormModel.get_beneficiary_name(application_form_id)
            zip_filename = ApplicationFormDocumentService._build_zip_filename(beneficiary_name, application_form_id)

            return zip_buffer.getvalue(), zip_filename
        except ValueError:
            raise
        except Exception as e:
            raise Exception(str(e))

    # Resolve o caminho absoluto de um único documento, para o download individual
    # (usado para abrir o laudo médico sem precisar baixar o zip com todos os anexos).
    # Retorna (caminho_absoluto, documento).
    @staticmethod
    def get_document_file(document_id):
        try:
            document = ApplicationFormDocumentModel.get_by_id(document_id)

            if not document:
                raise ValueError("Documento não encontrado")

            absolute_path = os.path.abspath(os.path.join(PROJECT_ROOT, document.stored_path))

            # trava de segurança: só servimos arquivos que estão dentro da pasta de uploads
            if not absolute_path.startswith(os.path.abspath(UPLOAD_ROOT)):
                raise ValueError("Documento inválido")

            if not os.path.isfile(absolute_path):
                raise ValueError("O arquivo deste documento não foi encontrado no servidor")

            return absolute_path, document
        except ValueError:
            raise
        except Exception as e:
            raise Exception(str(e))

    # garante que nomes de arquivos repetidos não sobrescrevam uns aos outros dentro do zip
    @staticmethod
    def _build_unique_arcname(original_filename, used_names):
        name = original_filename or "documento"
        base, extension = os.path.splitext(name)

        if name not in used_names:
            used_names[name] = 0
            return name

        used_names[name] += 1
        return f"{base}_{used_names[name]}{extension}"

    # monta o nome do arquivo zip: documentos_nome_do_beneficiario_id.zip
    @staticmethod
    def _build_zip_filename(beneficiary_name, application_form_id):
        normalized_name = unicodedata.normalize("NFKD", beneficiary_name or "sem_nome").encode("ascii", "ignore").decode("ascii")
        safe_name = re.sub(r"[^a-zA-Z0-9]+", "_", normalized_name).strip("_").lower()

        return f"documentos_{safe_name}_{application_form_id}.zip"

    # Valida os arquivos recebidos e devolve apenas os que realmente foram enviados.
    # O input de arquivos do front manda uma entrada vazia quando nada é selecionado, por isso
    # essas entradas são descartadas antes da validação (permite upload opcional).
    @staticmethod
    def validate_files(files, allowed_extensions=ALLOWED_EXTENSIONS, max_files=None):
        valid_files = [file for file in files if file and file.filename]

        if not valid_files:
            return []

        if max_files and len(valid_files) > max_files:
            raise ValueError(f"É permitido anexar no máximo {max_files} arquivo(s) por envio")

        for file in valid_files:
            extension = os.path.splitext(file.filename)[1].lower()

            if extension not in allowed_extensions:
                raise ValueError(
                    f"O arquivo '{file.filename}' não é permitido. Envie apenas arquivos {', '.join(allowed_extensions)}"
                )

        return valid_files

    # Salva os arquivos em disco e devolve (documentos, caminhos_salvos), SEM gravar no banco.
    # Os caminhos salvos permitem desfazer os arquivos caso a transação do banco falhe.
    @staticmethod
    def save_files(application_form_id, beneficiary_name, files):
        uploaded_at = datetime.now()

        folder_name = ApplicationFormDocumentService._build_folder_name(beneficiary_name, application_form_id, uploaded_at)
        folder_path = os.path.join(UPLOAD_ROOT, folder_name)
        os.makedirs(folder_path, exist_ok=True)

        documents = []
        saved_paths = []
        for file in files:
            safe_filename = secure_filename(file.filename)

            file.stream.seek(0, os.SEEK_END)
            size_bytes = file.stream.tell()
            file.stream.seek(0)

            absolute_path = os.path.join(folder_path, safe_filename)
            file.save(absolute_path)
            saved_paths.append(absolute_path)

            stored_path = os.path.join("upload_docs", folder_name, safe_filename)

            documents.append(ApplicationFormDocument(
                original_filename=file.filename,
                content_type=file.mimetype,
                stored_path=stored_path,
                size_bytes=size_bytes,
                uploaded_at=uploaded_at,
                application_form_id=application_form_id,
            ))

        return documents, saved_paths

    # Remove do disco arquivos já salvos. Usado para desfazer o upload quando a
    # transação do banco falha (mantém disco e banco consistentes).
    @staticmethod
    def delete_files(saved_paths):
        for path in saved_paths:
            try:
                if os.path.isfile(path):
                    os.remove(path)
            except OSError:
                pass

    # POST de um ou mais documentos anexados a um form
    def create(application_form_id, files):
        try:
            # VALIDAÇÕES AQUI

            beneficiary_name = ApplicationFormModel.get_beneficiary_name(application_form_id)

            new_application_form_documents, _ = ApplicationFormDocumentService.save_files(
                application_form_id, beneficiary_name, files
            )

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
