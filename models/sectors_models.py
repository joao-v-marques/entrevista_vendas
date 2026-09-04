from database.connect_db import get_db_connection


class Sector:
    def __init__(self, name, is_active=True, id=None):
        self.name = name
        self.is_active = is_active
        self.id = id

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "is_active": self.is_active
        }


class SectorModel:
    @staticmethod
    def get_all():
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()
            sql_query = """
                SELECT id, name, is_active
                FROM sectors
                WHERE is_active = TRUE
                ORDER BY name
            """
            cursor.execute(sql_query)
            
            sector_data = cursor.fetchone()
            
            return [
                Sector(**sector)
                for sector in sector_data
            ]
            
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    @staticmethod
    def get_by_id(sector_id):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()
            sql_query = """
                SELECT id, name, is_active
                FROM sectors
                WHERE id = %s
            """
            values = (sector_id,)
            cursor.execute(sql_query, values)
            sector_data = cursor.fetchone()

            if not sector_data:
                return None

            sector = Sector(**sector_data)

            return sector
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    @staticmethod
    def get_by_name(name):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()
            sql_query = """
                SELECT id, name, is_active
                FROM sectors
                WHERE name = %s
            """
            values = (name,)
            cursor.execute(sql_query, values)
            sector_data = cursor.fetchone()

            if not sector_data:
                return None

            sector = Sector(**sector_data)

            return sector
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    @staticmethod
    def create(sector):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()
            sql_query = """
                INSERT INTO sectors (name)
                VALUES (%s)
                RETURNING id, is_active
            """
            values = (sector.name,)
            cursor.execute(sql_query, values)
            created_data = cursor.fetchone()
            conn.commit()
            sector.id = created_data["id"]
            sector.is_active = created_data["is_active"]
            return sector
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    @staticmethod
    def update(sector):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()
            sql_query = """
                UPDATE sectors
                SET name = %s, is_active = %s
                WHERE id = %s
            """
            values = (sector.name, sector.is_active, sector.id)
            cursor.execute(sql_query, values)
            conn.commit()
            return sector
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    @staticmethod
    def delete(sector_id):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()
            sql_query = """
                UPDATE sectors
                SET is_active = FALSE
                WHERE id = %s
            """
            values = (sector_id,)
            cursor.execute(sql_query, values)
            conn.commit()
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()
