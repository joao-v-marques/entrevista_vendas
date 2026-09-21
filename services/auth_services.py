from models.users_models import UserModel
from utils.jwt_handler import generated_token
from utils.security import verify_password
from utils.exceptions import AppError, AuthError, NotFoundError, ValidationError

class AuthService:
    @staticmethod
    def login(data):
        if not data['username']:
            raise ValidationError("Username é obrigatório")
        
        if not data['password']:
            raise ValidationError("A senha é obrigatória")
        
        user = UserModel.get_by_username(data['username'])

        # a mesma mensagem nos dois casos de propósito: não revela se o username existe
        if not user:
            raise AuthError("Usuário ou senha inválidos")
        
        if not verify_password(user.password_hash, data['password']):
            raise AuthError("Usuário ou senha inválidos")

        if not user.is_active:
            raise AuthError("Não é possível fazer login com um usuário inativo. Contate o suporte")

        token = generated_token(user)

        return token

    @staticmethod
    def get_me(user_id):
        try:
            user = UserModel.get_by_id(user_id)

            if not user:
                raise NotFoundError("Não foi encontrado nenhum usuário com esse ID")
            
            return user.to_dict()
        except AppError:
            raise
        except Exception as e:
            raise Exception(str(e))
