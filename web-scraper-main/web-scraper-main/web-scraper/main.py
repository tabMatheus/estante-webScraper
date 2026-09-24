from pathlib import Path
import requests
from bs4 import BeautifulSoup
import pandas as pd
import re

url = "http://books.toscrape.com/"
data_dir = Path(__file__).resolve().parent.parent / "data"

response = requests.get(url)

if response.status_code == 200:
    soup = BeautifulSoup(response.text, "html.parser")

    livros = soup.find_all("article", class_="product_pod")

    dados = []

    data_dir.mkdir(exist_ok=True)

    mapa_rating = {
        "One": 1,
        "Two": 2,
        "Three": 3,
        "Four": 4,
        "Five": 5
    }

    base_url = "http://books.toscrape.com/catalogue/page-{}.html"

    for pagina in range(1, 6):
        url = base_url.format(pagina)
        print(f"🔎 Coletando página {pagina}...")

        response = requests.get(url)

        if response.status_code != 200:
            print(f"❌ Erro na página {pagina}")
            continue

        soup = BeautifulSoup(response.text, "html.parser")
        livros = soup.find_all("article", class_="product_pod")



        for livro in livros:
            titulo = livro.h3.a["title"]
            
            preco_texto = livro.find("p", class_="price_color").text

            # extrair símbolo (qualquer coisa que não seja número ou ponto)
            simbolo = re.sub(r"[0-9.,\s]", "", preco_texto)

            # pegar só o último caractere válido
            simbolo = simbolo[-1] if simbolo else ""

            mapa_moeda = {
                "£": "GBP",
                "$": "USD",
                "€": "EUR",
                "R": "BRL"
            }

            moeda = mapa_moeda.get(simbolo, "UNKNOWN")

            #limpar preço (remover tudo que não seja número ou ponto)
            preco_limpo = re.sub(r"[^\d.]", "", preco_texto)
            preco = float(preco_limpo)

            # extrair rating
            rating_class = livro.find("p", class_="star-rating")["class"]
            rating = mapa_rating.get(rating_class[1], 0)


            dados.append({
                "titulo": titulo,
                "preco": preco,
                "rating": rating,
                "moeda": moeda,
                "pagina": pagina

            })

    df = pd.DataFrame(dados)
    
    df.to_csv(data_dir / "livros.csv", index=False, encoding="utf-8-sig")

    print("✅ Dados salvos com sucesso!")

else:
    print("❌ Erro ao acessar o site")


    #--ESTRUTURA--#

    # imports
    # config (url, pasta, mapa)

    # loop de páginas
    # loop de livros
        # extrair dados
        # salvar
