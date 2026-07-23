from database.connect_db import get_db_connection

class Sector:
    def __init__(self, name, id=None):
        self.name = name
        self.id = id

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name
        }

class SectorModel:
    # GET de todos cadastrados
    def get_all():
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                SELECT *
                FROM sectors
            """
            cursor.execute(sql_query)

            sectors_data = cursor.fetchall()

            sectors = [
                Sector(**sector)
                for sector in sectors_data
            ]

            return sectors
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()