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
            "email": self.email,
            "role_id": self.role_id,
            "role_name": self.role_name,
            "sector_id": self.sector_id,
            "sector_name": self.sector_name,
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
                SELECT u.id, u.username, u.name, u.password_hash, u.email, u.role_id, r.name AS role_name, u.sector_id, s.name AS sector_name, is_active
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

    # GET pelo username para validações de login e autenticação no geral
    @staticmethod
    def get_by_username(username):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql = """
                SELECT u.id, u.username, u.name, u.password_hash, u.email, u.role_id, r.name AS role_name, u.sector_id, s.name AS sector_name, is_active
                FROM users u
                INNER JOIN roles r ON r.id = u.role_id
                INNER JOIN sectors s ON s.id = u.sector_id
                WHERE u.username = %s
            """
            values = (username,)

            cursor.execute(sql, values)
            userData = cursor.fetchone()

            # transforma o dict do objeto em modelo Users
            if not userData:
                return None
            
            user = User(**userData)

            return user
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    # GET pelo id
    @staticmethod
    def get_by_id(user_id):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql = """
                SELECT u.id, u.username, u.name, u.password_hash, u.email, u.role_id, r.name AS role_name, u.sector_id, s.name AS sector_name, is_active
                FROM users u
                INNER JOIN roles r ON r.id = u.role_id
                INNER JOIN sectors s ON s.id = u.sector_id
                WHERE u.id = %s
            """
            values = (user_id,)

            cursor.execute(sql, values)
            userData = cursor.fetchone()

            # transforma o dict do objeto em modelo Users
            if not userData:
                return None
            
            user = User(**userData)

            return user
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    # POST para criar novo usuário
    @staticmethod
    def create(user):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                INSERT INTO users (username, name, password_hash, email, role_id, sector_id)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id
            """
            values = (user.username, user.name, user.password_hash, user.email, user.role_id, user.sector_id)

            cursor.execute(sql_query, values)
            new_id = cursor.fetchone()["id"]
            conn.commit()

            user.id = new_id
            user.is_active = True
            return user
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()