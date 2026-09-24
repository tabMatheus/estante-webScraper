# Estante

Interface local para explorar os livros coletados em `data/livros.csv`.

## Abrir

No terminal, na pasta raiz do projeto:

```powershell
py -3 app.py --open
```

O navegador abre em `http://127.0.0.1:8000`. Mantenha o terminal aberto enquanto usar a página. Para encerrar, pressione `Ctrl+C`. No VS Code, escolha **Abrir interface Estante** em **Executar e Depurar** e pressione `F5`. A tarefa com o mesmo nome também está disponível em `Terminal` → `Executar Tarefa`.

Abra o endereço mostrado no terminal, que pode usar outra porta se a `8000` já estiver ocupada. Abrir `frontend/index.html` diretamente pelo explorador de arquivos não carrega o CSV; a página mostrará a instrução para iniciar o servidor.

A interface usa apenas a biblioteca padrão do Python. Ela lê o CSV a cada clique em **Atualizar**, então a nova coleta aparece sem reiniciar o servidor. Os favoritos ficam salvos no navegador. As capas são ilustrações tipográficas, pois o CSV não contém URLs de imagens.

Os preços da fonte são convertidos para reais pelo servidor antes de chegar à interface. Como o catálogo de demonstração usa valores fictícios, as taxas de referência ficam centralizadas em `BRL_CONVERSION_RATES`, no arquivo `app.py`. O cartão inteiro de cada livro abre a janela de detalhes; o mesmo comportamento funciona com as teclas `Enter` e `Espaço` quando o cartão está em foco.

Para refazer a coleta, execute `py -3 web-scraper/main.py` com as dependências de `web-scraper/requirements.txt` instaladas. O scraper grava sempre em `data/livros.csv`, independentemente da pasta de onde é executado.
