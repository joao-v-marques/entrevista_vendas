import re

from models.users_models import UserModel, User
from models.roles_models import RoleModel
from models.sectors_models import SectorModel
from utils.security import hash_password
from utils.exceptions import AppError, ConflictError, NotFoundError, ValidationError

SENHA_TAMANHO_MINIMO = 8

TAMANHO_MAXIMO_USERNAME = 100
TAMANHO_MAXIMO_NAME = 155
TAMANHO_MAXIMO_EMAIL = 255

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def normalize_cpf(cpf):
    digits = re.sub(r"\D", "", str(cpf or ""))

    if not digits:
        return None

    if len(digits) != 11:
        raise ValidationError("O CPF informado deve conter 11 dígitos")

    return digits


def texto_obrigatorio(value, field_name, tamanho_maximo):
    texto = str(value or "").strip()

    if not texto:
        raise ValidationError(f"O campo {field_name} é obrigatório")

    if len(texto) > tamanho_maximo:
        raise ValidationError(f"O campo {field_name} deve ter no máximo {tamanho_maximo} caracteres")

    return texto


def texto_opcional(value, field_name, tamanho_maximo):
    texto = str(value or "").strip()

    if not texto:
        return None

    if len(texto) > tamanho_maximo:
        raise ValidationError(f"O campo {field_name} deve ter no máximo {tamanho_maximo} caracteres")

    return texto


def normalize_email(value):
    email = texto_opcional(value, "e-mail", TAMANHO_MAXIMO_EMAIL)

    if email and not EMAIL_REGEX.match(email):
        raise ValidationError("O e-mail informado é inválido")

    return email


def to_id(value, field_name):
    if value is None or str(value).strip() == '':
        raise ValidationError(f"O campo {field_name} é obrigatório")

    try:
        return int(value)
    except (TypeError, ValueError):
        raise ValidationError(f"O campo {field_name} precisa ser um número inteiro válido")


def to_bool(value):
    if isinstance(value, bool):
        return value

    if value is None:
        return False

    return str(value).strip().lower() in ('true', '1', 'sim', 'on', 'yes')


def valida_senha(data):
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

            username = texto_obrigatorio(data.get('username'), "username", TAMANHO_MAXIMO_USERNAME)
            name = texto_obrigatorio(data.get('name'), "nome", TAMANHO_MAXIMO_NAME)
            email = normalize_email(data.get('email'))
            role_id = to_id(data.get('role_id'), "cargo")
            sector_id = to_id(data.get('sector_id'), "setor")
            senha = valida_senha(data)
            cpf = normalize_cpf(data.get('cpf'))

            if not RoleModel.get_by_id(role_id):
                raise ValidationError("O cargo informado não existe")

            if not SectorModel.get_by_id(sector_id):
                raise ValidationError("O setor informado não existe")

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

            username = texto_obrigatorio(data.get('username'), "username", TAMANHO_MAXIMO_USERNAME)
            name = texto_obrigatorio(data.get('name'), "nome", TAMANHO_MAXIMO_NAME)
            email = normalize_email(data.get('email'))
            role_id = to_id(data.get('role_id'), "cargo")
            sector_id = to_id(data.get('sector_id'), "setor")

            # CPF em branco não apaga o que já está gravado: é ele que preenche o bloco de
            # assinatura do intermediário no documento da entrevista qualificada. O campo é
            # opcional aqui só por causa dos usuários cadastrados antes da coluna existir.
            cpf = normalize_cpf(data.get('cpf')) or existing_user.cpf

            # chave ausente mantém o status atual, em vez de desativar o usuário sem querer
            is_active = to_bool(data.get('is_active', existing_user.is_active))

            # mesma checagem do create: sem cargo e setor válidos o usuário some dos GETs
            if not RoleModel.get_by_id(role_id):
                raise ValidationError("O cargo informado não existe")

            if not SectorModel.get_by_id(sector_id):
                raise ValidationError("O setor informado não existe")

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
