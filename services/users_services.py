from models.users_models import UserModel

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