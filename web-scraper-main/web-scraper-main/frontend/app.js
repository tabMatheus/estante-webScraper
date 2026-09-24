const $ = (selector) => document.querySelector(selector);
const state = {
  books: [],
  favorites: new Set(readFavorites()),
  favoritesOnly: false,
  query: '',
  rating: 0,
  pageFilter: 'all',
  currency: 'all',
  sort: 'original',
  page: 1,
  pageSize: 12,
  layout: 'grid',
};

const palettes = [
  {bg:'#e2e6d7',main:'#46624b',text:'#f8efdc',ink:'#99aa92'},
  {bg:'#eee2d7',main:'#ae755d',text:'#fff2dc',ink:'#caa78e'},
  {bg:'#dee7e5',main:'#4d6971',text:'#f1efe5',ink:'#8faeac'},
  {bg:'#e8e2d6',main:'#786d59',text:'#f5ebdb',ink:'#ab9c7d'},
  {bg:'#e8e3e9',main:'#695c74',text:'#f7edf0',ink:'#ad9dac'},
  {bg:'#ece6d2',main:'#b48a47',text:'#fff5d8',ink:'#bfae82'},
];

function readFavorites() {
  try { return JSON.parse(localStorage.getItem('estante.favorites') || '[]'); }
  catch { return []; }
}
function saveFavorites() {
  try { localStorage.setItem('estante.favorites', JSON.stringify([...state.favorites])); }
  catch { /* A coleção segue funcional se o navegador bloquear armazenamento. */ }
}
function bookKey(book) { return `${book.title}\u0000${book.page}`; }
function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'icon');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#i-${name}`);
  svg.append(use);
  return svg;
}
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function price(book) {
  try { return new Intl.NumberFormat('pt-BR', {style:'currency',currency:book.currency}).format(book.price); }
  catch { return `${book.currency} ${book.price.toFixed(2)}`; }
}
function originalPrice(book) {
  if (book.originalPrice === undefined || !book.originalCurrency) return '';
  try { return new Intl.NumberFormat('pt-BR', {style:'currency', currency:book.originalCurrency}).format(book.originalPrice); }
  catch { return `${book.originalCurrency} ${book.originalPrice.toFixed(2)}`; }
}
function palette(book) {
  let hash = 0;
  for (const char of book.title) hash = (hash * 31 + char.codePointAt(0)) >>> 0;
  return palettes[hash % palettes.length];
}
function cover(book) {
  const tones = palette(book);
  const outer = el('div', 'card-cover');
  outer.style.setProperty('--cover-bg', tones.bg);
  outer.style.setProperty('--cover-main', tones.main);
  outer.style.setProperty('--cover-text', tones.text);
  outer.style.setProperty('--cover-ink', tones.ink);
  outer.style.setProperty('--tilt', `${(book.title.length % 7) - 3}deg`);
  outer.append(el('span', 'cover-orbit'));
  const sheet = el('div', 'cover-sheet');
  sheet.append(el('span', 'cover-kicker', 'ESTANTE · LEITURAS'));
  sheet.append(el('strong', 'cover-title', book.title.split(' ').slice(0, 5).join(' ')));
  sheet.append(el('span', 'cover-ornament'), el('span', 'cover-footer', 'HISTÓRIAS PARA GUARDAR'));
  outer.append(sheet);
  return outer;
}
function card(book) {
  const card = el('article', 'book-card');
  card.tabIndex = 0;
  card.setAttribute('aria-label', `Abrir detalhes de ${book.title}`);
  card.addEventListener('click', event => {
    if (!event.target.closest('button')) openDetail(book);
  });
  card.addEventListener('keydown', event => {
    if (event.target === card && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      openDetail(book);
    }
  });
  const art = cover(book);
  art.append(el('span', 'card-tag', `PÁGINA ${book.page}`));
  const favorite = el('button', `favorite-button${state.favorites.has(bookKey(book)) ? ' saved' : ''}`);
  favorite.type = 'button';
  favorite.setAttribute('aria-label', state.favorites.has(bookKey(book)) ? `Remover ${book.title} da estante` : `Adicionar ${book.title} à estante`);
  favorite.setAttribute('aria-pressed', String(state.favorites.has(bookKey(book))));
  favorite.append(icon('heart'));
  favorite.addEventListener('click', () => toggleFavorite(book));
  art.append(favorite);
  card.append(art);

  const info = el('div', 'card-info');
  const meta = el('div', 'card-meta');
  meta.append(el('span', '', 'LIVRO'));
  const stars = el('span', 'card-rating');
  stars.append(icon('star'), document.createTextNode(`${book.rating}.0`));
  meta.append(stars);
  const title = el('h3', 'card-title', book.title);
  title.title = book.title;
  const bottom = el('div', 'card-bottom');
  bottom.append(el('strong', 'card-price', price(book)));
  const open = el('button', 'card-open', 'Ver detalhes');
  open.type = 'button';
  open.append(icon('arrow'));
  open.addEventListener('click', () => openDetail(book));
  bottom.append(open);
  info.append(meta, title, bottom);
  card.append(info);
  return card;
}
function filteredBooks() {
  const query = state.query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const matching = state.books.filter((book) => {
    const title = book.title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
    return (!query || title.includes(query)) && book.rating >= state.rating
      && (state.pageFilter === 'all' || book.page === Number(state.pageFilter))
      && (state.currency === 'all' || book.currency === state.currency)
      && (!state.favoritesOnly || state.favorites.has(bookKey(book)));
  });
  const compareTitle = (a, b) => a.title.localeCompare(b.title, 'pt-BR');
  if (state.sort === 'rating') matching.sort((a, b) => b.rating - a.rating || compareTitle(a,b));
  if (state.sort === 'price-asc') matching.sort((a, b) => a.price - b.price || compareTitle(a,b));
  if (state.sort === 'price-desc') matching.sort((a, b) => b.price - a.price || compareTitle(a,b));
  if (state.sort === 'title') matching.sort(compareTitle);
  return matching;
}
function renderStats() {
  const books = state.books;
  $('#stat-total').textContent = new Intl.NumberFormat('pt-BR').format(books.length);
  $('#stat-rating').textContent = new Intl.NumberFormat('pt-BR').format(books.filter(book => book.rating === 5).length);
  const cheapest = books.length ? books.reduce((lowest, book) => book.price < lowest.price ? book : lowest) : null;
  $('#stat-price').textContent = cheapest ? price(cheapest) : '—';
  $('#stat-currency').textContent = 'menor preço';
  $('#stat-pages').textContent = new Set(books.map(b => b.page)).size;
  $('#favorite-count').textContent = books.filter(b => state.favorites.has(bookKey(b))).length;
}
function renderPagination(totalPages) {
  const nav = $('#pagination');
  nav.replaceChildren();
  if (totalPages < 2) return;
  const add = (label, page, disabled, active=false) => {
    const button = el('button', active ? 'active' : '', label);
    button.type = 'button';
    button.disabled = disabled;
    button.setAttribute('aria-label', label === '‹' ? 'Página anterior' : label === '›' ? 'Próxima página' : `Página ${page}`);
    if (active) button.setAttribute('aria-current', 'page');
    button.addEventListener('click', () => { state.page = page; render(); $('#catalogo').scrollIntoView({block:'start'}); });
    nav.append(button);
  };
  add('‹', state.page - 1, state.page === 1);
  const start = Math.max(1, Math.min(state.page - 2, totalPages - 4));
  for (let page = start; page <= Math.min(totalPages, start + 4); page++) add(String(page), page, false, page === state.page);
  add('›', state.page + 1, state.page === totalPages);
}
function render() {
  renderStats();
  $('#nav-all').classList.toggle('active', !state.favoritesOnly);
  $('#nav-favorites').classList.toggle('active', state.favoritesOnly);
  $('#nav-all').setAttribute('aria-pressed', String(!state.favoritesOnly));
  $('#nav-favorites').setAttribute('aria-pressed', String(state.favoritesOnly));
  $('#catalog-title').innerHTML = state.favoritesOnly ? 'Minha estante<span>.</span>' : 'Explore a coleção<span>.</span>';
  const books = filteredBooks();
  const pages = Math.max(1, Math.ceil(books.length / state.pageSize));
  state.page = Math.min(state.page, pages);
  const slice = books.slice((state.page - 1) * state.pageSize, state.page * state.pageSize);
  const list = $('#books');
  list.classList.toggle('list-mode', state.layout === 'list');
  list.replaceChildren(...slice.map(card));
  list.setAttribute('aria-busy', 'false');
  $('#results-count').textContent = `${books.length} ${books.length === 1 ? 'livro encontrado' : 'livros encontrados'}`;
  $('#page-summary').textContent = books.length ? `Mostrando ${(state.page - 1) * state.pageSize + 1}–${Math.min(state.page * state.pageSize, books.length)} de ${books.length} livros` : '';
  const hasBookFilters = Boolean(state.query || state.rating || state.pageFilter !== 'all' || state.currency !== 'all');
  const hasFilters = hasBookFilters || state.favoritesOnly;
  $('#clear-filters').hidden = !hasFilters;
  const message = $('#message');
  message.hidden = books.length > 0;
  if (!books.length) message.textContent = state.favoritesOnly && !hasBookFilters ? 'Sua estante está vazia. Salve os livros que despertarem sua curiosidade.' : 'Nenhum livro encontrado. Tente outra busca ou limpe os filtros.';
  renderPagination(pages);
  $('#export').disabled = books.length === 0;
}
function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { toast.hidden = true; }, 3000);
}
function toggleFavorite(book) {
  const key = bookKey(book);
  if (state.favorites.has(key)) state.favorites.delete(key);
  else state.favorites.add(key);
  saveFavorites();
  render();
  showToast(state.favorites.has(key) ? 'Livro salvo na sua estante.' : 'Livro removido da sua estante.');
}
function openDetail(book) {
  const content = $('#detail-content');
  const layout = el('div', 'detail-layout');
  layout.append(cover(book));
  const info = el('div');
  info.append(el('span', 'detail-eyebrow', `Livro · Página ${book.page} da coleta`));
  const title = el('h2', '', book.title);
  title.id = 'detail-title';
  info.append(title, el('div', 'detail-rating', `${'★'.repeat(book.rating)}${'☆'.repeat(5-book.rating)}  ${book.rating} de 5 estrelas`), el('div', 'detail-price', price(book)));
  const facts = el('dl', 'detail-facts');
  const addFact = (label, value) => facts.append(el('dt', '', label), el('dd', '', value));
  addFact('Preço original', originalPrice(book) || 'Não informado');
  addFact('Conversão utilizada', book.originalCurrency === 'BRL' ? 'Valor original em reais' : `1 ${book.originalCurrency} = ${new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'}).format(book.exchangeRate)}`);
  addFact('Página da coleta', String(book.page));
  info.append(facts, el('p', 'detail-description', 'Valor convertido para reais com a taxa de referência do projeto.'));
  const favorite = el('button', 'dialog-action', state.favorites.has(bookKey(book)) ? 'Remover da minha estante' : 'Salvar na minha estante');
  favorite.type = 'button';
  favorite.addEventListener('click', () => { toggleFavorite(book); favorite.textContent = state.favorites.has(bookKey(book)) ? 'Remover da minha estante' : 'Salvar na minha estante'; });
  info.append(favorite);
  layout.append(info);
  content.replaceChildren(layout);
  $('#book-dialog').showModal();
}
function updateOptions() {
  const pages = [...new Set(state.books.map(book => book.page))].sort((a,b) => a-b);
  const pageSelect = $('#source-page');
  pageSelect.replaceChildren(new Option('Todas as páginas','all'), ...pages.map(page => new Option(`Página ${page}`, String(page))));
  if (!pages.includes(Number(state.pageFilter))) state.pageFilter = 'all';
  pageSelect.value = state.pageFilter;
  const currencies = [...new Set(state.books.map(book => book.currency))].sort();
  const currencySelect = $('#currency');
  currencySelect.replaceChildren(new Option('Todas','all'), ...currencies.map(currency => new Option(currency,currency)));
  if (!currencies.includes(state.currency)) state.currency = 'all';
  currencySelect.value = state.currency;
  $('#currency-field').hidden = currencies.length < 2;
}
async function loadBooks() {
  const button = $('#refresh');
  button.disabled = true;
  try {
    if (location.protocol === 'file:') {
      throw new Error('Abra a interface pelo servidor: na pasta do projeto, execute py -3 app.py --open.');
    }
    const response = await fetch('/api/books', {cache:'no-store'});
    if (!response.headers.get('Content-Type')?.includes('application/json')) {
      throw new Error('Esta página precisa do servidor do projeto. Execute py -3 app.py --open.');
    }
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Não foi possível carregar o catálogo.');
    state.books = payload.books;
    updateOptions();
    render();
    $('#updated-at').textContent = `Atualizado em ${new Intl.DateTimeFormat('pt-BR', {dateStyle:'short', timeStyle:'short'}).format(new Date(payload.updatedAt))}`;
    if (!state.books.length) {
      $('#message').hidden = false;
      $('#message').textContent = 'O CSV está vazio. Execute a coleta para preencher o catálogo.';
    }
    return true;
  } catch (error) {
    state.books = [];
    render();
    $('#message').hidden = false;
    $('#message').textContent = error.message || 'Não foi possível carregar o catálogo.';
    $('#results-count').textContent = 'Coleção indisponível';
    return false;
  } finally { button.disabled = false; }
}
function exportSelection() {
  const books = filteredBooks();
  if (!books.length) return;
  const quote = value => `"${String(value).replaceAll('"','""')}"`;
  const rows = [['titulo','preco_brl','moeda','preco_original','moeda_original','rating','pagina'].join(',')];
  for (const book of books) rows.push([quote(book.title), book.price.toFixed(2), book.currency, book.originalPrice.toFixed(2), book.originalCurrency, book.rating, book.page].join(','));
  const blob = new Blob(['\ufeff', rows.join('\r\n'), '\r\n'], {type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'livros-selecionados.csv';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast(`${books.length} ${books.length === 1 ? 'livro exportado' : 'livros exportados'}.`);
}

function resetCatalogFilters() {
  state.query = '';
  state.rating = 0;
  state.pageFilter = 'all';
  state.currency = 'all';
  state.favoritesOnly = false;
  state.page = 1;
  $('#search').value = '';
  $('#rating').value = '0';
  $('#source-page').value = 'all';
  $('#currency').value = 'all';
}

function showCatalogSelection(message) {
  render();
  $('#catalogo').scrollIntoView({block:'start', behavior:'smooth'});
  showToast(message);
}

$('#search').addEventListener('input', event => { state.query = event.target.value.trim(); state.page = 1; render(); });
$('#rating').addEventListener('change', event => { state.rating = Number(event.target.value); state.page = 1; render(); });
$('#source-page').addEventListener('change', event => { state.pageFilter = event.target.value; state.page = 1; render(); });
$('#currency').addEventListener('change', event => { state.currency = event.target.value; state.page = 1; render(); });
$('#sort').addEventListener('change', event => { state.sort = event.target.value; state.page = 1; render(); });
$('#refresh').addEventListener('click', () => { loadBooks().then(ok => { if (ok) showToast('Coleção atualizada.'); }); });
$('#export').addEventListener('click', exportSelection);
$('#nav-all').addEventListener('click', () => { state.favoritesOnly = false; state.page = 1; render(); });
$('#nav-favorites').addEventListener('click', () => { state.favoritesOnly = true; state.page = 1; render(); $('#catalogo').scrollIntoView({block:'start'}); });
$('#clear-filters').addEventListener('click', () => {
  resetCatalogFilters();
  render();
});
$('#stat-five-stars').addEventListener('click', () => {
  resetCatalogFilters();
  state.rating = 5;
  state.sort = 'rating';
  $('#rating').value = '5';
  $('#sort').value = 'rating';
  showCatalogSelection('Exibindo somente os livros com 5 estrelas.');
});
$('#stat-lowest-price').addEventListener('click', () => {
  resetCatalogFilters();
  state.sort = 'price-asc';
  $('#sort').value = 'price-asc';
  showCatalogSelection('Livros ordenados do menor para o maior preço.');
});
for (const layout of ['grid','list']) $('#view-' + layout).addEventListener('click', () => {
  state.layout = layout;
  for (const mode of ['grid','list']) {
    $('#view-' + mode).classList.toggle('active', mode === layout);
    $('#view-' + mode).setAttribute('aria-pressed', String(mode === layout));
  }
  render();
});
$('#close-dialog').addEventListener('click', () => $('#book-dialog').close());
$('#book-dialog').addEventListener('click', event => { if (event.target === $('#book-dialog')) $('#book-dialog').close(); });
document.addEventListener('keydown', event => {
  if (event.key === '/' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName) && !$('#book-dialog').open) {
    event.preventDefault(); $('#search').focus();
  }
});
loadBooks();
