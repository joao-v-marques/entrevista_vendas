
class AppError(Exception):
    """Base de todo erro de negócio previsto da aplicação."""

class ValidationError(AppError, ValueError):
    """Faltou campo ou o corpo veio errado -> 400."""

class AuthError(AppError, ValueError):
    """Credencial inválida ou sessão que não vale mais -> 401"""

class NotFoundError(AppError):
    """O recurso pedido pelo id não existe -> 404."""

class ForbiddenError(AppError):
    """Autenticado, mas sem permissão -> 403."""

class ConflictError(AppError):
    """Estado atual do recuso não permite alteração -> 409."""
