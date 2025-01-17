import os
import subprocess

# Caminho para o diretório do projeto
project_dir = r'C:\Users\Rodolfo Santana\Documents\GitHub'

# Caminho para a pasta a ser ignorada
ignore_dir = 'painel'

# Mudando para o diretório do projeto
os.chdir(project_dir)

# Criando ou ajustando o arquivo .gitignore
gitignore_path = os.path.join(project_dir, '.gitignore')

# Verificando se a pasta já está no .gitignore
with open(gitignore_path, 'r+') as gitignore:
    content = gitignore.read()
    if ignore_dir not in content:
        gitignore.write(f'\n{ignore_dir}/\n')

# Adicionando todos os arquivos ao git, exceto a pasta ignorada
subprocess.run(['git', 'add', '.'])

# Realizando o commit
commit_message = "Adicionando arquivos ao repositório"
subprocess.run(['git', 'commit', '-m', commit_message])

# Enviando os arquivos para o repositório remoto
subprocess.run(['git', 'push', 'origin', 'master'])

print("Projeto enviado para o GitHub com sucesso!")
