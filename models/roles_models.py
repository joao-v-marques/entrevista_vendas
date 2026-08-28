from database.connect_db import get_db_connection

class Role:
    def __init__(self, name, description, id=None):
        self.name = name
        self.description = description
        self.id = id

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description
        }

class RoleModel:
    @staticmethod
    def get_all():
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                SELECT *
                FROM roles
            """

            cursor.execute(sql_query)

            roles_data = cursor.fetchall()

            roles = [
                Role(**role)
                for role in roles_data
            ]

            return roles
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    # GET pelo id, usado para validar o cargo informado no cadastro/edição de usuários antes
    # de o INSERT esbarrar na foreign key
    @staticmethod
    def get_by_id(role_id):
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                SELECT *
                FROM roles
                WHERE id = %s
            """
            values = (role_id,)

            cursor.execute(sql_query, values)

            role_data = cursor.fetchone()

            if not role_data:
                return None

            return Role(**role_data)
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()
