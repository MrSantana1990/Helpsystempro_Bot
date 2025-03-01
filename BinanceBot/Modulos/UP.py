import os
import subprocess
import requests
import yaml
from dotenv import load_dotenv
import logging

# Configurar Logger
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Carregar configuração do repositório
def carregar_config():
    with open("configs/up_config.yml", "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

config = carregar_config()

# Carregar Token do GitHub (via env ou arquivo seguro)
load_dotenv("configs/keys.env")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")

# Função para rodar comandos Git
def run_git_command(command):
    try:
        subprocess.run(command, check=True, shell=True, cwd=config['repo_dir'])
        return True
    except subprocess.CalledProcessError as e:
        logger.error(f"Erro ao executar comando Git: {e}")
        return False

# Atualizar .gitignore automaticamente
def atualizar_gitignore():
    gitignore_path = os.path.join(config['repo_dir'], ".gitignore")
    if os.path.exists(gitignore_path):
        with open(gitignore_path, "r+") as gitignore:
            conteudo = gitignore.read()
            for ignore_dir in config['ignore_dirs']:
                if ignore_dir not in conteudo:
                    gitignore.write(f"\n{ignore_dir}/\n")
                    logger.info(f"Diretório '{ignore_dir}' adicionado ao .gitignore.")
    else:
        with open(gitignore_path, "w") as gitignore:
            for ignore_dir in config['ignore_dirs']:
                gitignore.write(f"{ignore_dir}/\n")
        logger.info(".gitignore criado e diretórios adicionados.")

# Alterar visibilidade do repositório
def change_repo_visibility(visibility):
    url = f"https://api.github.com/repos/{config['repo_name']}"
    data = {"private": visibility == '1'}
    headers = {"Authorization": f"token {GITHUB_TOKEN}"}

    response = requests.patch(url, json=data, headers=headers)
    if response.status_code == 200:
        logger.info(f"Repositório agora é {'Privado' if visibility == '1' else 'Público'}.")
    else:
        logger.error(f"Erro ao alterar visibilidade: {response.status_code} - {response.text}")

# Checar última versão do repositório
def checar_ultima_versao():
    url = f"https://api.github.com/repos/{config['repo_name']}/releases/latest"
    response = requests.get(url)
    if response.status_code == 200:
        versao = response.json().get('tag_name')
        logger.info(f"Última versão disponível no GitHub: {versao}")
    else:
        logger.warning("Não foi possível consultar a última versão no GitHub.")

# Processo principal de atualização
def executar_update():
    atualizar_gitignore()

    logger.info("Verificando status do repositório...")
    run_git_command("git status")

    opcao = input("Escolha uma opção:\n1 - Tornar repositório privado\n2 - Tornar repositório público\n3 - Realizar commit e push\n4 - Checar última versão\nOpção: ")

    if opcao in ['1', '2']:
        if not GITHUB_TOKEN:
            logger.error("GITHUB_TOKEN não encontrado. Adicione ao arquivo .env.")
            return
        change_repo_visibility(opcao)

    elif opcao == '3':
        commit_message = input("Digite a mensagem de commit: ")
        if run_git_command("git add ."):
            if run_git_command(f"git commit -m \"{commit_message}\""):
                if run_git_command("git push origin master"):
                    logger.info("Código enviado para o GitHub com sucesso.")
                else:
                    logger.error("Erro ao enviar código para o GitHub.")
            else:
                logger.error("Erro ao realizar commit.")
        else:
            logger.error("Erro ao adicionar arquivos.")

    elif opcao == '4':
        checar_ultima_versao()

    else:
        logger.warning("Opção inválida.")

if __name__ == "__main__":
    executar_update()
