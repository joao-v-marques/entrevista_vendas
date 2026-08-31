import re
import math
from utils.exceptions import ValidationError

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

def normalize_cpf(cpf):
    digits = re.sub(r"\D", "", str(cpf or ""))

    if not digits:
        return None

    if len(digits) != 11:
        raise ValidationError("O CPF informado deve conter 11 dígitos")

    return digits

def required_text(value, field_name, max_size):
    text = str(value or "").strip()

    if not text:
        raise ValidationError(f"O campo {field_name} é obrigatório")

    if len(text) > max_size:
        raise ValidationError(f"O campo {field_name} deve ter no máximo {max_size} caracteres")

    return text

def optional_text(value, field_name, max_size):
    text = str(value or "").strip()

    if not text:
        return None

    if len(text) > max_size:
        raise ValidationError(f"O campo {field_name} deve ter no máximo {max_size} caracteres")

    return text

def normalize_email(value, max_size):
    email = optional_text(value, "e-mail", max_size)

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

# Campos numéricos chegam como int, float ou string dependendo do front
def to_number(value, field_name):
    if value is None or str(value).strip() == '':
        raise ValidationError(f"O campo {field_name} é obrigatório")

    try:
        number = float(str(value).strip().replace(',', '.'))
    except ValueError:
        raise ValidationError(f"O campo {field_name} precisa ser um número válido")

    # float() aceita "nan", "inf" e "-inf": não são números utilizáveis e o nan
    # ainda escapa de qualquer comparação de faixa, passando batido pelas validações
    if not math.isfinite(number):
        raise ValidationError(f"O campo {field_name} precisa ser um número válido")

    return number

def to_bool(value):
    if isinstance(value, bool):
        return value

    if value is None:
        return False

    return str(value).strip().lower() in ('true', '1', 'sim', 'on', 'yes')