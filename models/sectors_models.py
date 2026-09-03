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
            cursor.execute("""
                SELECT id, name, is_active
                FROM sectors
                WHERE is_active = TRUE
                ORDER BY name
            """)
            return [Sector(**sector) for sector in cursor.fetchall()]
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
            cursor.execute("""
                SELECT id, name, is_active
                FROM sectors
                WHERE id = %s
            """, (sector_id,))
            sector_data = cursor.fetchone()
            return Sector(**sector_data) if sector_data else None
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
            cursor.execute("""
                SELECT id, name, is_active
                FROM sectors
                WHERE name = %s
            """, (name,))
            sector_data = cursor.fetchone()
            return Sector(**sector_data) if sector_data else None
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
            cursor.execute("""
                INSERT INTO sectors (name)
                VALUES (%s)
                RETURNING id, is_active
            """, (sector.name,))
            created_data = cursor.fetchone()
            conn.commit()
            sector.id = created_data["id"]
            sector.is_active = created_data["is_active"]
            return sector
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
            cursor.execute("""
                UPDATE sectors
                SET name = %s, is_active = %s
                WHERE id = %s
            """, (sector.name, sector.is_active, sector.id))
            conn.commit()
            return sector
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
            cursor.execute("""
                UPDATE sectors
                SET is_active = FALSE
                WHERE id = %s
            """, (sector_id,))
            conn.commit()
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()
