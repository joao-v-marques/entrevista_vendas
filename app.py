import os
from flask import Flask
from dotenv import load_dotenv
from configs import config_all
from waitress import serve

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
        print("Servidor Waitress iniciado com sucesso...")
        serve(app, host='0.0.0.0', port=5000, threads=8)