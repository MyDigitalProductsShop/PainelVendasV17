const STORAGE_KEY = 'controle_bicicletas_v3';
const OLD_KEY = 'controle_bicicletas_v2';

let db = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');

if (!db) {
  const old = JSON.parse(localStorage.getItem(OLD_KEY) || 'null');

  db = {
    aprovacoes: [],
    vendas: [],
    recebimentos: [],
    montagens: []
  };

  if (old && Array.isArray(old.clientes)) {
    db.vendas = old.clientes.map(c => ({
      ...c,
      vendedor: c.vendedor || 'Não informado',
      aprovacaoId: null,
      vendidoEm: c.criadoEm || new Date().toISOString()
    }));

    db.recebimentos = (old.recebimentos || []).map(r => ({
      ...r,
      vendedor: r.vendedor || 'Não informado'
    }));
  }
}

db.aprovacoes = Array.isArray(db.aprovacoes) ? db.aprovacoes : [];
db.vendas = Array.isArray(db.vendas) ? db.vendas : [];
db.recebimentos = Array.isArray(db.recebimentos) ? db.recebimentos : [];
db.montagens = Array.isArray(db.montagens) ? db.montagens : [];


/* ======================================================
   CONFIGURAÇÕES
====================================================== */

db.config = db.config && typeof db.config === 'object'
  ? db.config
  : {};

db.config.vendedores = Array.isArray(db.config.vendedores)
  ? db.config.vendedores
  : [];

db.config.marcas = Array.isArray(db.config.marcas)
  ? db.config.marcas
  : [];

db.config.numeracoes = Array.isArray(db.config.numeracoes)
  ? db.config.numeracoes
  : [];

db.config.especificacoes = Array.isArray(db.config.especificacoes)
  ? db.config.especificacoes
  : ['Bicicleta Aro 29 Alumínio'];


const uniqCfg = arr =>
  [...new Set(
    arr
      .map(x => String(x || '').trim())
      .filter(Boolean)
  )].sort((a, b) =>
    a.localeCompare(b, 'pt-BR', {
      numeric: true,
      sensitivity: 'base'
    })
  );


db.config.vendedores = uniqCfg([
  ...db.config.vendedores,
  ...db.aprovacoes.map(x => x.vendedor),
  ...db.vendas.map(x => x.vendedor)
]);

db.config.marcas = uniqCfg([
  ...db.config.marcas,
  ...db.vendas.map(x => x.marca),
  ...db.montagens.map(x => x.marca)
]);

db.config.numeracoes = uniqCfg([
  ...db.config.numeracoes,
  ...db.vendas.map(x => x.numeracao),
  ...db.montagens.map(x => x.numeracao)
]);

db.config.especificacoes = uniqCfg([
  'Bicicleta Aro 29 Alumínio',
  ...db.config.especificacoes,
  ...db.vendas.map(x => x.especificacaoQuadro)
]);


let ultimaMontagemImpressao = null;
let vendaPagamentoId = null;
let ultimaVendaImpressao = null;


/* ======================================================
   FUNÇÕES BÁSICAS
====================================================== */

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const money = v =>
  Number(v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });

const hojeISO = () => {
  const d = new Date();

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const fmtDate = iso =>
  iso
    ? new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR')
    : '-';

const save = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  renderAll();
};

const parseMoney = s =>
  Number(
    String(s)
      .replace(/[R$\s]/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
  ) || 0;

const esc = s =>
  String(s ?? '').replace(
    /[&<>"']/g,
    m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[m])
  );


/* ======================================================
   BICICLETAS DA VENDA
====================================================== */

function optionsHtml(itens, placeholder, selected = '') {
  return `
    <option value="">${esc(placeholder)}</option>
    ${itens.map(x =>
      `<option value="${esc(x)}" ${x === selected ? 'selected' : ''}>
        ${esc(x)}
      </option>`
    ).join('')}
  `;
}


function bikeVendaHtml(b = {}, idx = 0) {
  return `
    <div class="sale-bike-card" data-bike-index="${idx}">

      <div class="sale-bike-head">

        <div>
          <span class="bike-number">Bicicleta ${idx + 1}</span>
          <small>Preencha os dados desta bicicleta</small>
        </div>

        <button
          type="button"
          class="remove-bike"
          title="Remover bicicleta"
        >
          ×
        </button>

      </div>

      <div class="sale-bike-grid">

        <div class="field full">
          <label>Especificação</label>

          <select class="bike-especificacao">
            ${optionsHtml(
              db.config.especificacoes,
              'Selecione uma especificação...',
              b.especificacaoQuadro || ''
            )}
          </select>
        </div>

        <div class="field">

          <label>Marca</label>

          <select class="bike-marca">
            ${optionsHtml(
              db.config.marcas,
              'Selecione uma marca...',
              b.marca || ''
            )}
          </select>

        </div>

        <div class="field">

          <label>Cor</label>

          <input
            type="text"
            class="bike-cor"
            placeholder="Ex.: Azul fosco"
            value="${esc(b.cor || '')}"
          />

        </div>

        <div class="field">

          <label>Numeração / altura</label>

          <select class="bike-numeracao">
            ${optionsHtml(
              db.config.numeracoes,
              'Selecione uma numeração...',
              b.numeracao || ''
            )}
          </select>

        </div>

        <div class="field">

          <label>Quantidade</label>

          <input
            type="number"
            class="bike-quantidade"
            min="1"
            value="${Math.max(1, Number(b.quantidade || 1))}"
          />

        </div>

      </div>

    </div>
  `;
}


function renderBicicletasVenda(itens = [{}]) {

  const box = $('#vBikesContainer');

  if (!box) return;

  const list = itens.length ? itens : [{}];

  box.innerHTML = list
    .map((b, i) => bikeVendaHtml(b, i))
    .join('');

  atualizarBotoesRemoverBike();
  atualizarQuantidadeBikes();
}


function atualizarBotoesRemoverBike() {

  const cards = $$('.sale-bike-card');

  cards.forEach((card, i) => {

    const b = card.querySelector('.remove-bike');

    if (!b) return;

    b.disabled = cards.length === 1;

    b.onclick = () => {

      card.remove();

      renumerarBikes();

    };

  });
}


function renumerarBikes() {

  $$('.sale-bike-card').forEach((card, i) => {

    card.dataset.bikeIndex = i;

    const n = card.querySelector('.bike-number');

    if (n) {
      n.textContent = `Bicicleta ${i + 1}`;
    }

  });

  atualizarBotoesRemoverBike();
  atualizarQuantidadeBikes();
}


function coletarBicicletasVenda() {

  return $$('.sale-bike-card').map(card => ({

    especificacaoQuadro:
      card.querySelector('.bike-especificacao')?.value.trim() || '',

    marca:
      card.querySelector('.bike-marca')?.value.trim() || '',

    cor:
      card.querySelector('.bike-cor')?.value.trim() || '',

    numeracao:
      card.querySelector('.bike-numeracao')?.value.trim() || '',

    quantidade:
      Math.max(
        1,
        Number(
          card.querySelector('.bike-quantidade')?.value || 1
        )
      )

  }));
}


function atualizarQuantidadeBikes() {

  const el = $('#vBicicletas');

  if (!el) return;

  el.value =
    coletarBicicletasVenda()
      .reduce((s, b) => s + b.quantidade, 0) || 1;
}


function atualizarSelectsBicicletasVenda() {

  $$('.sale-bike-card').forEach(card => {

    const e = card.querySelector('.bike-especificacao');
    const m = card.querySelector('.bike-marca');
    const n = card.querySelector('.bike-numeracao');

    if (e) {

      const v = e.value;

      e.innerHTML = optionsHtml(
        db.config.especificacoes,
        'Selecione uma especificação...',
        v
      );

    }

    if (m) {

      const v = m.value;

      m.innerHTML = optionsHtml(
        db.config.marcas,
        'Selecione uma marca...',
        v
      );

    }

    if (n) {

      const v = n.value;

      n.innerHTML = optionsHtml(
        db.config.numeracoes,
        'Selecione uma numeração...',
        v
      );

    }

  });
}


function bicicletasDaVenda(v) {

  if (
    Array.isArray(v.bicicletasItens) &&
    v.bicicletasItens.length
  ) {
    return v.bicicletasItens;
  }

  return [{
    especificacaoQuadro: v.especificacaoQuadro || '',
    marca: v.marca || '',
    cor: v.cor || '',
    numeracao: v.numeracao || '',
    quantidade: Number(v.bicicletas || 1)
  }];
}


function quantidadeBicicletasVenda(v) {

  return bicicletasDaVenda(v)
    .reduce(
      (s, b) =>
        s + Math.max(1, Number(b.quantidade || 1)),
      0
    );
}


function bikesTexto(v) {

  return bicicletasDaVenda(v)
    .map((b, i) =>
      `Bicicleta ${i + 1}: ${b.especificacaoQuadro || '-'} | Marca: ${b.marca || '-'} | Cor: ${b.cor || '-'} | Numeração: ${b.numeracao || '-'} | Qtd.: ${b.quantidade || 1}`
    )
    .join('\n');
}


function bikesResultadoHtml(v) {

  return bicicletasDaVenda(v)
    .map((b, i) => `
      <div class="bike-summary-row">

        <strong>Bicicleta ${i + 1}</strong>

        <span>
          ${esc(b.especificacaoQuadro || '-')}
          • ${esc(b.marca || '-')}
          • ${esc(b.cor || '-')}
          • Tam. ${esc(b.numeracao || '-')}
          • Qtd. ${b.quantidade || 1}
        </span>

      </div>
    `)
    .join('');
}


/* ======================================================
   CONFIGURAÇÕES
====================================================== */

function preencherSelectConfig(
  selector,
  itens,
  placeholder
) {

  const el = $(selector);

  if (!el) return;

  const atual = el.value;

  el.innerHTML = `
    <option value="">${placeholder}</option>
    ${itens.map(x =>
      `<option value="${esc(x)}">${esc(x)}</option>`
    ).join('')}
  `;

  if (itens.includes(atual)) {
    el.value = atual;
  }
}


function renderConfigSelections() {

  preencherSelectConfig(
    '#aVendedor',
    db.config.vendedores,
    'Selecione um vendedor...'
  );

  preencherSelectConfig(
    '#vVendedor',
    db.config.vendedores,
    'Selecione um vendedor...'
  );

  preencherSelectConfig(
    '#mMarca',
    db.config.marcas,
    'Selecione uma marca...'
  );

  preencherSelectConfig(
    '#mNumeracao',
    db.config.numeracoes,
    'Selecione uma numeração...'
  );

  atualizarSelectsBicicletasVenda();
}


function configChip(tipo, valor) {

  return `
    <div class="config-chip">

      <span>${esc(valor)}</span>

      <button
        type="button"
        title="Excluir"
        onclick="excluirConfig(
          '${tipo}',
          decodeURIComponent(
            '${encodeURIComponent(valor).replace(/'/g, '%27')}'
          )
        )"
      >
        ×
      </button>

    </div>
  `;
}


function renderConfiguracoes() {

  renderConfigSelections();

  const lv = $('#listaVendedores');
  const lm = $('#listaMarcas');
  const ln = $('#listaNumeracoes');
  const le = $('#listaEspecificacoes');

  if (lv) {
    lv.innerHTML =
      db.config.vendedores
        .map(v => configChip('vendedores', v))
        .join('') ||
      '<p class="config-empty">Nenhum vendedor cadastrado.</p>';
  }

  if (lm) {
    lm.innerHTML =
      db.config.marcas
        .map(v => configChip('marcas', v))
        .join('') ||
      '<p class="config-empty">Nenhuma marca cadastrada.</p>';
  }

  if (ln) {
    ln.innerHTML =
      db.config.numeracoes
        .map(v => configChip('numeracoes', v))
        .join('') ||
      '<p class="config-empty">Nenhuma numeração cadastrada.</p>';
  }

  if (le) {
    le.innerHTML =
      db.config.especificacoes
        .map(v => configChip('especificacoes', v))
        .join('') ||
      '<p class="config-empty">Nenhuma especificação cadastrada.</p>';
  }
}


function adicionarConfig(tipo, valor) {

  valor = String(valor || '').trim();

  if (!valor) return;

  if (
    db.config[tipo].some(
      x =>
        x.toLocaleLowerCase('pt-BR') ===
        valor.toLocaleLowerCase('pt-BR')
    )
  ) {

    alert('Esta opção já está cadastrada.');

    return;
  }

  db.config[tipo] = uniqCfg([
    ...db.config[tipo],
    valor
  ]);

  save();
}


window.excluirConfig = (tipo, valor) => {

  if (
    !confirm(
      `Excluir “${valor}” das opções? Os registros antigos não serão alterados.`
    )
  ) {
    return;
  }

  db.config[tipo] =
    db.config[tipo].filter(x => x !== valor);

  save();
};


/* ======================================================
   PARCELAS
====================================================== */

function addMonthsISO(iso, n) {

  const d = new Date(iso + 'T12:00:00');

  const day = d.getDate();

  d.setDate(1);

  d.setMonth(d.getMonth() + n);

  const last =
    new Date(
      d.getFullYear(),
      d.getMonth() + 1,
      0
    ).getDate();

  d.setDate(Math.min(day, last));

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}


function monthKey(iso) {
  return iso.slice(0, 7);
}


function monthLabel(key) {

  const [y, m] = key.split('-');

  return new Date(
    +y,
    +m - 1,
    1
  ).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric'
  });
}


