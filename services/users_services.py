from models.users_models import UserModel, User
from utils.security import hash_password

class UserService:
    @staticmethod
    def get_all():
        try:
            users = UserModel.get_all()

            return users
        except Exception as e:
            raise Exception(str(e))
        
    @staticmethod
    def get_by_username(username):
        try:
            user = UserModel.get_by_username(username)

            return user
        except Exception as e:
            raise Exception(str(e))
        
    @staticmethod
    def get_by_id(user_id):
        try:
            user = UserModel.get_by_id(user_id)

            return user
        except Exception as e:
            raise Exception(str(e))

    # POST user
    @staticmethod
    def create(data):
        try:
            password_hash = hash_password(data['password'])

            existing_user = UserModel.get_by_username(data['username'])

            if existing_user:
                raise ValueError(f"O usuário {data['username']} já está cadastrado")

            user = User(
                username=data['username'],
                name=data['name'],
                password_hash=password_hash,
                email=data['email'],
                role_id=data['role_id'],
                sector_id=data['sector_id']
            )

            created_user = UserModel.create(user)

            return created_user
        except Exception as e:
            raise Exception(str(e))

    # UPDATE de um usuário (não altera a senha)
    @staticmethod
    def update(user_id, data):
        try:
            existing_user = UserModel.get_by_id(user_id)

            if not existing_user:
                raise ValueError("Não existe nenhum usuário com o ID informado")

            # impede usar um username que já pertence a outro usuário
            user_with_username = UserModel.get_by_username(data['username'])

            if user_with_username and user_with_username.id != user_id:
                raise ValueError(f"O usuário {data['username']} já está cadastrado")

            user = User(
                username=data['username'],
                name=data['name'],
                password_hash=None,
                email=data['email'],
                role_id=data['role_id'],
                sector_id=data['sector_id'],
                is_active=data['is_active'],
                id=user_id
            )

            updated_user = UserModel.update(user)

            return updated_user
        except Exception as e:
            raise Exception(str(e))

    # DELETE de um usuário
    def delete(user_id):
        try:
            user = UserModel.get_by_id(user_id)

            if not user:
                return ValueError("Não existe nenhum usuário com o ID informado")

            UserModel.delete(user_id)

            return True
        except Exception as e:
            raise Exception(str(e))