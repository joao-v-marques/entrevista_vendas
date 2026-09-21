import os
from flask import Flask, jsonify
from dotenv import load_dotenv
from configs import config_all
from waitress import serve

# Tamanho máximo do corpo de uma requisição (upload de documentos + campos do form).
# Requisições acima disso são recusadas com 413 antes de sobrecarregar o servidor.
MAX_CONTENT_LENGTH = 21 * 1024 * 1024  # 21 MB (20 MB de arquivos + folga p/ os demais campos)

def create_app():
    load_dotenv()

    app = Flask(__name__)
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
    app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH

    config_all(app)
    # liberar cors

    # Uploads acima do limite disparam 413; respondemos em JSON para o front tratar
    # a mensagem (sem isso, o Flask devolveria um HTML que o fetch não sabe exibir).
    @app.errorhandler(413)
    def handle_request_entity_too_large(error):
        return jsonify({
            "message": "Os documentos anexados excedem o tamanho máximo permitido (20 MB no total). Reduza os arquivos e tente novamente."
        }), 413

    return app

if __name__ == '__main__':
    app = create_app()

    enviroment = os.getenv("FLASK_ENV", "develpment")

    if enviroment == "development":
        app.run(debug=True)
    else:
        print("Servidor Waitress iniciado com sucesso...")
        serve(app, host='127.0.0.1', port=5005, threads=8)