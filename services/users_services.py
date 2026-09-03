from models.users_models import UserModel, User
from models.roles_models import RoleModel
from models.sectors_models import SectorModel
from utils.security import hash_password
from utils.exceptions import AppError, ConflictError, NotFoundError, ValidationError
from utils.validations import normalize_cpf, required_text, to_id, to_bool, normalize_email

SENHA_TAMANHO_MINIMO = 8

TAMANHO_MAXIMO_USERNAME = 100
TAMANHO_MAXIMO_NAME = 155
TAMANHO_MAXIMO_EMAIL = 255

def validate_password(data):
    senha = str(data.get('password') or "")

    if not senha.strip():
        raise ValidationError("A senha é obrigatória")

    if len(senha) < SENHA_TAMANHO_MINIMO:
        raise ValidationError(f"A senha deve ter no mínimo {SENHA_TAMANHO_MINIMO} caracteres")

    confirmacao = data.get('password_confirm')

    if confirmacao is not None and senha != confirmacao:
        raise ValidationError("As senhas informadas não são iguais")

    return senha

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
            if not data:
                raise ValidationError("Nenhum dado foi recebido para o usuário")

            username = required_text(data.get('username'), "username", TAMANHO_MAXIMO_USERNAME)
            name = required_text(data.get('name'), "nome", TAMANHO_MAXIMO_NAME)
            email = normalize_email(data.get('email'), TAMANHO_MAXIMO_EMAIL)
            role_id = to_id(data.get('role_id'), "cargo")
            sector_id = to_id(data.get('sector_id'), "setor")
            senha = validate_password(data)
            cpf = normalize_cpf(data.get('cpf'))

            role = RoleModel.get_by_id(role_id)
            if not role or not role.is_active:
                raise ValidationError("O cargo informado não existe ou está inativo")

            sector = SectorModel.get_by_id(sector_id)
            if not sector or not sector.is_active:
                raise ValidationError("O setor informado não existe ou está inativo")

            existing_user = UserModel.get_by_username(username)

            if existing_user:
                raise ConflictError(f"O usuário {username} já está cadastrado")

            # a coluna cpf é UNIQUE: sem esta checagem o CPF repetido voltaria como erro do banco
            user_with_cpf = UserModel.get_by_cpf(cpf)

            if user_with_cpf:
                raise ConflictError("O CPF informado já está cadastrado para outro usuário")

            user = User(
                username=username,
                name=name,
                password_hash=hash_password(senha),
                email=email,
                role_id=role_id,
                sector_id=sector_id,
                cpf=cpf
            )

            created_user = UserModel.create(user)

            return created_user
        except AppError:
            raise
        except Exception as e:
            raise Exception(str(e))

    # UPDATE de um usuário (não altera a senha)
    @staticmethod
    def update(user_id, data):
        try:
            existing_user = UserModel.get_by_id(user_id)

            if not existing_user:
                raise NotFoundError("Não existe nenhum usuário com o ID informado")

            if not data:
                raise ValidationError("Nenhum dado foi recebido para o usuário")

            username = required_text(data.get('username'), "username", TAMANHO_MAXIMO_USERNAME)
            name = required_text(data.get('name'), "nome", TAMANHO_MAXIMO_NAME)
            email = normalize_email(data.get('email'), TAMANHO_MAXIMO_EMAIL)
            role_id = to_id(data.get('role_id'), "cargo")
            sector_id = to_id(data.get('sector_id'), "setor")

            # CPF em branco não apaga o que já está gravado: é ele que preenche o bloco de
            # assinatura do intermediário no documento da entrevista qualificada. O campo é
            # opcional aqui só por causa dos usuários cadastrados antes da coluna existir.
            cpf = normalize_cpf(data.get('cpf')) or existing_user.cpf

            # chave ausente mantém o status atual, em vez de desativar o usuário sem querer
            is_active = to_bool(data.get('is_active', existing_user.is_active))

            # mesma checagem do create: sem cargo e setor válidos o usuário some dos GETs
            role = RoleModel.get_by_id(role_id)
            if not role or not role.is_active:
                raise ValidationError("O cargo informado não existe ou está inativo")

            sector = SectorModel.get_by_id(sector_id)
            if not sector or not sector.is_active:
                raise ValidationError("O setor informado não existe ou está inativo")

            # impede usar um username ou um CPF que já pertence a outro usuário
            user_with_username = UserModel.get_by_username(username)

            if user_with_username and user_with_username.id != user_id:
                raise ConflictError(f"O usuário {username} já está cadastrado")

            user_with_cpf = UserModel.get_by_cpf(cpf) if cpf else None

            if user_with_cpf and user_with_cpf.id != user_id:
                raise ConflictError("O CPF informado já está cadastrado para outro usuário")

            user = User(
                username=username,
                name=name,
                password_hash=None,
                email=email,
                role_id=role_id,
                sector_id=sector_id,
                is_active=is_active,
                id=user_id,
                cpf=cpf
            )

            updated_user = UserModel.update(user)

            return updated_user
        except AppError:
            raise
        except Exception as e:
            raise Exception(str(e))

    # DELETE de um usuário
    def delete(user_id):
        try:
            user = UserModel.get_by_id(user_id)

            if not user:
                raise NotFoundError("Não existe nenhum usuário com o ID informado")

            UserModel.delete(user_id)

            return True
        except AppError:
            raise
        except Exception as e:
            raise Exception(str(e))
