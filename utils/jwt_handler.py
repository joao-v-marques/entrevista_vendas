import jwt, os
from datetime import datetime, timedelta

def generated_token(user):
    payload = {
        "id": user.id,
        "username": user.username,
        "role_description": user.role,
        "maintenance_group_id": user.maintenance_group_id,
        "maintenance_group": user.maintenance_group,
        "exp": datetime.utcnow() + timedelta(hours=8)
    }

    token = jwt.encode(
        payload,
        os.getenv("SECRET_KEY"),
        algorithm="HS256"
    )

    return token