from database.connect_db import get_db_connection

class User:
    def __init__(self, username, name, password_hash, email, role_id=None, role_name=None, sector_id=None, sector_name=None, is_active=None, id=None, cpf=None):
        self.username = username
        self.name = name
        self.password_hash = password_hash
        self.email = email
        self.role_id = role_id
        self.role_name = role_name
        self.sector_id = sector_id
        self.sector_name = sector_name
        self.is_active = is_active
        self.cpf = cpf
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
            "cpf": self.cpf,
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
                SELECT u.id, u.username, u.name, u.password_hash, u.email, u.cpf, u.role_id, r.name AS role_name, u.sector_id, s.name AS sector_name, u.is_active
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
                SELECT u.id, u.username, u.name, u.password_hash, u.email, u.cpf, u.role_id, r.name AS role_name, u.sector_id, s.name AS sector_name, u.is_active
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
                SELECT u.id, u.username, u.name, u.password_hash, u.cpf, u.email, u.role_id, r.name AS role_name, u.sector_id, s.name AS sector_name, u.is_active
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

    # GET pelo CPF, para barrar CPF repetido antes de o INSERT esbarrar na constraint UNIQUE.
    # Sem os JOINs de roles/sectors de propósito: um usuário antigo com cargo ou setor nulo não
    # apareceria no INNER JOIN, a checagem passaria batido e o erro voltaria como 500 do banco.
    @staticmethod
    def get_by_cpf(cpf):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql = """
                SELECT id, username, name, password_hash, email, cpf, role_id, sector_id, u.is_active
                FROM users
                WHERE cpf = %s
            """
            values = (cpf,)

            cursor.execute(sql, values)
            userData = cursor.fetchone()

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
                INSERT INTO users (username, name, password_hash, email, role_id, sector_id, cpf)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """
            values = (user.username, user.name, user.password_hash, user.email, user.role_id, user.sector_id, user.cpf)

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

    # UPDATE dos dados de um usuário (não altera a senha)
    @staticmethod
    def update(user):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                UPDATE users
                SET username = %s, name = %s, email = %s, role_id = %s, sector_id = %s, is_active = %s, cpf = %s
                WHERE id = %s
            """
            values = (user.username, user.name, user.email, user.role_id, user.sector_id, user.is_active, user.cpf, user.id)

            cursor.execute(sql_query, values)
            conn.commit()

            return user
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    # DELETE de um usuário
    @staticmethod
    def delete(user_id):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                DELETE FROM users
                WHERE id = %s
            """
            values = (user_id,)

            cursor.execute(sql_query, values)
            conn.commit()

            return True
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()