function schedule(v) {

  return Array.from({
    length: v.parcelas
  }, (_, i) => ({

    numero: i + 1,

    vencimento:
      addMonthsISO(v.primeiraParcela, i),

    valor:
      v.valorParcela,

    pago:
      (v.parcelasPagas || [])
        .includes(i + 1)

  }));
}


function recebidoVenda(v) {

  return v.entrada +
    (v.parcelasPagas || []).length *
    v.valorParcela;
}


function totalVenda(v) {

  return v.entrada +
    v.parcelas *
    v.valorParcela;
}


function proximaParcela(v) {

  return schedule(v)
    .find(p => !p.pago) || null;
}


function concluido(v) {

  return (
    (v.parcelasPagas || []).length >=
    v.parcelas
  );
}


function aprovacaoVendida(a) {

  return db.vendas.some(
    v => v.aprovacaoId === a.id
  );
}


/* ======================================================
   MÁSCARAS
====================================================== */

function maskCPF(el) {

  if (!el) return;

  el.addEventListener('input', e => {

    let v =
      e.target.value
        .replace(/\D/g, '')
        .slice(0, 11);

    v = v
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(
        /(\d{3})(\d{1,2})$/,
        '$1-$2'
      );

    e.target.value = v;

  });
}


function moneyInput(el) {

  if (!el) return;

  el.addEventListener('input', e => {

    const digits =
      e.target.value.replace(/\D/g, '');

    e.target.value =
      digits
        ? money(Number(digits) / 100)
        : '';

    updateSaleSummary();

  });
}


function maskTelefone(el) {

  if (!el) return;

  el.addEventListener('input', e => {

    let v =
      e.target.value
        .replace(/\D/g, '')
        .slice(0, 11);

    if (v.length > 10) {

      v = v.replace(
        /(\d{2})(\d{5})(\d{0,4})/,
        '($1) $2-$3'
      );

    } else if (v.length > 6) {

      v = v.replace(
        /(\d{2})(\d{4})(\d{0,4})/,
        '($1) $2-$3'
      );

    } else if (v.length > 2) {

      v = v.replace(
        /(\d{2})(\d+)/,
        '($1) $2'
      );

    } else if (v.length) {

      v = v.replace(
        /(\d{1,2})/,
        '($1'
      );
    }

    e.target.value = v;

  });
}


/* ======================================================
   CRIAR TELEFONE NA APROVAÇÃO AUTOMATICAMENTE
====================================================== */

function criarCampoTelefoneAprovacao() {

  if ($('#aTelefone')) return;

  const cpf = $('#aCpf');

  if (!cpf) return;

  const campoCPF = cpf.closest('.field');

  if (!campoCPF) return;

  const div = document.createElement('div');

  div.className = 'field';

  div.innerHTML = `
    <label for="aTelefone">
      Telefone
    </label>

    <input
      type="text"
      id="aTelefone"
      placeholder="(12) 99999-9999"
      maxlength="15"
      required
    />
  `;

  campoCPF.insertAdjacentElement(
    'afterend',
    div
  );

  maskTelefone($('#aTelefone'));
}


criarCampoTelefoneAprovacao();


maskCPF($('#aCpf'));

moneyInput($('#aEntrada'));

moneyInput($('#aValorParcela'));

moneyInput($('#vEntrada'));

moneyInput($('#vValorParcela'));

maskTelefone($('#vTelefone'));


$('#vParcelas')
  ?.addEventListener(
    'input',
    updateSaleSummary
  );


