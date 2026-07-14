from models.users_models import UserModel
from utils.jwt_handler import generated_token
from utils.security import verify_password

class AuthService:
    @staticmethod
    def login(data):
        if not data['username']:
            raise ValueError("Username é obrigatório")
        
        if not data['password']:
            raise ValueError("A senha é obrigatória")
        
        user = UserModel.get_by_username(data['username'])

        if not user:
            raise ValueError("Usuário ou senha inválidos")
        
        if not verify_password(user.password_hash, data['password']):
            raise ValueError("Usuário ou senha inválidos")

        token = generated_token(user)

        return token

    @staticmethod
    def get_me(user_id):
        try:
            user = UserModel.get_by_id(user_id)

            if not user:
                raise ValueError("Não foi encontrado nenhum usuário com esse ID")
            
            return user.to_dict()
        except Exception as e:
            raise Exception(str(e))