from database.connect_db import get_db_connection
from models.application_form_documents import ApplicationFormDocumentModel
from models.application_form_models import ApplicationFormModel

class ApplicationFormReanalysisRequest:
    # stage: etapa que reprovou a ficha e gerou a reanálise ('management' ou 'financial')
    def __init__(self, requester_id, reanalysis_observation, application_form_id, id=None, requested_at=None, requester_name=None, stage="management"):
        self.requester_id = requester_id
        self.reanalysis_observation = reanalysis_observation
        self.requested_at = requested_at
        self.application_form_id = application_form_id
        self.requester_name = requester_name
        self.stage = stage
        self.id = id

    def to_dict(self):
        return {
            "id": self.id,
            "requester_id": self.requester_id,
            "reanalysis_observation": self.reanalysis_observation,
            "requested_at": self.requested_at,
            "application_form_id": self.application_form_id,
            "requester_name": self.requester_name,
            "stage": self.stage
        }

class ApplicationFormReanalysisRequestModel:
    # Executa apenas o INSERT usando um cursor externo, sem commit/close.
    # Permite que o cadastro participe de uma transação maior (solicitação + laudos + status).
    @staticmethod
    def insert(cursor, reanalysis_request):
        sql_query = """
            INSERT INTO application_form_reanalysis_requests (
                requester_id,
                reanalysis_observation,
                application_form_id,
                stage
            ) VALUES (
                %s,
                %s,
                %s,
                %s
            )
            RETURNING id, requested_at
        """
        values = (
            reanalysis_request.requester_id,
            reanalysis_request.reanalysis_observation,
            reanalysis_request.application_form_id,
            reanalysis_request.stage,
        )

        cursor.execute(sql_query, values)
        created_reanalysis_request = cursor.fetchone()

        reanalysis_request.id = created_reanalysis_request["id"]
        reanalysis_request.requested_at = created_reanalysis_request["requested_at"]

        return reanalysis_request

    # POST da solicitação de reanálise em uma ÚNICA transação: grava a solicitação, grava os
    # laudos anexados e devolve a ficha para o status 4 (Aguardando Aprovação da Gerência).
    # Se qualquer um dos passos falhar, nada é gravado (rollback), evitando que a ficha mude de
    # status sem o laudo ou que fique uma solicitação órfã no banco.
    @staticmethod
    def create_with_documents(reanalysis_request, documents):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            ApplicationFormReanalysisRequestModel.insert(cursor, reanalysis_request)

            # o id da solicitação só existe depois do insert acima, por isso a amarração
            # de cada laudo com a rodada é feita aqui dentro da transação
            for document in documents:
                document.reanalysis_request_id = reanalysis_request.id
                ApplicationFormDocumentModel.insert(cursor, document)

            ApplicationFormModel.update_status_with_cursor(cursor, 4, reanalysis_request.application_form_id)

            conn.commit()

            return reanalysis_request, documents
        except Exception as e:
            if conn:
                conn.rollback()
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    # POST da solicitação de reanálise financeira em uma ÚNICA transação: grava a solicitação e
    # devolve a ficha para o status 1 (Aguardando Aprovação do Financeiro). Sem laudos: o
    # financeiro só recebe a observação.
    @staticmethod
    def create_and_return_to_financial(reanalysis_request):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            ApplicationFormReanalysisRequestModel.insert(cursor, reanalysis_request)
            ApplicationFormModel.update_status_with_cursor(cursor, 1, reanalysis_request.application_form_id)

            conn.commit()

            return reanalysis_request
        except Exception as e:
            if conn:
                conn.rollback()
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    # GET de todas as solicitações de reanálise de um formulário (com nome de quem solicitou).
    # Retorna a lista completa porque a mesma ficha pode ser reprovada e reanalisada várias vezes,
    # da mais recente para a mais antiga.
    @staticmethod
    def get_by_application_form_id(application_form_id):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                SELECT rr.id, rr.requester_id, u.name AS requester_name, rr.reanalysis_observation, rr.requested_at, rr.application_form_id, rr.stage
                FROM application_form_reanalysis_requests rr
                LEFT JOIN users u ON u.id = rr.requester_id
                WHERE rr.application_form_id = %s
                ORDER BY rr.requested_at DESC
            """
            values = (application_form_id,)

            cursor.execute(sql_query, values)
            reanalysis_requests_data = cursor.fetchall()

            reanalysis_requests = [
                ApplicationFormReanalysisRequest(**reanalysis_request)
                for reanalysis_request in reanalysis_requests_data
            ]

            return reanalysis_requests
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()