$('#vBikesContainer')
  ?.addEventListener('input', () => {

    atualizarQuantidadeBikes();

    updateSaleSummary();

  });


if ($('#btnAdicionarBike')) {

  $('#btnAdicionarBike').onclick = () => {

    const box = $('#vBikesContainer');

    box.insertAdjacentHTML(
      'beforeend',
      bikeVendaHtml(
        {},
        $$('.sale-bike-card').length
      )
    );

    renumerarBikes();

  };
}


renderBicicletasVenda([{}]);


if ($('#vPrimeiraParcela')) {

  $('#vPrimeiraParcela').value =
    addMonthsISO(
      hojeISO(),
      1
    );
}


/* ======================================================
   APROVAÇÃO
====================================================== */

function selecionarStatus(status) {

  $('#statusEscolhido').value = status;

  $('#btnAprovar').classList.toggle(
    'selected',
    status === 'aprovado'
  );

  $('#btnReprovar').classList.toggle(
    'selected',
    status === 'reprovado'
  );
}


$('#btnAprovar').onclick = () =>
  selecionarStatus('aprovado');

$('#btnReprovar').onclick = () =>
  selecionarStatus('reprovado');


$('#aprovacaoForm')
  .addEventListener('submit', e => {

    e.preventDefault();

    const status =
      $('#statusEscolhido').value;

    if (!status) {

      alert(
        'Escolha Aprovar ou Reprovar.'
      );

      return;
    }

    const a = {

      id:
        'a' + Date.now(),

      nome:
        $('#aNome').value.trim(),

      cpf:
        $('#aCpf').value.trim(),

      telefone:
        $('#aTelefone').value.trim(),

      vendedor:
        $('#aVendedor').value.trim(),

      bicicletas:
        +$('#aBicicletas').value,

      entrada:
        parseMoney(
          $('#aEntrada').value
        ),

      parcelas:
        +$('#aParcelas').value,

      valorParcela:
        parseMoney(
          $('#aValorParcela').value
        ),

      status,

      criadoEm:
        new Date().toISOString()

    };


    db.aprovacoes.push(a);


    if (
      a.vendedor &&
      !db.config.vendedores.includes(
        a.vendedor
      )
    ) {

      db.config.vendedores =
        uniqCfg([
          ...db.config.vendedores,
          a.vendedor
        ]);
    }


    save();

    mostrarResultadoAprovacao(a);


    alert(
      status === 'aprovado'
        ? 'Cliente aprovado e salvo. Agora você pode registrar a venda na aba Fazer venda.'
        : 'Resultado reprovado salvo. Nenhum valor foi lançado no financeiro.'
    );

  });


function mostrarResultadoAprovacao(a) {

  const ok =
    a.status === 'aprovado';

  const box =
    $('#resultadoAprovacao');


  box.classList.remove(
    'hidden',
    'result-approved',
    'result-rejected'
  );


  box.classList.add(
    ok
      ? 'result-approved'
      : 'result-rejected'
  );


  $('#resultStatus').innerHTML = `

    <div class="result-icon">
      ${ok ? '✓' : '×'}
    </div>

    <span class="badge ${ok ? 'ok' : 'bad'}">

      ${
        ok
          ? 'CLIENTE APROVADO'
          : 'CLIENTE REPROVADO'
      }

    </span>

    <h2>

      ${
        ok
          ? 'Aprovação concluída'
          : 'Simulação reprovada'
      }

    </h2>

    <p>

      ${
        ok
          ? 'Cliente liberado na simulação para seguir para a etapa de venda.'
          : 'Esta simulação foi marcada como não aprovada.'
      }

    </p>
  `;


  $('#resultGrid').innerHTML = `

    <div class="result-item result-item-client">

      <div class="result-mini-icon">
        👤
      </div>

      <div>

        <span>Cliente</span>

        <strong>
          ${esc(a.nome)}
        </strong>

      </div>

    </div>


    <div class="result-item">

      <div class="result-mini-icon">
        ▣
      </div>

      <div>

        <span>CPF</span>

        <strong>
          ${esc(a.cpf)}
        </strong>

      </div>

    </div>


    <div class="result-item">

      <div class="result-mini-icon">
        ☎
      </div>

      <div>

        <span>Telefone</span>

        <strong>
          ${esc(a.telefone || '-')}
        </strong>

      </div>

    </div>


    <div class="result-item">

      <div class="result-mini-icon">
        ●
      </div>

      <div>

        <span>Vendedor</span>

        <strong>
          ${esc(a.vendedor)}
        </strong>

      </div>

    </div>


    <div class="result-item">

      <div class="result-mini-icon">
        🚲
      </div>

      <div>

        <span>
          Bicicletas aprovadas
        </span>

        <strong>
          ${a.bicicletas}
        </strong>

      </div>

    </div>


    <div class="result-item">

      <div class="result-mini-icon">
        R$
      </div>

      <div>

        <span>
          Entrada aprovada
        </span>

        <strong>
          ${money(a.entrada)}
        </strong>

      </div>

    </div>


    <div class="result-item">

      <div class="result-mini-icon">
        ≡
      </div>

      <div>

        <span>
          Parcelamento
        </span>

        <strong>

          ${a.parcelas}x de
          ${money(a.valorParcela)}

        </strong>

      </div>

    </div>


    <div class="result-item result-total">

      <div class="result-mini-icon">
        $
      </div>

      <div>

        <span>
          Valor total simulado
        </span>

        <strong>

          ${money(
            a.entrada +
            a.parcelas *
            a.valorParcela
          )}

        </strong>

        <small>
          Entrada + todas as parcelas
        </small>

      </div>

    </div>
  `;


  box.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });

}


$('#btnLimparAprovacao').onclick = () => {

  $('#aprovacaoForm').reset();

  $('#aBicicletas').value = 1;

  $('#statusEscolhido').value = '';

  $('#btnAprovar')
    .classList.remove('selected');

  $('#btnReprovar')
    .classList.remove('selected');

  $('#resultadoAprovacao')
    .classList.add('hidden');
};


/* ======================================================
   CLIENTES APROVADOS
====================================================== */

function renderSelectAprovados() {

  const sel = $('#vCliente');

  const atual = sel.value;

  const list =
    db.aprovacoes.filter(
      a =>
        a.status === 'aprovado' &&
        !aprovacaoVendida(a)
    );


  sel.innerHTML = `
    <option value="">
      Selecione um cliente aprovado...
    </option>

    ${list.map(a => `
      <option value="${a.id}">
        ${esc(a.nome)}
        • ${esc(a.cpf)}
        • ${esc(a.vendedor)}
      </option>
    `).join('')}
  `;


  if (
    list.some(
      a => a.id === atual
    )
  ) {

    sel.value = atual;

  }
}


/* ======================================================
   PUXAR DADOS DA APROVAÇÃO PARA VENDA
====================================================== */

$('#vCliente')
  .addEventListener('change', () => {

    const a =
      db.aprovacoes.find(
        x =>
          x.id ===
          $('#vCliente').value
      );


    if (!a) {

      limparCamposVenda(false);

      return;
    }


    $('#vNome').value =
      a.nome;


    $('#vCpf').value =
      a.cpf;


    /* TELEFONE VEM AUTOMATICAMENTE DA APROVAÇÃO */

    $('#vTelefone').value =
      a.telefone || '';


    $('#vEndereco').value =
      '';


    $$(
      'input[name="vTipoEntrega"]'
    ).forEach(
      r => r.checked = false
    );


    $('#vObservacao').value =
      '';


    $('#vVendedor').value =
      a.vendedor || '';


    renderBicicletasVenda(
      Array.from(
        {
          length:
            Math.max(
              1,
              Number(
                a.bicicletas || 1
              )
            )
        },
        () => ({
          quantidade: 1
        })
      )
    );


    $('#vEntrada').value =
      money(a.entrada);


    $('#vParcelas').value =
      a.parcelas;


    $('#vValorParcela').value =
      money(a.valorParcela);


    $('#vPrimeiraParcela').value =
      addMonthsISO(
        hojeISO(),
        1
      );


    updateSaleSummary();

  });


function updateSaleSummary() {

  const ent =
    parseMoney(
      $('#vEntrada').value
    );

  const p =
    +$('#vParcelas').value || 0;

  const vp =
    parseMoney(
      $('#vValorParcela').value
    );


  if (!$('#vCliente').value) {

    $('#saleSummary').textContent =
      'Selecione um cliente aprovado para iniciar a venda.';

    return;
  }


  $('#saleSummary').innerHTML = `

    <strong>
      Resumo da venda:
    </strong>

    entrada de
    ${money(ent)}

    +

    ${p}x de
    ${money(vp)}

    =

    <strong>
      ${money(ent + p * vp)}
    </strong>.

    A entrada será registrada como recebida hoje ao confirmar.
  `;
}


