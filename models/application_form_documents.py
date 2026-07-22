from database.connect_db import get_db_connection

class ApplicationFormDocument:
    def __init__(self, original_filename, content_type, stored_path, size_bytes, application_form_id, uploaded_at=None, id=None):
        self.original_filename = original_filename
        self.content_type = content_type
        self.stored_path = stored_path
        self.size_bytes = size_bytes
        self.application_form_id = application_form_id
        self.uploaded_at = uploaded_at
        self.id = id

    def to_dict(self):
        return {
            "id": self.id,
            "original_filename": self.original_filename,
            "content_type": self.content_type,
            "stored_path": self.stored_path,
            "size_bytes": self.size_bytes,
            "uploaded_at": self.uploaded_at,
            "application_form_id": self.application_form_id,
        }

class ApplicationFormDocumentModel:
    # GET de todos os documentos cadastrados no sistema
    @staticmethod
    def get_all():
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                SELECT id, original_filename, content_type, stored_path, size_bytes, uploaded_at, application_form_id
                FROM application_form_documents
            """

            cursor.execute(sql_query)
            application_form_documents_data = cursor.fetchall()

            application_form_documents = [
                ApplicationFormDocument(**application_form_document)
                for application_form_document in application_form_documents_data
            ]

            return application_form_documents
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    # GET de todos os documentos anexados a um form específico
    @staticmethod
    def get_by_application_form_id(application_form_id):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                SELECT id, original_filename, content_type, stored_path, size_bytes, uploaded_at, application_form_id
                FROM application_form_documents
                WHERE application_form_id = %s
                ORDER BY id
            """
            values = (application_form_id,)

            cursor.execute(sql_query, values)
            application_form_documents_data = cursor.fetchall()

            application_form_documents = [
                ApplicationFormDocument(**application_form_document)
                for application_form_document in application_form_documents_data
            ]

            return application_form_documents
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    # Executa apenas o INSERT usando um cursor externo, sem commit/close.
    # Permite que o cadastro participe de uma transação maior (cadastro atômico).
    @staticmethod
    def insert(cursor, document):
        sql_query = """
            INSERT INTO application_form_documents (
                original_filename, content_type, stored_path, size_bytes, uploaded_at, application_form_id
            ) VALUES (
                %s, %s, %s, %s, %s, %s
            )
            RETURNING id
        """
        values = (
            document.original_filename,
            document.content_type,
            document.stored_path,
            document.size_bytes,
            document.uploaded_at,
            document.application_form_id,
        )

        cursor.execute(sql_query, values)
        document.id = cursor.fetchone()["id"]

        return document

    # POST de um ou mais documentos anexados a um form
    @staticmethod
    def create(application_form_documents):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            for document in application_form_documents:
                ApplicationFormDocumentModel.insert(cursor, document)

            conn.commit()

            return application_form_documents
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()
