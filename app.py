import os
from flask import Flask
from dotenv import load_dotenv
from configs import config_all

def create_app():
    load_dotenv()
    
    app = Flask(__name__)
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')

    config_all(app)
    # liberar cors

    return app

if __name__ == '__main__':
    app = create_app()

    enviroment = os.getenv("FLASK_ENV", "develpment")

    if enviroment == "development":
        app.run(debug=True)
    else:
        # inicializar servidor waitress
        pass