/* ======================================================
   CONFIRMAR VENDA
====================================================== */

$('#vendaForm')
  .addEventListener('submit', e => {

    e.preventDefault();


    const a =
      db.aprovacoes.find(
        x =>
          x.id ===
          $('#vCliente').value
      );


    if (!a) {

      alert(
        'Selecione um cliente aprovado.'
      );

      return;
    }


    if (
      aprovacaoVendida(a)
    ) {

      alert(
        'Este cliente aprovado já foi transformado em venda.'
      );

      return;
    }


    const bicicletasItens =
      coletarBicicletasVenda();


    if (!bicicletasItens.length) {

      alert(
        'Adicione pelo menos uma bicicleta.'
      );

      return;
    }


    const qtdTotal =
      bicicletasItens.reduce(
        (s, b) =>
          s + b.quantidade,
        0
      );


    const primeira =
      bicicletasItens[0] || {};


    const v = {

      id:
        'v' + Date.now(),

      aprovacaoId:
        a.id,

      nome:
        $('#vNome').value.trim(),

      cpf:
        $('#vCpf').value.trim(),

      telefone:
        $('#vTelefone').value.trim(),

      endereco:
        $('#vEndereco').value.trim(),

      tipoEntrega:
        document.querySelector(
          'input[name="vTipoEntrega"]:checked'
        )?.value || '',

      bicicletasItens,

      especificacaoQuadro:
        primeira.especificacaoQuadro || '',

      marca:
        primeira.marca || '',

      cor:
        primeira.cor || '',

      numeracao:
        primeira.numeracao || '',

      observacao:
        $('#vObservacao').value.trim(),

      vendedor:
        $('#vVendedor').value.trim(),

      bicicletas:
        qtdTotal,

      entrada:
        parseMoney(
          $('#vEntrada').value
        ),

      parcelas:
        +$('#vParcelas').value,

      valorParcela:
        parseMoney(
          $('#vValorParcela').value
        ),

      primeiraParcela:
        $('#vPrimeiraParcela').value,

      parcelasPagas:
        [],

      vendidoEm:
        new Date().toISOString()

    };


    db.vendas.push(v);


    if (
      v.vendedor &&
      !db.config.vendedores.includes(
        v.vendedor
      )
    ) {

      db.config.vendedores =
        uniqCfg([
          ...db.config.vendedores,
          v.vendedor
        ]);
    }


    bicicletasItens.forEach(b => {

      if (
        b.marca &&
        !db.config.marcas.includes(
          b.marca
        )
      ) {

        db.config.marcas =
          uniqCfg([
            ...db.config.marcas,
            b.marca
          ]);
      }


      if (
        b.numeracao &&
        !db.config.numeracoes.includes(
          b.numeracao
        )
      ) {

        db.config.numeracoes =
          uniqCfg([
            ...db.config.numeracoes,
            b.numeracao
          ]);
      }


      if (
        b.especificacaoQuadro &&
        !db.config.especificacoes.includes(
          b.especificacaoQuadro
        )
      ) {

        db.config.especificacoes =
          uniqCfg([
            ...db.config.especificacoes,
            b.especificacaoQuadro
          ]);
      }

    });


    db.recebimentos.push({

      id:
        'r' + Date.now(),

      vendaId:
        v.id,

      nome:
        v.nome,

      vendedor:
        v.vendedor,

      tipo:
        'Entrada',

      valor:
        v.entrada,

      data:
        hojeISO(),

      detalhe:
        'Entrada da venda'

    });


    ultimaVendaImpressao =
      v.id;


    save();


    mostrarResultadoVenda(v);


    limparCamposVenda(true);

  });


function limparCamposVenda(
  resetSelect = true
) {

  if (resetSelect) {
    $('#vendaForm').reset();
  }


  [
    '#vNome',
    '#vCpf',
    '#vTelefone',
    '#vEndereco',
    '#vObservacao'
  ].forEach(s => {

    if ($(s)) {
      $(s).value = '';
    }

  });


  renderBicicletasVenda([{}]);


  $('#vPrimeiraParcela').value =
    addMonthsISO(
      hojeISO(),
      1
    );


  $('#saleSummary').textContent =
    'Selecione um cliente aprovado para iniciar a venda.';


  if (resetSelect) {
    renderSelectAprovados();
  }
}


$('#btnLimparVenda').onclick = () =>
  limparCamposVenda(true);


/* ======================================================
   PAINEL FINANCEIRO
====================================================== */

function renderStats() {

  const hoje =
    hojeISO();

  const mesAtual =
    monthKey(hoje);


  const entradasHoje =
    db.recebimentos
      .filter(
        r =>
          r.data === hoje &&
          r.tipo === 'Entrada'
      )
      .reduce(
        (s, r) =>
          s + r.valor,
        0
      );


  const parcelasHoje =
    db.recebimentos
      .filter(
        r =>
          r.data === hoje &&
          r.tipo === 'Parcela'
      )
      .reduce(
        (s, r) =>
          s + r.valor,
        0
      );


  const totalEntradas =
    db.recebimentos
      .filter(
        r => r.tipo === 'Entrada'
      )
      .reduce(
        (s, r) =>
          s + r.valor,
        0
      );


  const totalParcelas =
    db.recebimentos
      .filter(
        r => r.tipo === 'Parcela'
      )
      .reduce(
        (s, r) =>
          s + r.valor,
        0
      );


  const totalGeral =
    totalEntradas +
    totalParcelas;


  const boletosMes =
    db.vendas.reduce(
      (total, v) => {

        const parcelasDoMes =
          schedule(v)
            .filter(
              p =>
                !p.pago &&
                monthKey(
                  p.vencimento
                ) === mesAtual
            );


        return total +
          parcelasDoMes.reduce(
            (s, p) =>
              s +
              Number(
                p.valor || 0
              ),
            0
          );

      },
      0
    );


  const aprovadosPendentes =
    db.aprovacoes.filter(
      a =>
        a.status === 'aprovado' &&
        !aprovacaoVendida(a)
    ).length;


  $('#stats').innerHTML = `

    <div class="stat">

      <span>
        Aprovados aguardando venda
      </span>

      <strong>
        ${aprovadosPendentes}
      </strong>

      <small>
        Ainda não viraram venda
      </small>

    </div>


    <div class="stat">

      <span>
        Entradas recebidas hoje
      </span>

      <strong>
        ${money(entradasHoje)}
      </strong>

      <small>
        Reinicia visualmente à 00:00
      </small>

    </div>


    <div class="stat">

      <span>
        Parcelas recebidas hoje
      </span>

      <strong>
        ${money(parcelasHoje)}
      </strong>

      <small>
        Recebimentos do dia
      </small>

    </div>


    <div class="stat">

      <span>
        Total de boletos do mês
      </span>

      <strong>
        ${money(boletosMes)}
      </strong>

      <small>
        Somente parcelas pendentes com vencimento neste mês
      </small>

    </div>


    <div class="stat">

      <span>
        Total já recebido
      </span>

      <strong>
        ${money(totalGeral)}
      </strong>

      <small>
        Entradas + parcelas já recebidas
      </small>

    </div>


    <div class="stat">

      <span>
        Total recebido em entradas
      </span>

      <strong>
        ${money(totalEntradas)}
      </strong>

      <small>
        Histórico acumulado
      </small>

    </div>


    <div class="stat">

      <span>
        Total recebido em parcelas
      </span>

      <strong>
        ${money(totalParcelas)}
      </strong>

      <small>
        Histórico acumulado
      </small>

    </div>


    <div class="stat">

      <span>
        Vendas ativas
      </span>

      <strong>

        ${
          db.vendas.filter(
            v => !concluido(v)
          ).length
        }

      </strong>

      <small>
        Ainda possuem parcelas
      </small>

    </div>
  `;
}


/* ======================================================
   APROVADOS
====================================================== */

