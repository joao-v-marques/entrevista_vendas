from database.connect_db import get_db_connection

class User:
    def __init__(self, username, name, password_hash, email, role_id=None, role_name=None, sector_id=None, sector_name=None, is_active=None, id=None):
        self.username = username
        self.name = name
        self.password_hash = password_hash
        self.email = email
        self.role_id = role_id
        self.role_name = role_name
        self.sector_id = sector_id
        self.sector_name = sector_name
        self.is_active = is_active
        self.id = id

    def to_dict(self):
        return {
            "username": self.username,
            "name": self.name,
            "password_hash": self.password_hash,
            "email": self.email,
            "role_id": self.role_id,
            "role_name": self.role_name,
            "sector_id": self.sector_id,
            "sector_name": self.name,
            "is_active": self.is_active,
            "id": self.id
        }
    
class UserModel:
    # função de GET de todos os usuários cadastrados
    @staticmethod
    def get_all():
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql = """
                SELECT u.id, u.username, u.name, u.password_hash, u.email, u.role_id, r.name, u.sector_id, s.name
                FROM users u
                INNER JOIN roles r ON r.id = u.role_id
                INNER JOIN sectors s ON s.id = u.sector_id
            """
            cursor.execute(sql)

            usersData = cursor.fetchall()

            users = [
                User(**user)
                for user in usersData
            ]

            return users
        except Exception as e:
            raise Exception(str(e))
        finally:
            if conn:
                conn.close()
            if cursor:
                cursor.close()