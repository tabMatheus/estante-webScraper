"""Interface local para o catálogo gerado pelo scraper. Só usa a biblioteca padrão."""

import argparse
import csv
import errno
import io
import json
import math
import threading
import webbrowser
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parent
CSV_PATH = ROOT / "data" / "livros.csv"
FRONTEND = ROOT / "frontend"

# Os preços da fonte são fictícios. Estas taxas de referência mantêm a
# demonstração reproduzível e podem ser atualizadas em um único lugar.
BRL_CONVERSION_RATES = {
    "BRL": 1.0,
    "GBP": 7.30,
    "EUR": 6.20,
    "USD": 5.30,
}


def read_catalog(path=CSV_PATH):
    # Uma única leitura mantém a versão dos dados consistente durante a resposta.
    content = path.read_text(encoding="utf-8-sig")
    reader = csv.DictReader(io.StringIO(content, newline=""))
    required = {"titulo", "preco", "rating", "moeda", "pagina"}
    if not required.issubset(reader.fieldnames or []):
        raise ValueError("O CSV precisa das colunas titulo, preco, rating, moeda e pagina.")
    books = []
    for row in reader:
        try:
            title = row["titulo"].strip()
            price = float(row["preco"])
            rating = int(row["rating"])
            page = int(row["pagina"])
            currency = row["moeda"].strip().upper()
            if not title or not currency or not math.isfinite(price) or price < 0 or not 0 <= rating <= 5 or page < 1:
                raise ValueError
            exchange_rate = BRL_CONVERSION_RATES[currency]
        except (KeyError, ValueError, TypeError, AttributeError):
            raise ValueError(f"Dados inválidos na linha {reader.line_num} do CSV.") from None
        books.append({
            "title": title,
            "price": round(price * exchange_rate, 2),
            "currency": "BRL",
            "originalPrice": price,
            "originalCurrency": currency,
            "exchangeRate": exchange_rate,
            "rating": rating,
            "page": page,
        })
    return {"books": books, "updatedAt": datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat()}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # O terminal do VS Code pode ser fechado enquanto o processo continua.
        # Nesse caso, escrever em stderr quebra a resposta antes dos headers.
        try:
            super().log_message(format, *args)
        except OSError:
            pass

    def send_content(self, status, content, content_type):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(content)

    def send_json(self, status, payload):
        self.send_content(status, json.dumps(payload, ensure_ascii=False).encode("utf-8"), "application/json; charset=utf-8")

    def do_GET(self):
        route = urlsplit(self.path).path
        if route == "/api/books":
            try:
                self.send_json(200, read_catalog())
            except FileNotFoundError:
                self.send_json(404, {"error": "O arquivo data/livros.csv não foi encontrado. Execute a coleta e tente novamente."})
            except (ValueError, UnicodeError, csv.Error) as error:
                self.send_json(422, {"error": str(error)})
            except OSError:
                self.send_json(500, {"error": "Não foi possível ler o CSV. Verifique as permissões do arquivo."})
            return
        assets = {
            "/": ("index.html", "text/html; charset=utf-8"),
            "/styles.css": ("styles.css", "text/css; charset=utf-8"),
            "/app.js": ("app.js", "text/javascript; charset=utf-8"),
        }
        if route not in assets:
            self.send_json(404, {"error": "Página não encontrada."})
            return
        filename, content_type = assets[route]
        self.send_content(200, (FRONTEND / filename).read_bytes(), content_type)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Abra a interface do catálogo de livros.")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--open", action="store_true", help="Abre a interface no navegador.")
    args = parser.parse_args()
    try:
        server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    except OSError as error:
        if error.errno != errno.EADDRINUSE:
            raise
        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    address = f"http://127.0.0.1:{server.server_port}"
    print(f"Estante disponível em {address} — Ctrl+C para encerrar.", flush=True)
    if args.open:
        threading.Timer(0.3, webbrowser.open, args=(address,)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