function renderAprovados() {

  const q =
    ($('#buscaAprovado').value || '')
      .toLowerCase();


  const list =
    db.aprovacoes.filter(
      a =>
        a.status === 'aprovado' &&
        `${a.nome} ${a.cpf} ${a.telefone || ''} ${a.vendedor}`
          .toLowerCase()
          .includes(q)
    );


  $('#aprovadosBody').innerHTML =
    list.map(a => {

      const vendida =
        aprovacaoVendida(a);

      return `

        <tr>

          <td>

            <strong>
              ${esc(a.nome)}
            </strong>

            <br>

            <small>

              ${esc(a.cpf)}

              •

              ${esc(
                a.telefone || '-'
              )}

              •

              ${a.bicicletas}
              bike(s)

            </small>

          </td>


          <td>
            ${esc(
              a.vendedor || '-'
            )}
          </td>


          <td>
            ${fmtDate(a.criadoEm)}
          </td>


          <td>

            ${money(a.entrada)}

            +

            ${a.parcelas}x
            ${money(a.valorParcela)}

          </td>


          <td>

            <span class="badge ${vendida ? 'ok' : 'wait'}">

              ${
                vendida
                  ? 'VENDA FEITA'
                  : 'AGUARDANDO VENDA'
              }

            </span>

          </td>


          <td>

            <div class="row-actions">

              ${
                vendida
                  ? ''
                  : `
                    <button
                      class="btn success"
                      onclick="irParaVenda('${a.id}')"
                    >
                      Fazer venda
                    </button>
                  `
              }

              <button
                class="btn danger"
                onclick="excluirAprovacao('${a.id}')"
              >
                Excluir
              </button>

            </div>

          </td>

        </tr>
      `;

    }).join('') ||

    `
      <tr>
        <td colspan="6">
          Nenhum cliente aprovado encontrado.
        </td>
      </tr>
    `;
}


/* ======================================================
   VENDAS
====================================================== */

function renderVendas() {

  const q =
    ($('#buscaVenda').value || '')
      .toLowerCase();


  const list =
    db.vendas.filter(
      v =>
        `${v.nome} ${v.cpf} ${v.telefone || ''} ${v.vendedor}`
          .toLowerCase()
          .includes(q)
    );


  $('#vendasBody').innerHTML =
    list.map(v => {

      const prox =
        proximaParcela(v);

      const rec =
        recebidoVenda(v);

      const falta =
        Math.max(
          0,
          totalVenda(v) - rec
        );

      const done =
        concluido(v);


      return `

        <tr>

          <td>

            <strong>
              ${esc(v.nome)}
            </strong>

            <br>

            <small>

              ${esc(v.cpf)}

              •

              ${quantidadeBicicletasVenda(v)}
              bike(s)

            </small>

          </td>


          <td>

            <strong>
              ${esc(v.vendedor || '-')}
            </strong>

          </td>


          <td>
            ${money(v.entrada)}
          </td>


          <td>

            ${v.parcelas}x

            ${money(v.valorParcela)}

          </td>


          <td>

            ${
              prox
                ? `${prox.numero}ª • ${fmtDate(prox.vencimento)}`
                : '-'
            }

          </td>


          <td>
            ${money(rec)}
          </td>


          <td>
            ${money(falta)}
          </td>


          <td>

            <span class="badge ${done ? 'ok' : 'wait'}">

              ${
                done
                  ? 'QUITADO'
                  : 'ATIVO'
              }

            </span>

          </td>


          <td>

            <div class="row-actions">

              ${
                done
                  ? ''
                  : `
                    <button
                      class="btn success"
                      onclick="abrirPagamento('${v.id}')"
                    >
                      Receber parcela
                    </button>
                  `
              }


              <button
                class="btn secondary"
                onclick="imprimirVenda('${v.id}')"
              >
                Imprimir
              </button>


              <button
                class="btn secondary"
                onclick="detalhesVenda('${v.id}')"
              >
                Detalhes
              </button>


              <button
                class="btn danger"
                onclick="excluirVenda('${v.id}')"
              >
                Excluir
              </button>

            </div>

          </td>

        </tr>
      `;

    }).join('') ||

    `
      <tr>
        <td colspan="9">
          Nenhuma venda confirmada.
        </td>
      </tr>
    `;
}


/* ======================================================
   PREVISÃO MENSAL
====================================================== */

function renderMensal() {

  const base =
    new Date();

  base.setDate(1);


  const months =
    Array.from(
      { length: 12 },
      (_, i) => {

        const d =
          new Date(
            base.getFullYear(),
            base.getMonth() + i,
            1
          );

        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      }
    );


  $('#mensalBody').innerHTML =
    months.map(m => {

      const pend = [];


      db.vendas.forEach(v => {

        schedule(v)
          .filter(
            p =>
              !p.pago &&
              monthKey(
                p.vencimento
              ) === m
          )
          .forEach(
            p =>
              pend.push({
                v,
                p
              })
          );

      });


      return `

        <tr>

          <td>
            <strong>
              ${monthLabel(m)}
            </strong>
          </td>

          <td>

            ${money(
              pend.reduce(
                (s, x) =>
                  s + x.p.valor,
                0
              )
            )}

          </td>

          <td>
            ${pend.length}
            parcela(s)
          </td>

          <td>

            ${
              [
                ...new Set(
                  pend.map(
                    x => x.v.nome
                  )
                )
              ].join(', ') || '-'
            }

          </td>

        </tr>
      `;

    }).join('');
}


/* ======================================================
   HISTÓRICO
====================================================== */

function renderHistorico() {

  const lista =
    [...db.recebimentos]
      .sort(
        (a, b) =>
          b.data.localeCompare(a.data) ||
          String(b.id).localeCompare(
            String(a.id)
          )
      );


  $('#historicoBody').innerHTML =
    lista.map(r => `

      <tr>

        <td>
          ${fmtDate(r.data)}
        </td>

        <td>
          ${esc(r.nome)}
        </td>

        <td>
          ${esc(r.vendedor || '-')}
        </td>

        <td>

          <span class="badge ${r.tipo === 'Entrada' ? 'wait' : 'ok'}">

            ${r.tipo}

          </span>

        </td>

        <td>

          <strong>
            ${money(r.valor)}
          </strong>

        </td>

        <td>
          ${esc(r.detalhe || '-')}
        </td>

        <td>

          <button
            class="btn danger"
            onclick="excluirRecebimento('${r.id}')"
          >
            Excluir lançamento
          </button>

        </td>

      </tr>

    `).join('') ||

    `
      <tr>
        <td colspan="7">
          Nenhum recebimento registrado.
        </td>
      </tr>
    `;
}


/* ======================================================
   AÇÕES
====================================================== */

window.irParaVenda = id => {

  abrirAba('venda');

  renderSelectAprovados();

  $('#vCliente').value = id;

  $('#vCliente')
    .dispatchEvent(
      new Event('change')
    );
};


window.excluirAprovacao = id => {

  const aprovacao =
    db.aprovacoes.find(
      a => a.id === id
    );


  if (
    aprovacaoVendida(
      aprovacao
    )
  ) {

    alert(
      'Esta aprovação já possui uma venda vinculada. Exclua a venda primeiro.'
    );

    return;
  }


  if (
    confirm(
      'Excluir esta aprovação?'
    )
  ) {

    db.aprovacoes =
      db.aprovacoes.filter(
        a => a.id !== id
      );

    save();
  }
};


window.abrirPagamento = id => {

  const v =
    db.vendas.find(
      x => x.id === id
    );


  if (!v) return;


  const p =
    proximaParcela(v);


  if (!p) return;


  vendaPagamentoId =
    id;


  $('#dataPagamento').value =
    hojeISO();


  $('#pagamentoInfo').textContent =

    `${v.nome} • Vendedor: ${v.vendedor || '-'} • ${p.numero}ª parcela • ${money(p.valor)} • vencimento ${fmtDate(p.vencimento)}`;


  $('#modalPagamento')
    .classList.remove('hidden');
};


$('#cancelarPagamento').onclick = () =>

  $('#modalPagamento')
    .classList.add('hidden');


$('#confirmarPagamento').onclick = () => {

  const v =
    db.vendas.find(
      x =>
        x.id ===
        vendaPagamentoId
    );


  if (!v) return;


  const p =
    proximaParcela(v);


  if (!p) return;


  const data =
    $('#dataPagamento').value ||
    hojeISO();


  v.parcelasPagas =
    v.parcelasPagas || [];


  v.parcelasPagas.push(
    p.numero
  );


  db.recebimentos.push({

    id:
      'r' + Date.now(),

    vendaId:
      v.id,

    nome:
      v.nome,

    vendedor:
      v.vendedor,

    tipo:
      'Parcela',

    valor:
      v.valorParcela,

    data,

    parcelaNumero:
      p.numero,

    detalhe:
      `${p.numero}ª de ${v.parcelas} parcelas`

  });


  $('#modalPagamento')
    .classList.add('hidden');


  save();
};


