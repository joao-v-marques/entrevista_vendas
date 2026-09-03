from database.connect_db import get_db_connection


class Role:
    def __init__(self, name, description=None, is_active=True, id=None):
        self.name = name
        self.description = description
        self.is_active = is_active
        self.id = id

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "is_active": self.is_active
        }


class RoleModel:
    @staticmethod
    def get_all():
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()
            cursor.execute("""
                SELECT id, name, description, is_active
                FROM roles
                WHERE is_active = TRUE
                ORDER BY name
            """)
            return [Role(**role) for role in cursor.fetchall()]
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    @staticmethod
    def get_by_id(role_id):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()
            cursor.execute("""
                SELECT id, name, description, is_active
                FROM roles
                WHERE id = %s
            """, (role_id,))
            role_data = cursor.fetchone()
            return Role(**role_data) if role_data else None
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
                SELECT id, name, description, is_active
                FROM roles
                WHERE name = %s
            """, (name,))
            role_data = cursor.fetchone()
            return Role(**role_data) if role_data else None
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    @staticmethod
    def create(role):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()
            cursor.execute("""
                INSERT INTO roles (name, description)
                VALUES (%s, %s)
                RETURNING id, is_active
            """, (role.name, role.description))
            created_data = cursor.fetchone()
            conn.commit()
            role.id = created_data["id"]
            role.is_active = created_data["is_active"]
            return role
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    @staticmethod
    def update(role):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()
            cursor.execute("""
                UPDATE roles
                SET name = %s, description = %s, is_active = %s
                WHERE id = %s
            """, (role.name, role.description, role.is_active, role.id))
            conn.commit()
            return role
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    @staticmethod
    def delete(role_id):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()
            cursor.execute("""
                UPDATE roles
                SET is_active = FALSE
                WHERE id = %s
            """, (role_id,))
            conn.commit()
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()
