import os
import subprocess
import requests
import yaml
import logging
from dotenv import load_dotenv

# Configurar Logger
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Carregar configuração do repositório
def carregar_config():
    config_path = os.path.join("Configs", "up_config.yml")
    with open(config_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

config = carregar_config()

# Carregar Token do GitHub (via env ou arquivo seguro)
dotenv_path = os.path.join("Configs", "key.env")
load_dotenv(dotenv_path)

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")

if not GITHUB_TOKEN:
    raise ValueError("❌ GITHUB_TOKEN não configurado corretamente no arquivo key.env")

# Função para rodar comandos Git
def rodar_comando(comando, erro_msg):
    try:
        resultado = subprocess.run(comando, shell=True, check=True, capture_output=True, text=True)
        logger.info(resultado.stdout)
        return resultado.stdout
    except subprocess.CalledProcessError as e:
        logger.error(f"{erro_msg}: {e.stderr}")
        raise

# Função para realizar commit e push
def realizar_commit_push():
    mensagem_commit = input("Digite a mensagem de commit: ")

    rodar_comando(f'git add .', "Erro ao adicionar arquivos")
    rodar_comando(f'git commit -m "{mensagem_commit}"', "Erro ao realizar commit")

    try:
        rodar_comando("git push origin master", "Erro ao enviar código para o GitHub")
    except subprocess.CalledProcessError:
        logger.warning("⚠️ Falha no push. Tentando git pull --rebase para corrigir...")
        rodar_comando("git pull --rebase origin master", "Erro ao realizar pull --rebase")
        rodar_comando("git push origin master", "Erro ao enviar código para o GitHub após rebase")

# Menu de opções
def menu():
    print("Escolha uma opção:")
    print("1 - Tornar repositório privado")
    print("2 - Tornar repositório público")
    print("3 - Realizar commit e push")
    print("4 - Checar última versão")

    opcao = input("Opção: ")

    if opcao == "1":
        alterar_privacidade_repo(True)
    elif opcao == "2":
        alterar_privacidade_repo(False)
    elif opcao == "3":
        realizar_commit_push()
    elif opcao == "4":
        checar_ultima_versao()
    else:
        print("Opção inválida.")

# Função para alterar privacidade do repositório
def alterar_privacidade_repo(privado):
    api_url = f"https://api.github.com/repos/{config['github']['usuario']}/{config['github']['repositorio']}"
    headers = {"Authorization": f"token {GITHUB_TOKEN}"}

    response = requests.patch(api_url, json={"private": privado}, headers=headers)

    if response.status_code == 200:
        logger.info(f"Repositório {'privado' if privado else 'público'} com sucesso.")
    else:
        logger.error(f"Erro ao alterar privacidade: {response.text}")

# Função para checar última versão (git fetch + log simplificado)
def checar_ultima_versao():
    rodar_comando("git fetch origin", "Erro ao buscar atualizações do repositório")
    rodar_comando("git log origin/master -n 1", "Erro ao obter última versão")

if __name__ == "__main__":
    menu()