window.detalhesVenda = id => {

  const v =
    db.vendas.find(
      x => x.id === id
    );


  if (!v) return;


  const linhas =
    schedule(v)
      .map(
        p =>
          `${p.numero}ª - ${fmtDate(p.vencimento)} - ${money(p.valor)} - ${p.pago ? 'PAGA' : 'PENDENTE'}`
      )
      .join('\n');


  alert(
`${v.nome}

CPF: ${v.cpf}

Telefone: ${v.telefone || '-'}

Endereço: ${v.endereco || '-'}

Forma de recebimento: ${v.tipoEntrega || '-'}

Vendedor: ${v.vendedor || '-'}

Quantidade total: ${quantidadeBicicletasVenda(v)}

BICICLETAS:

${bikesTexto(v)}

Entrada: ${money(v.entrada)}

Total da venda: ${money(totalVenda(v))}

Observação: ${v.observacao || '-'}

PARCELAS:

${linhas}`
  );
};


window.excluirVenda = id => {

  if (
    !confirm(
      'Excluir esta venda? Os recebimentos já registrados permanecerão no histórico.'
    )
  ) {
    return;
  }


  db.vendas =
    db.vendas.filter(
      v => v.id !== id
    );


  save();
};


/* ======================================================
   EXCLUIR RECEBIMENTO
====================================================== */

window.excluirRecebimento = id => {

  const r =
    db.recebimentos.find(
      x =>
        String(x.id) ===
        String(id)
    );


  if (!r) return;


  const msg =
    r.tipo === 'Parcela'

      ? `Excluir este recebimento de ${money(r.valor)}? A parcela voltará a ficar pendente na venda.`

      : `Excluir esta entrada de ${money(r.valor)} do financeiro?`;


  if (!confirm(msg)) return;


  if (
    r.tipo === 'Parcela' &&
    r.vendaId
  ) {

    const v =
      db.vendas.find(
        x =>
          x.id ===
          r.vendaId
      );


    if (v) {

      let numero =
        Number(
          r.parcelaNumero || 0
        );


      if (!numero) {

        const m =
          String(
            r.detalhe || ''
          ).match(
            /^(\d+)ª/
          );


        if (m) {
          numero =
            Number(m[1]);
        }
      }


      if (
        numero &&
        Array.isArray(
          v.parcelasPagas
        )
      ) {

        v.parcelasPagas =
          v.parcelasPagas.filter(
            n =>
              Number(n) !==
              numero
          );

      }
    }
  }


  db.recebimentos =
    db.recebimentos.filter(
      x =>
        String(x.id) !==
        String(id)
    );


  save();
};


/* ======================================================
   LIMPAR RECEBIMENTOS ÓRFÃOS
====================================================== */

function limparRecebimentosOrfaos() {

  const ids =
    new Set(
      db.vendas.map(
        v => v.id
      )
    );


  const orfaos =
    db.recebimentos.filter(
      r =>
        r.vendaId &&
        !ids.has(
          r.vendaId
        )
    );


  if (!orfaos.length) {

    alert(
      'Não existem recebimentos de vendas excluídas para remover.'
    );

    return;
  }


  const total =
    orfaos.reduce(
      (s, r) =>
        s +
        Number(
          r.valor || 0
        ),
      0
    );


  if (
    !confirm(
      `Foram encontrados ${orfaos.length} lançamento(s) de vendas que já foram excluídas, somando ${money(total)}. Remover esses lançamentos dos totais?`
    )
  ) {
    return;
  }


  const removeIds =
    new Set(
      orfaos.map(
        r =>
          String(r.id)
      )
    );


  db.recebimentos =
    db.recebimentos.filter(
      r =>
        !removeIds.has(
          String(r.id)
        )
    );


  save();


  alert(
    `${orfaos.length} lançamento(s) removido(s). Os totais foram corrigidos.`
  );
}


/* ======================================================
   RESULTADO DA VENDA
====================================================== */

function mostrarResultadoVenda(v) {

  const box =
    $('#resultadoVenda');


  if (!box) return;


  $('#saleResultGrid').innerHTML = `

    <div class="sale-result-item">

      <span>Cliente</span>

      <strong>
        ${esc(v.nome)}
      </strong>

    </div>


    <div class="sale-result-item">

      <span>CPF</span>

      <strong>
        ${esc(v.cpf)}
      </strong>

    </div>


    <div class="sale-result-item">

      <span>Telefone</span>

      <strong>
        ${esc(v.telefone || '-')}
      </strong>

    </div>


    <div class="sale-result-item">

      <span>Vendedor</span>

      <strong>
        ${esc(v.vendedor || '-')}
      </strong>

    </div>


    <div class="sale-result-item full">

      <span>Endereço</span>

      <strong>
        ${esc(v.endereco || '-')}
      </strong>

    </div>


    <div class="sale-result-item">

      <span>
        Forma de recebimento
      </span>

      <strong>
        ${esc(v.tipoEntrega || '-')}
      </strong>

    </div>


    <div class="sale-result-item">

      <span>
        Quantidade total
      </span>

      <strong>
        ${quantidadeBicicletasVenda(v)}
        bicicleta(s)
      </strong>

    </div>


    <div class="sale-result-item full">

      <span>
        Bicicletas da venda
      </span>

      <div class="bike-summary-list">

        ${bikesResultadoHtml(v)}

      </div>

    </div>


    <div class="sale-result-item">

      <span>Entrada</span>

      <strong>
        ${money(v.entrada)}
      </strong>

    </div>


    <div class="sale-result-item">

      <span>
        Parcelamento
      </span>

      <strong>

        ${v.parcelas}x de
        ${money(v.valorParcela)}

      </strong>

    </div>


    <div class="sale-result-item">

      <span>
        1ª parcela
      </span>

      <strong>
        ${fmtDate(v.primeiraParcela)}
      </strong>

    </div>


    <div class="sale-result-item total">

      <span>
        Total da venda
      </span>

      <strong>
        ${money(totalVenda(v))}
      </strong>

    </div>


    <div class="sale-result-item full">

      <span>
        Observação
      </span>

      <strong>
        ${esc(v.observacao || 'Sem observação')}
      </strong>

    </div>
  `;


  box.classList.remove(
    'hidden'
  );


  box.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });
}


/* ======================================================
   IMPRIMIR VENDA
====================================================== */

