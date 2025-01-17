import os
import subprocess

# Caminho do diretório do repositório Git
repo_dir = r"C:\Users\Rodolfo Santana\Documents\GitHub"

# Diretório a ser ignorado
ignore_dir = 'painel'

# Função para rodar comandos Git
def run_git_command(command):
    try:
        subprocess.run(command, check=True, shell=True)
    except subprocess.CalledProcessError as e:
        print(f"Erro ao executar o comando: {e}")
        return False
    return True

# Navegar até o diretório do repositório
os.chdir(repo_dir)

# Adicionar arquivos ao repositório, excluindo o diretório 'painel'
run_git_command("git add .")

# Certificar-se de que o diretório 'painel' está ignorado
gitignore_path = os.path.join(repo_dir, ".gitignore")

# Verifique se o arquivo .gitignore existe
if os.path.exists(gitignore_path):
    with open(gitignore_path, "r+") as gitignore:
        content = gitignore.read()
        if ignore_dir not in content:
            gitignore.write(f"\n{ignore_dir}/\n")
else:
    # Se o .gitignore não existir, crie um e adicione o diretório a ser ignorado
    with open(gitignore_path, "w") as gitignore:
        gitignore.write(f"{ignore_dir}/\n")

# Verifique se os arquivos estão realmente sendo adicionados
status = subprocess.run("git status", check=True, capture_output=True, text=True)
print("Status do Git:\n", status.stdout)

# Realizar o commit com uma mensagem personalizada
commit_message = input("Digite a mensagem de commit: ")
if not run_git_command(f"git commit -m \"{commit_message}\""):
    print("Erro no commit. Tente novamente.")
else:
    # Enviar as alterações para o repositório remoto
    if run_git_command("git push origin master"):
        print("Projeto enviado com sucesso para o GitHub!")
    else:
        print("Erro ao enviar para o GitHub.")