window.imprimirVenda = id => {

  const v =
    db.vendas.find(
      x => x.id === id
    );


  if (!v) return;


  const parcelas =
    schedule(v)
      .map(p => `

        <tr>

          <td>
            ${p.numero}ª
          </td>

          <td>
            ${fmtDate(p.vencimento)}
          </td>

          <td>
            ${money(p.valor)}
          </td>

          <td>
            ${p.pago ? 'PAGA' : 'PENDENTE'}
          </td>

        </tr>

      `)
      .join('');


  const bikes =
    bicicletasDaVenda(v)
      .map((b, i) => `

        <tr>

          <td>
            ${i + 1}
          </td>

          <td>
            ${esc(b.especificacaoQuadro || '-')}
          </td>

          <td>
            ${esc(b.marca || '-')}
          </td>

          <td>
            ${esc(b.cor || '-')}
          </td>

          <td>
            ${esc(b.numeracao || '-')}
          </td>

          <td>
            ${b.quantidade || 1}
          </td>

        </tr>

      `)
      .join('');


  const w =
    window.open(
      '',
      '_blank',
      'width=900,height=700'
    );


  if (!w) {

    alert(
      'O navegador bloqueou a janela de impressão. Libere pop-ups para este site e tente novamente.'
    );

    return;
  }


  w.document.write(`

<!doctype html>

<html>

<head>

<meta charset="utf-8">

<title>
Venda - ${esc(v.nome)}
</title>

<style>

*{
  box-sizing:border-box
}

body{
  font-family:Arial,sans-serif;
  color:#172033;
  margin:0;
  background:#fff
}

.page{
  max-width:820px;
  margin:0 auto;
  padding:36px
}

.head{
  border-bottom:3px solid #2857e8;
  padding-bottom:18px;
  margin-bottom:22px
}

.head h1{
  margin:0 0 6px;
  font-size:26px
}

.head p{
  margin:0;
  color:#667085
}

.badge{
  display:inline-block;
  background:#e8f8ee;
  color:#14924a;
  padding:7px 11px;
  border-radius:999px;
  font-weight:700;
  font-size:11px;
  margin-bottom:10px
}

.grid{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:10px
}

.item{
  border:1px solid #dde5ef;
  border-radius:10px;
  padding:12px
}

.item.full{
  grid-column:1/-1
}

.item span{
  display:block;
  color:#6f7b8e;
  font-size:11px;
  margin-bottom:5px
}

.item strong{
  font-size:14px
}

.total{
  background:#f2f6ff;
  border-color:#cddaff
}

.total strong{
  font-size:20px;
  color:#173db8
}

h2{
  font-size:17px;
  margin:24px 0 10px
}

table{
  width:100%;
  border-collapse:collapse
}

th,
td{
  border:1px solid #dde5ef;
  padding:9px;
  text-align:left;
  font-size:12px
}

th{
  background:#f5f7fb
}

.obs{
  white-space:pre-wrap;
  line-height:1.5
}

.foot{
  margin-top:28px;
  padding-top:14px;
  border-top:1px solid #ddd;
  font-size:11px;
  color:#667085
}

.no-print{
  margin:20px auto;
  text-align:center
}

.no-print button{
  padding:11px 18px;
  border:0;
  border-radius:8px;
  background:#2857e8;
  color:#fff;
  font-weight:700;
  cursor:pointer
}

@media print{

  .no-print{
    display:none
  }

  .page{
    padding:12px
  }
}

</style>

</head>

<body>

<div class="page">

<div class="head">

<span class="badge">
VENDA FINALIZADA
</span>

<h1>
Comprovante da finalização da venda
</h1>

<p>
Data da venda:
${new Date(v.vendidoEm).toLocaleString('pt-BR')}
</p>

</div>


<div class="grid">


<div class="item">

<span>Cliente</span>

<strong>
${esc(v.nome)}
</strong>

</div>


<div class="item">

<span>CPF</span>

<strong>
${esc(v.cpf)}
</strong>

</div>


<div class="item">

<span>Telefone</span>

<strong>
${esc(v.telefone || '-')}
</strong>

</div>


<div class="item">

<span>Vendedor</span>

<strong>
${esc(v.vendedor || '-')}
</strong>

</div>


<div class="item full">

<span>Endereço</span>

<strong>
${esc(v.endereco || '-')}
</strong>

</div>


<div class="item">

<span>
Forma de recebimento
</span>

<strong>
${esc(v.tipoEntrega || '-')}
</strong>

</div>


<div class="item">

<span>
Quantidade total de bicicletas
</span>

<strong>
${quantidadeBicicletasVenda(v)}
</strong>

</div>


<div class="item">

<span>
Entrada
</span>

<strong>
${money(v.entrada)}
</strong>

</div>


<div class="item">

<span>
Parcelamento
</span>

<strong>
${v.parcelas}x de
${money(v.valorParcela)}
</strong>

</div>


<div class="item">

<span>
1ª parcela
</span>

<strong>
${fmtDate(v.primeiraParcela)}
</strong>

</div>


<div class="item full total">

<span>
Valor total da venda
</span>

<strong>
${money(totalVenda(v))}
</strong>

</div>


<div class="item full">

<span>
Observação
</span>

<strong class="obs">
${esc(v.observacao || 'Sem observação')}
</strong>

</div>

</div>


<h2>
Bicicletas da venda
</h2>


<table>

<thead>

<tr>

<th>#</th>

<th>Especificação</th>

<th>Marca</th>

<th>Cor</th>

<th>Numeração</th>

<th>Qtd.</th>

</tr>

</thead>

<tbody>

${bikes}

</tbody>

</table>


<h2>
Parcelas
</h2>


<table>

<thead>

<tr>

<th>Parcela</th>

<th>Vencimento</th>

<th>Valor</th>

<th>Status</th>

</tr>

</thead>

<tbody>

${parcelas}

</tbody>

</table>


<div class="foot">

Documento gerado pelo controle interno de vendas.

</div>

</div>


<div class="no-print">

<button onclick="window.print()">

Imprimir / Salvar PDF

</button>

</div>

</body>

</html>

`);


  w.document.close();
};


$('#btnImprimirVenda').onclick = () => {

  if (ultimaVendaImpressao) {

    imprimirVenda(
      ultimaVendaImpressao
    );

  }
};


$('#btnIrVendas').onclick = () =>
  abrirAba('vendas');


/* ======================================================
   BICICLETA PARA MONTAGEM
====================================================== */

function tipoEntregaMontagem() {

  const el =
    document.querySelector(
      'input[name="mTipoEntrega"]:checked'
    );

  return el
    ? el.value
    : '';
}


function mostrarResultadoMontagem(m) {

  ultimaMontagemImpressao =
    m.id;


  const box =
    $('#resultadoMontagem');


  if (!box) return;


  $('#montagemResultGrid').innerHTML = `

    <div class="montagem-item full destaque">

      <span>
        Nome do cliente
      </span>

      <strong>
        ${esc(m.nome)}
      </strong>

    </div>


    <div class="montagem-item">

      <span>
        Data de entrega
      </span>

      <strong>
        ${fmtDate(m.dataEntrega)}
      </strong>

    </div>


    <div class="montagem-item">

      <span>
        Recebimento
      </span>

      <strong>

        ${
          m.tipoEntrega === 'Retirada'
            ? '☑ Retirada  ☐ Entrega'
            : '☐ Retirada  ☑ Entrega'
        }

      </strong>

    </div>


    <div class="montagem-item full">

      <span>
        Especificação do quadro
      </span>

      <strong>
        ${esc(m.especificacao)}
      </strong>

    </div>


    <div class="montagem-item">

      <span>
        Cor do quadro
      </span>

      <strong>
        ${esc(m.cor)}
      </strong>

    </div>


    <div class="montagem-item">

      <span>
        Marca
      </span>

      <strong>
        ${esc(m.marca)}
      </strong>

    </div>


    <div class="montagem-item">

      <span>
        Numeração / altura
      </span>

      <strong>
        ${esc(m.numeracao)}
      </strong>

    </div>


    <div class="montagem-item">

      <span>
        Quantidade
      </span>

      <strong>
        ${m.quantidade}
      </strong>

    </div>
  `;


  box.classList.remove(
    'hidden'
  );


  box.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });
}


function imprimirMontagem(id) {

  const m =
    db.montagens.find(
      x => x.id === id
    );


  if (!m) return;


  const retirada =
    m.tipoEntrega === 'Retirada'
      ? 'X'
      : ' ';


  const entrega =
    m.tipoEntrega === 'Entrega'
      ? 'X'
      : ' ';


  const w =
    window.open(
      '',
      '_blank',
      'width=900,height=700'
    );


  if (!w) {

    alert(
      'O navegador bloqueou a janela de impressão. Libere pop-ups e tente novamente.'
    );

    return;
  }


  w.document.write(`

<!doctype html>

<html>

<head>

<meta charset="utf-8">

<title>
Bicicleta para montagem -
${esc(m.nome)}
</title>

<style>

*{
  box-sizing:border-box
}

body{
  font-family:Arial,sans-serif;
  color:#111827;
  margin:0;
  background:#fff
}

.page{
  max-width:820px;
  margin:auto;
  padding:34px
}

.top{
  border-bottom:3px solid #2857e8;
  padding-bottom:18px;
  margin-bottom:22px
}

.badge{
  display:inline-block;
  padding:7px 12px;
  border-radius:999px;
  background:#e8f8ee;
  color:#14924a;
  font-size:11px;
  font-weight:800
}

.top h1{
  margin:10px 0 4px;
  font-size:29px
}

.top p{
  margin:0;
  color:#667085
}

.grid{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:11px
}

.item{
  border:1px solid #dce5ef;
  border-radius:11px;
  padding:13px;
  min-height:62px
}

.item.full{
  grid-column:1/-1
}

.item span{
  display:block;
  color:#667085;
  font-size:11px;
  margin-bottom:6px
}

.item strong{
  font-size:15px
}

.cliente{
  background:#f7faff
}

.choice{
  font-size:16px;
  letter-spacing:.2px
}

.sign{
  margin-top:38px;
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:45px
}

.line{
  padding-top:35px;
  border-bottom:1px solid #555;
  text-align:center
}

.line small{
  display:block;
  transform:translateY(20px);
  color:#667085
}

.no-print{
  text-align:center;
  margin:20px
}

.no-print button{
  border:0;
  border-radius:9px;
  background:#2857e8;
  color:#fff;
  padding:12px 18px;
  font-weight:700;
  cursor:pointer
}

@media print{

  .no-print{
    display:none
  }

  .page{
    padding:10px
  }
}

</style>

</head>

<body>

<div class="page">

<div class="top">

<span class="badge">
BICICLETA PARA MONTAGEM
</span>

<h1>
Ficha de montagem
</h1>

<p>
Data de entrega:
${fmtDate(m.dataEntrega)}
</p>

</div>


<div class="grid">


<div class="item full cliente">

<span>
Nome do cliente
</span>

<strong>
${esc(m.nome)}
</strong>

</div>


<div class="item">

<span>
Data de entrega
</span>

<strong>
${fmtDate(m.dataEntrega)}
</strong>

</div>


<div class="item">

<span>
Forma de recebimento
</span>

<strong class="choice">

Retirada ( ${retirada} )

&nbsp;&nbsp;&nbsp;

Entrega ( ${entrega} )

</strong>

</div>


<div class="item full">

<span>
Especificação do quadro
</span>

<strong>
${esc(m.especificacao)}
</strong>

</div>


<div class="item">

<span>
Cor do quadro
</span>

<strong>
${esc(m.cor)}
</strong>

</div>


<div class="item">

<span>
Marca
</span>

<strong>
${esc(m.marca)}
</strong>

</div>


<div class="item">

<span>
Numeração / altura
</span>

<strong>
${esc(m.numeracao)}
</strong>

</div>


<div class="item">

<span>
Quantidade
</span>

<strong>
${m.quantidade}
</strong>

</div>

</div>


<div class="sign">

<div class="line">

<small>
Responsável pela montagem
</small>

</div>

<div class="line">

<small>
Conferência / entrega
</small>

</div>

</div>

</div>


<div class="no-print">

<button onclick="window.print()">

Imprimir / Salvar PDF

</button>

</div>

</body>

</html>

`);


  w.document.close();
}


window.imprimirMontagem =
  imprimirMontagem;


window.excluirMontagem = id => {

  if (
    confirm(
      'Excluir esta ficha de montagem?'
    )
  ) {

    db.montagens =
      db.montagens.filter(
        m => m.id !== id
      );

    save();
  }
};


/* ======================================================
   LISTA DE MONTAGENS
====================================================== */

function renderMontagens() {

  const body =
    $('#montagensBody');


  if (!body) return;


  const lista =
    [...db.montagens]
      .sort(
        (a, b) =>
          (b.criadoEm || '')
            .localeCompare(
              a.criadoEm || ''
            )
      );


  body.innerHTML =
    lista.map(m => `

      <tr>

        <td>
          <strong>
            ${esc(m.nome)}
          </strong>
        </td>

        <td>
          ${fmtDate(m.dataEntrega)}
        </td>

        <td>

          <span class="badge ${m.tipoEntrega === 'Entrega' ? 'wait' : 'ok'}">

            ${esc(m.tipoEntrega)}

          </span>

        </td>

        <td>

          ${esc(m.especificacao)}

          <br>

          <small>

            ${esc(m.marca)}

            •

            ${esc(m.cor)}

          </small>

        </td>

        <td>
          ${esc(m.numeracao)}
        </td>

        <td>
          ${m.quantidade}
        </td>

        <td>

          <div class="row-actions">

            <button
              class="btn primary"
              onclick="imprimirMontagem('${m.id}')"
            >
              Imprimir
            </button>

            <button
              class="btn danger"
              onclick="excluirMontagem('${m.id}')"
            >
              Excluir
            </button>

          </div>

        </td>

      </tr>

    `).join('') ||

    `
      <tr>
        <td colspan="7">
          Nenhuma ficha de montagem salva.
        </td>
      </tr>
    `;
}


/* ======================================================
   SALVAR MONTAGEM
====================================================== */

$('#montagemForm')
  ?.addEventListener('submit', e => {

    e.preventDefault();


    const tipo =
      tipoEntregaMontagem();


    if (!tipo) {

      alert(
        'Escolha Retirada ou Entrega.'
      );

      return;
    }


    const m = {

      id:
        'm' + Date.now(),

      nome:
        $('#mNome').value.trim(),

      dataEntrega:
        $('#mDataEntrega').value,

      tipoEntrega:
        tipo,

      especificacao:
        $('#mEspecificacao').value.trim(),

      cor:
        $('#mCor').value.trim(),

      marca:
        $('#mMarca').value.trim(),

      numeracao:
        $('#mNumeracao').value.trim(),

      quantidade:
        +$('#mQuantidade').value || 1,

      criadoEm:
        new Date().toISOString()

    };


    db.montagens.push(m);


    if (
      m.marca &&
      !db.config.marcas.includes(
        m.marca
      )
    ) {

      db.config.marcas =
        uniqCfg([
          ...db.config.marcas,
          m.marca
        ]);
    }


    if (
      m.numeracao &&
      !db.config.numeracoes.includes(
        m.numeracao
      )
    ) {

      db.config.numeracoes =
        uniqCfg([
          ...db.config.numeracoes,
          m.numeracao
        ]);
    }


    save();


    mostrarResultadoMontagem(m);

  });


$('#btnLimparMontagem')
  ?.addEventListener(
    'click',
    () => {

      $('#montagemForm').reset();

      $('#mQuantidade').value = 1;

      $('#resultadoMontagem')
        .classList.add(
          'hidden'
        );

    }
  );


$('#btnImprimirMontagem')
  ?.addEventListener(
    'click',
    () => {

      if (
        ultimaMontagemImpressao
      ) {

        imprimirMontagem(
          ultimaMontagemImpressao
        );

      }

    }
  );


/* ======================================================
   CONFIGURAÇÕES - EVENTOS
====================================================== */

$('#formAddVendedor')
  ?.addEventListener(
    'submit',
    e => {

      e.preventDefault();

      adicionarConfig(
        'vendedores',
        $('#cfgVendedor').value
      );

      $('#cfgVendedor').value =
        '';

    }
  );


$('#formAddMarca')
  ?.addEventListener(
    'submit',
    e => {

      e.preventDefault();

      adicionarConfig(
        'marcas',
        $('#cfgMarca').value
      );

      $('#cfgMarca').value =
        '';

    }
  );


$('#formAddEspecificacao')
  ?.addEventListener(
    'submit',
    e => {

      e.preventDefault();

      adicionarConfig(
        'especificacoes',
        $('#cfgEspecificacao').value
      );

      $('#cfgEspecificacao').value =
        '';

    }
  );


$('#formAddNumeracao')
  ?.addEventListener(
    'submit',
    e => {

      e.preventDefault();

      adicionarConfig(
        'numeracoes',
        $('#cfgNumeracao').value
      );

      $('#cfgNumeracao').value =
        '';

    }
  );


$('#btnRecalcularPainel')
  ?.addEventListener(
    'click',
    () => {

      renderAll();

      alert(
        'Painel recalculado com base nos lançamentos atuais.'
      );

    }
  );


$('#btnLimparOrfaos')
  ?.addEventListener(
    'click',
    limparRecebimentosOrfaos
  );


/* ======================================================
   RENDERIZAÇÃO GERAL
====================================================== */

function renderAll() {

  renderStats();

  renderConfiguracoes();

  renderSelectAprovados();

  renderAprovados();

  renderVendas();

  renderMontagens();

  renderMensal();

  renderHistorico();
}


function abrirAba(nome) {

  $$('.tab').forEach(
    x =>
      x.classList.toggle(
        'active',
        x.dataset.tab === nome
      )
  );


  $$('.panel').forEach(
    x =>
      x.classList.toggle(
        'active',
        x.id ===
          'tab-' + nome
      )
  );


  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}


$$('.tab').forEach(
  btn =>
    btn.onclick = () =>
      abrirAba(
        btn.dataset.tab
      )
);


$('#buscaAprovado')
  .addEventListener(
    'input',
    renderAprovados
  );


$('#buscaVenda')
  .addEventListener(
    'input',
    renderVendas
  );


/* ======================================================
   BACKUP
====================================================== */

$('#btnExportar').onclick = () => {

  const blob =
    new Blob(
      [
        JSON.stringify(
          db,
          null,
          2
        )
      ],
      {
        type:
          'application/json'
      }
    );


  const a =
    document.createElement(
      'a'
    );


  a.href =
    URL.createObjectURL(
      blob
    );


  a.download =
    `backup-aprovacoes-vendas-${hojeISO()}.json`;


  a.click();


  URL.revokeObjectURL(
    a.href
  );
};


/* ======================================================
   INICIAR
====================================================== */

save();

setInterval(
  renderStats,
  60000
);
