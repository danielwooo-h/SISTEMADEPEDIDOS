// --- Configurações ---
const API_URL = '/api/ocorrencias';
let socket;

// Configuração de Subgrupos por Tipo
const SUBGRUPOS_CONFIG = {
    'cancelado': [
        'Cancelamento por cliente',
        'Cancelamento por pagamento',
        'Cancelamento por estoque',
        'Cancelamento por erro de cadastro',
        'Outros'
    ],
    'mudanca_endereco': [
        'Alteração de CEP',
        'Alteração de rua',
        'Alteração de cidade',
        'Correção de endereço'
    ],
    'envio_urgente': [
        'Prioridade alta',
        'Cliente VIP',
        'Erro operacional'
    ],
    'adicionar_unir': [
        'Unir pedidos',
        'Adicionar item'
    ],
    'reenvios': [
        'Extravio',
        'Produto avariado',
        'Produto incorreto',
        'Falha logística'
    ],
    'pagamento_pendente': [
        'Comprovante enviado',
        'Aguardando confirmação',
        'Divergência no pagamento'
    ],
    'estorno': [
        'Estorno parcial',
        'Estorno total',
        'Estorno PIX',
        'Estorno cartão'
    ],
    'devolucao': [
        'Devolução total',
        'Devolução parcial'
    ],
    'suspensao_entrega': [
        'Suspensão solicitada pelo cliente',
        'Suspensão operacional'
    ],
    'outros': [
        'Informação geral',
        'Ajuste manual',
        'Outros'
    ]
};

let pedidosAtuais = []; // Armazena os pedidos pendentes globalmente
let setorAtivo = null; // Controla qual setor está sendo visualizado
let myChart = null; // Instância do gráfico Chart.js

// --- Inicialização ---
document.addEventListener('DOMContentLoaded', () => {
    // Inicializar Socket.io
    socket = io();

    // Ouvir eventos de atualização
    socket.on('atualizar_pedidos', () => {
        console.log('Recebido evento de atualização via Socket.io');
        carregarPendentes();
        const activeTab = document.querySelector('.tab-content.active').id;
        if (activeTab === 'historico') {
            carregarHistorico();
        } else if (activeTab === 'estatisticas') {
            carregarEstatisticas();
        }
    });

    // Configurar seletor de tipos (Atendimento)
    setupTipoSelector();

    // Configurar Modal
    setupModal();

    // Iniciar relógio
    setInterval(atualizarRelogio, 1000);

    // Carregar aba inicial
    showTab('atendimento');

    // Event listener para o formulário
    document.getElementById('form-ocorrencia').addEventListener('submit', handleFormSubmit);
});

function atualizarRelogio() {
    const display = document.getElementById('current-time-display');
    if (display) {
        const agora = new Date();
        display.innerText = agora.toLocaleTimeString('pt-BR');
    }
}

// --- Navegação ---
function showTab(tabId) {
    // Esconder todos os conteúdos
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    // Desativar todos os botões da sidebar
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.remove('active');
    });

    // Mostrar conteúdo selecionado e ativar botão
    document.getElementById(tabId).classList.add('active');
    const btn = document.getElementById(`btn-${tabId}`);
    if (btn) btn.classList.add('active');

    // Atualizar título da página
    const titulos = {
        'atendimento': 'Atendimento',
        'estoque': 'Estoque / Expedição',
        'historico': 'Histórico de Ocorrências',
        'estatisticas': 'Estatísticas do Sistema'
    };
    document.getElementById('page-title').innerText = titulos[tabId] || 'Controle Operacional';

    // Lógica específica por aba
    if (tabId === 'estoque') {
        carregarPendentes();
    } else if (tabId === 'historico') {
        carregarHistorico();
    } else if (tabId === 'estatisticas') {
        carregarEstatisticas();
    }
}

// --- Dashboard de Estoque / Expedição (Navegação) ---
function abrirSetor(setorId) {
    setorAtivo = setorId;
    document.getElementById('setores-selection').classList.add('hidden');
    document.getElementById('setor-dashboard').classList.remove('hidden');
    
    const titulos = {
        'atendimento': 'Setor: Atendimento',
        'financeiro': 'Setor: Financeiro',
        'estoque-expedicao': 'Setor: Estoque / Expedição'
    };
    
    document.getElementById('setor-titulo-exibicao').innerText = titulos[setorId] || 'Setor';
    renderizarCategoriasDoSetor();
}

function voltarParaSetores() {
    setorAtivo = null;
    document.getElementById('setor-dashboard').classList.add('hidden');
    document.getElementById('setores-selection').classList.remove('hidden');
}

function renderizarCategoriasDoSetor() {
    if (!setorAtivo) return;

    const wrapper = document.getElementById('categorias-wrapper');
    wrapper.innerHTML = '';

    const setoresConfig = {
        'atendimento': [
            { id: 'cancelado', label: 'Cancelados', icon: 'fa-times-circle' },
            { id: 'outros', label: 'Outros', icon: 'fa-ellipsis-h' },
            { id: 'multiplas', label: 'Múltiplas Seleções', icon: 'fa-layer-group' }
        ],
        'financeiro': [
            { id: 'estorno', label: 'Estornos', icon: 'fa-exchange-alt' },
            { id: 'pagamento_pendente', label: 'Pagamentos Boleto / Pix', icon: 'fa-dollar-sign' },
            { id: 'multiplas', label: 'Múltiplas Seleções', icon: 'fa-layer-group' }
        ],
        'estoque-expedicao': [
            { id: 'mudanca_endereco', label: 'Mudança de Endereço', icon: 'fa-map-marker-alt' },
            { id: 'envio_urgente', label: 'Envio Urgente', icon: 'fa-bolt' },
            { id: 'adicionar_unir', label: 'Adicionar / Unir', icon: 'fa-plus-circle' },
            { id: 'reenvios', label: 'Reenvios', icon: 'fa-redo' },
            { id: 'devolucao', label: 'Devolução', icon: 'fa-box-open' },
            { id: 'suspensao_entrega', label: 'Suspensão', icon: 'fa-hand-paper' },
            { id: 'outros', label: 'Outros', icon: 'fa-ellipsis-h' },
            { id: 'multiplas', label: 'Múltiplas Seleções', icon: 'fa-layer-group' }
        ]
    };

    const categorias = setoresConfig[setorAtivo] || [];
    let temPedidos = false;

    // Tipos que pertencem ao setor ativo (excluindo a categoria 'multiplas')
    const tiposDesteSetor = categorias.filter(c => c.id !== 'multiplas').map(c => c.id);

    categorias.forEach(cat => {
        const pedidosDaCategoria = pedidosAtuais.filter(p => {
            const tiposDoPedido = (p.tipo || '').split(',').filter(t => t);
            
            if (cat.id === 'multiplas') {
                // Pedidos com 2 ou mais tipos, onde pelo menos um pertence a este setor
                return tiposDoPedido.length >= 2 && tiposDoPedido.some(t => tiposDesteSetor.includes(t));
            } else {
                // Pedidos com exatamente 1 tipo que corresponde a esta categoria
                return tiposDoPedido.length === 1 && tiposDoPedido[0] === cat.id;
            }
        });
        
        if (pedidosDaCategoria.length > 0) {
            temPedidos = true;
            wrapper.appendChild(criarSecaoCategoria(cat, pedidosDaCategoria));
        }
    });

    if (!temPedidos) {
        wrapper.innerHTML = '<div class="setor-empty">Nenhuma ocorrência pendente neste setor.</div>';
    }
}

function criarSecaoCategoria(cat, pedidos) {
    const secao = document.createElement('div');
    secao.className = 'cat-section-v4';
    
    secao.innerHTML = `
        <div class="cat-header-v4">
            <span class="cat-label-v4"><i class="fas ${cat.icon}"></i> ${cat.label}</span>
            <span class="cat-badge-v4">${pedidos.length}</span>
        </div>
        <div class="cat-list-v4"></div>
    `;

    const listContainer = secao.querySelector('.cat-list-v4');

    // Se for Múltiplas Seleções, não agrupar por subgrupo (exibir lista direta)
    if (cat.id === 'multiplas') {
        pedidos.forEach(pedido => {
            listContainer.appendChild(criarCardPedido(pedido));
        });
        return secao;
    }

    // Agrupar pedidos por subgrupo (para categorias normais)
    const subgrupos = {};
    const subgruposValidosDestaCategoria = SUBGRUPOS_CONFIG[cat.id] || [];

    pedidos.forEach(p => {
        const subsDoPedido = (p.subgrupo || '').split(',').filter(s => s);
        
        // Encontrar quais subgrupos deste pedido pertencem a ESTA categoria
        const subsRelacionados = subsDoPedido.filter(s => subgruposValidosDestaCategoria.includes(s));
        
        if (subsRelacionados.length === 0) {
            const sub = 'Outros / Geral';
            if (!subgrupos[sub]) subgrupos[sub] = [];
            subgrupos[sub].push(p);
        } else {
            subsRelacionados.forEach(sub => {
                if (!subgrupos[sub]) subgrupos[sub] = [];
                subgrupos[sub].push(p);
            });
        }
    });

    // Renderizar subgrupos
    Object.keys(subgrupos).sort().forEach(subNome => {
        const subWrapper = document.createElement('div');
        subWrapper.className = 'subgroup-wrapper';
        
        const subHeader = document.createElement('div');
        subHeader.className = 'subgroup-header';
        subHeader.innerHTML = `
            <span class="subgroup-label">${subNome}</span>
            <span class="subgroup-count">(${subgrupos[subNome].length})</span>
        `;
        
        const subList = document.createElement('div');
        subList.className = 'subgroup-list';
        
        subgrupos[subNome].forEach(pedido => {
            subList.appendChild(criarCardPedido(pedido));
        });

        subWrapper.appendChild(subHeader);
        subWrapper.appendChild(subList);
        listContainer.appendChild(subWrapper);
    });

    return secao;
}

function atualizarBadgesIniciais(pedidos) {
    const tipos = {
        'atendimento': ['cancelado', 'outros'],
        'financeiro': ['estorno', 'pagamento_pendente'],
        'estoque-expedicao': ['mudanca_endereco', 'envio_urgente', 'adicionar_unir', 'reenvios', 'devolucao', 'suspensao_entrega', 'outros']
    };

    let totalGeral = pedidos.length;
    const badgeGeral = document.getElementById('nav-badge-total');
    if (badgeGeral) {
        badgeGeral.innerText = totalGeral;
        badgeGeral.style.display = totalGeral > 0 ? 'flex' : 'none';
    }

    Object.keys(tipos).forEach(setor => {
        const count = pedidos.filter(p => {
            const tiposDoPedido = (p.tipo || '').split(',').filter(t => t);
            return tiposDoPedido.some(t => tipos[setor].includes(t));
        }).length;
        const badge = document.getElementById(`badge-${setor}-total`);
        if (badge) {
            if (count > 0) {
                badge.innerText = count;
                badge.style.display = 'block';
            } else {
                badge.style.display = 'none';
            }
        }
    });
}

// --- Atendimento Moderno ---
function setupTipoSelector() {
    const buttons = document.querySelectorAll('.tipo-btn');
    const inputTipo = document.getElementById('tipo');
    const subgrupoContainer = document.getElementById('subgrupo-container');
    const subgrupoSelector = document.getElementById('subgrupo-selector');
    const inputSubgrupo = document.getElementById('subgrupo');

    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Alternar estado ativo (Múltipla Escolha)
            btn.classList.toggle('active');
            const color = btn.getAttribute('data-color');
            
            if (btn.classList.contains('active')) {
                btn.style.backgroundColor = color;
            } else {
                btn.style.backgroundColor = '';
            }

            // Coletar todos os tipos selecionados
            const tiposSelecionados = Array.from(document.querySelectorAll('.tipo-btn.active'))
                .map(b => b.getAttribute('data-value'));
            
            inputTipo.value = tiposSelecionados.join(',');

            // Atualizar Subgrupos Disponíveis
            renderizarSubgruposDisponiveis(tiposSelecionados);

            // Mostrar campos de endereço se necessário
            toggleEnderecoFields();
        });
    });
}

function renderizarSubgruposDisponiveis(tipos) {
    const subgrupoContainer = document.getElementById('subgrupo-container');
    const subgrupoSelector = document.getElementById('subgrupo-selector');
    const inputSubgrupo = document.getElementById('subgrupo');

    if (tipos.length === 0) {
        subgrupoContainer.classList.add('hidden');
        subgrupoSelector.innerHTML = '';
        inputSubgrupo.value = '';
        return;
    }

    // Coletar subgrupos ativos antes de limpar para manter a seleção se possível
    const subgruposAtivos = Array.from(subgrupoSelector.querySelectorAll('.sub-btn.active'))
        .map(b => b.getAttribute('data-value'));

    subgrupoSelector.innerHTML = '';
    let temSubgrupos = false;

    // Criar um Set de subgrupos únicos para evitar duplicatas se múltiplos tipos forem selecionados
    const subgruposParaRenderizar = new Set();
    tipos.forEach(tipo => {
        if (SUBGRUPOS_CONFIG[tipo]) {
            SUBGRUPOS_CONFIG[tipo].forEach(sub => subgruposParaRenderizar.add(sub));
        }
    });

    if (subgruposParaRenderizar.size > 0) {
        temSubgrupos = true;
        subgruposParaRenderizar.forEach(sub => {
            const subBtn = document.createElement('button');
            subBtn.type = 'button';
            subBtn.className = 'sub-btn';
            const isAlreadyActive = subgruposAtivos.includes(sub);
            
            if (isAlreadyActive) subBtn.classList.add('active');
            subBtn.setAttribute('data-value', sub);
            subBtn.innerHTML = `<i class="far ${isAlreadyActive ? 'fa-check-square' : 'fa-square'}"></i> ${sub}`;
            
            subBtn.onclick = () => {
                subBtn.classList.toggle('active');
                const icon = subBtn.querySelector('i');
                if (subBtn.classList.contains('active')) {
                    icon.classList.replace('fa-square', 'fa-check-square');
                } else {
                    icon.classList.replace('fa-check-square', 'fa-square');
                }
                syncSubgrupoInput(subgrupoSelector, inputSubgrupo);
            };
            
            subgrupoSelector.appendChild(subBtn);
        });
    }

    // Sincronizar o input com o estado atual dos botões renderizados
    syncSubgrupoInput(subgrupoSelector, inputSubgrupo);

    if (temSubgrupos) {
        subgrupoContainer.classList.remove('hidden');
    } else {
        subgrupoContainer.classList.add('hidden');
    }
}

function syncSubgrupoInput(container, input) {
    const selecionados = Array.from(container.querySelectorAll('.sub-btn.active'))
        .map(b => b.getAttribute('data-value'));
    input.value = selecionados.join(',');
    console.log(`Subgrupos sincronizados no input: ${input.value}`);
}

function setupModal() {
    const modal = document.getElementById('modal-detalhes');
    const span = document.querySelector('.close-modal');

    if (span) span.onclick = () => modal.style.display = 'none';
    window.onclick = (event) => {
        if (event.target == modal) modal.style.display = 'none';
    };
}

function toggleEnderecoFields() {
    const tipos = document.getElementById('tipo').value.split(',').filter(t => t);
    const camposEndereco = document.getElementById('campos-endereco');
    const endAntigo = document.getElementById('endereco_antigo');
    const endNovo = document.getElementById('endereco_novo');

    if (tipos.includes('mudanca_endereco')) {
        camposEndereco.classList.remove('hidden');
        endAntigo.required = true;
        endNovo.required = true;
    } else {
        camposEndereco.classList.add('hidden');
        endAntigo.required = false;
        endNovo.required = false;
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();

    const tipoValue = document.getElementById('tipo').value;
    if (!tipoValue) {
        alert('Por favor, selecione um Tipo de Ocorrência');
        return;
    }

    // Remover duplicatas antes de enviar
    const tiposUnicos = [...new Set(tipoValue.split(',').filter(t => t))].join(',');
    const subgrupoValue = document.getElementById('subgrupo').value;
    const subgruposUnicos = [...new Set(subgrupoValue.split(',').filter(s => s))].join(',');

    const data = {
        numero_pedido: document.getElementById('numero_pedido').value,
        tipo: tiposUnicos,
        subgrupo: subgruposUnicos,
        cliente: document.getElementById('cliente').value,
        endereco_antigo: document.getElementById('endereco_antigo').value,
        endereco_novo: document.getElementById('endereco_novo').value,
        observacao: document.getElementById('observacao').value
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            exibirMensagemSucesso();
            e.target.reset();
            // Limpar botões de tipo e subgrupo
            document.querySelectorAll('.tipo-btn, .sub-btn').forEach(b => {
                b.classList.remove('active');
                if (b.classList.contains('tipo-btn')) b.style.backgroundColor = '';
            });
            document.getElementById('tipo').value = '';
            document.getElementById('subgrupo-container').classList.add('hidden');
            document.getElementById('subgrupo').value = '';
            document.getElementById('subgrupo-selector').innerHTML = '';
            toggleEnderecoFields();
        } else {
            alert('Erro ao salvar ocorrência');
        }
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro de conexão com o servidor');
    }
}

function exibirMensagemSucesso() {
    const msg = document.getElementById('mensagem-sucesso');
    msg.classList.remove('hidden');
    setTimeout(() => {
        msg.classList.add('hidden');
    }, 3000);
}

// --- API ---
async function carregarPendentes() {
    try {
        const response = await fetch(`${API_URL}/pendentes`);
        const pedidos = await response.json();
        pedidosAtuais = pedidos;
        
        atualizarBadgesIniciais(pedidos);
        
        if (setorAtivo) {
            renderizarCategoriasDoSetor();
        }
    } catch (error) {
        console.error('Erro ao carregar pedidos pendentes:', error);
    }
}

function formatarDataHora(stringData) {
    if (!stringData) return 'N/A';
    // Como o backend agora envia a string já no horário de Brasília,
    // apenas formatamos a exibição da string diretamente para evitar conversões de fuso do navegador.
    try {
        const partes = stringData.split(' '); // [YYYY-MM-DD, HH:mm:ss]
        const dataPartes = partes[0].split('-');
        const horaPartes = partes[1].split(':');
        
        return `${dataPartes[2]}/${dataPartes[1]}/${dataPartes[0]} ${horaPartes[0]}:${horaPartes[1]}`;
    } catch (e) {
        return stringData;
    }
}

function criarCardPedido(pedido) {
    const card = document.createElement('div');
    const statusClass = pedido.status || 'pendente';
    
    // Remover duplicatas de tipos para exibição
    const tiposArray = [...new Set((pedido.tipo || '').split(',').filter(t => t))];
    
    // Usar o primeiro tipo para a classe principal do card, ou 'outros'
    const classePrincipal = tiposArray[0] || 'outros';
    card.className = `card ${classePrincipal} ${statusClass}`;
    
    // Adicionar evento de clique para abrir modal
    card.onclick = () => abrirModalDetalhes(pedido);

    const config = {
        'cancelado': { text: 'Cancelado', class: 'badge-danger', icon: 'fa-times-circle' },
        'mudanca_endereco': { text: 'Endereço', class: 'badge-info', icon: 'fa-map-marker-alt' },
        'envio_urgente': { text: 'Urgente', class: 'badge-urgent', icon: 'fa-bolt' },
        'adicionar_unir': { text: 'Unir', class: 'badge-info', icon: 'fa-plus-circle' },
        'reenvios': { text: 'Reenvio', class: 'badge-warning', icon: 'fa-redo' },
        'pagamento_pendente': { text: 'Pendente', class: 'badge-warning', icon: 'fa-dollar-sign' },
        'devolucao': { text: 'Devolução', class: 'badge-danger', icon: 'fa-box-open' },
        'estorno': { text: 'Estorno', class: 'badge-warning', icon: 'fa-exchange-alt' },
        'lembrete': { text: 'Lembrete', class: 'badge-info', icon: 'fa-sticky-note' },
        'suspensao_entrega': { text: 'Suspender', class: 'badge-danger', icon: 'fa-hand-paper' },
        'manifestacao': { text: 'Manifest.', class: 'badge-warning', icon: 'fa-bullhorn' },
        'protocolo': { text: 'Protocolo', class: 'badge-info', icon: 'fa-file-alt' },
        'outros': { text: 'Outros', class: 'badge-warning', icon: 'fa-ellipsis-h' }
    };

    // Gerar HTML das badges para todos os tipos (usando tiposArray que já removeu duplicatas)
    const badgesHtml = tiposArray.map(t => {
        const c = config[t] || config['outros'];
        return `<div class="card-type-tag ${c.class}" style="margin-bottom: 2px;">
                    <i class="fas ${c.icon}"></i> ${c.text}
                </div>`;
    }).join('');

    card.innerHTML = `
        <div class="card-compact-content">
            <div class="card-id">#${pedido.numero_pedido}</div>
            <div class="card-detail"><b>Cliente:</b> ${pedido.cliente || 'N/A'}</div>
            <div class="card-badges-container">
                ${badgesHtml}
            </div>
            <div style="font-size: 0.75rem; color: #888; margin-top: 5px;">
                <i class="far fa-clock"></i> ${formatarDataHora(pedido.criado_em).split(' ')[1]}
            </div>
        </div>
    `;
    return card;
}

function abrirModalDetalhes(pedido) {
    console.log('Abrindo modal para pedido:', pedido);
    if (!pedido || !pedido.id) {
        console.error('Pedido sem ID:', pedido);
    }
    const modal = document.getElementById('modal-detalhes');
    const body = document.getElementById('modal-body');
    
    const config = {
        'cancelado': 'Cancelamento',
        'mudanca_endereco': 'Mudança de Endereço',
        'envio_urgente': 'Envio Com Urgência',
        'adicionar_unir': 'Adicionar / Unir',
        'reenvios': 'Reenvios',
        'pagamento_pendente': 'Pagamento Boleto/Pix - Enviar',
        'devolucao': 'Devolução',
        'estorno': 'Estornos',
        'lembrete': 'Lembrete',
        'suspensao_entrega': 'Suspensão de Entrega',
        'manifestacao': 'Manifestação',
        'protocolo': 'Protocolo',
        'outros': 'Outros'
    };

    // Remover duplicatas para exibição no modal
    const tiposArray = [...new Set((pedido.tipo || '').split(',').filter(t => t))];
    const subsArray = [...new Set((pedido.subgrupo || '').split(',').filter(s => s))];

    body.innerHTML = `
        <div class="modal-header-actions">
            <h2 style="color: var(--primary-color)">Detalhes da Ocorrência</h2>
            <button onclick="habilitarEdicao()" class="edit-btn-top">
                <i class="fas fa-edit"></i> Editar
            </button>
        </div>
        
        <div id="modal-view-content">
            <div class="modal-detail-row">
                <label>Número do Pedido</label>
                <div class="modal-detail-value"><b>#${pedido.numero_pedido}</b></div>
            </div>

            <div class="modal-detail-row">
                <label>Tipos de Ocorrência</label>
                <div class="modal-detail-value">
                    ${tiposArray.map(t => `<span class="card-type-tag" style="display:inline-block; margin-right:5px; margin-bottom:5px;">${config[t] || t}</span>`).join('')}
                </div>
            </div>

            <div class="modal-detail-row">
                <label>Subgrupos</label>
                <div class="modal-detail-value">
                    ${subsArray.length > 0 ? subsArray.map(s => `<span style="display:inline-block; background:#f1f5f9; padding:2px 8px; border-radius:4px; margin-right:5px; margin-bottom:5px; font-size:0.9rem;">${s}</span>`).join('') : 'Não informado'}
                </div>
            </div>

            <div class="modal-detail-row">
                <label>Cliente</label>
                <div class="modal-detail-value">${pedido.cliente || 'Não informado'}</div>
            </div>

            <div class="modal-detail-row">
            <label>Data e Hora do Cadastro</label>
            <div class="modal-detail-value">${formatarDataHora(pedido.criado_em)}</div>
        </div>

            ${pedido.tipo === 'mudanca_endereco' ? `
                <div class="modal-detail-row">
                    <label>Endereço Antigo</label>
                    <div class="modal-detail-value">${pedido.endereco_antigo}</div>
                </div>
                <div class="modal-detail-row">
                    <label>Endereço Novo</label>
                    <div class="modal-detail-value" style="background: #e8f4fd; padding: 10px; border-radius: 4px; border-left: 4px solid #3498db;">
                        ${pedido.endereco_novo}
                    </div>
                </div>
            ` : ''}

            <div class="modal-detail-row">
                <label>Observação Completa</label>
                <div class="modal-detail-value" style="white-space: pre-wrap;">${pedido.observacao || 'Sem observações.'}</div>
            </div>

            <div class="modal-detail-row">
                <label>Status Atual</label>
                <div class="modal-detail-value"><span class="card-type-tag">${pedido.status.toUpperCase()}</span></div>
            </div>

            <div class="card-actions" style="margin-top: 30px; display: flex; gap: 10px; flex-wrap: wrap;">
                ${pedido.status === 'pendente' ? `
                    <button onclick="marcarVisualizado(${pedido.id}); fecharModal()" class="action-btn viewed">Marcar como Visualizado</button>
                ` : ''}
                <button onclick="marcarConcluido(${pedido.id}); fecharModal()" class="action-btn done">Concluir Pedido</button>
                <button onclick="excluirOcorrencia(${pedido.id}); fecharModal()" class="action-btn delete-btn">
                    <i class="fas fa-trash"></i> Excluir
                </button>
            </div>
        </div>

        <div id="modal-edit-content" class="hidden">
            <form id="form-edit-pedido">
                <div class="form-group">
                    <label>Número do Pedido</label>
                    <input type="text" id="edit-numero-pedido" value="${pedido.numero_pedido}" required>
                </div>
                <div class="form-group">
                    <label>Tipos de Ocorrência</label>
                    <div id="edit-tipo-selector" class="tipo-grid" style="grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));">
                        ${Object.keys(config).map(key => {
                            const isSelected = tiposArray.includes(key);
                            return `
                            <button type="button" class="tipo-btn ${isSelected ? 'active' : ''}" 
                                    data-value="${key}" data-color="${isSelected ? '' : ''}" 
                                    onclick="toggleEditTipo(this, '${key}')"
                                    style="${isSelected ? `background-color: var(--accent-color); color: white;` : ''}">
                                ${config[key]}
                            </button>`;
                        }).join('')}
                    </div>
                    <input type="hidden" id="edit-tipo-pedido" value="${pedido.tipo}">
                </div>
                <div class="form-group">
                    <label>Subgrupos</label>
                    <div id="edit-subgrupo-selector" class="subgrupo-grid">
                        <!-- Será preenchido via JS -->
                    </div>
                    <input type="hidden" id="edit-subgrupo-pedido" value="${pedido.subgrupo}">
                </div>
                <div class="form-group">
                    <label>Cliente</label>
                    <input type="text" id="edit-cliente" value="${pedido.cliente || ''}">
                </div>
                
                <div id="edit-campos-endereco" class="${pedido.tipo === 'mudanca_endereco' ? '' : 'hidden'}">
                    <div class="form-group">
                        <label>Endereço Antigo</label>
                        <textarea id="edit-endereco-antigo">${pedido.endereco_antigo || ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Endereço Novo</label>
                        <textarea id="edit-endereco-novo">${pedido.endereco_novo || ''}</textarea>
                    </div>
                </div>

                <div class="form-group">
                    <label>Observação</label>
                    <textarea id="edit-observacao">${pedido.observacao || ''}</textarea>
                </div>

                <div class="modal-edit-actions">
                    <button type="button" onclick="cancelarEdicao()" class="action-btn cancel">Cancelar</button>
                    <button type="button" onclick="salvarEdicao(${pedido.id})" class="action-btn save">Salvar Alterações</button>
                </div>
            </form>
        </div>
    `;

    modal.style.display = 'block';

    // Inicializar subgrupos na edição
    renderizarEditSubgrupos(tiposArray, subsArray);
}

// Funções Auxiliares para Edição no Modal
function toggleEditTipo(btn, tipo) {
    btn.classList.toggle('active');
    if (btn.classList.contains('active')) {
        btn.style.backgroundColor = 'var(--accent-color)';
        btn.style.color = 'white';
    } else {
        btn.style.backgroundColor = '';
        btn.style.color = '';
    }

    const tiposSelecionados = Array.from(document.querySelectorAll('#edit-tipo-selector .tipo-btn.active'))
        .map(b => b.getAttribute('data-value'));
    
    document.getElementById('edit-tipo-pedido').value = tiposSelecionados.join(',');

    // Atualizar subgrupos disponíveis na edição
    const subsAtuais = document.getElementById('edit-subgrupo-pedido').value.split(',').filter(s => s);
    renderizarEditSubgrupos(tiposSelecionados, subsAtuais);

    // Mostrar/Esconder campos de endereço na edição
    const editEnderecos = document.getElementById('edit-campos-endereco');
    if (tiposSelecionados.includes('mudanca_endereco')) {
        editEnderecos.classList.remove('hidden');
    } else {
        editEnderecos.classList.add('hidden');
    }
}

function renderizarEditSubgrupos(tipos, selecionados) {
    const container = document.getElementById('edit-subgrupo-selector');
    const inputEditSubgrupo = document.getElementById('edit-subgrupo-pedido');
    if (!container) return;
    
    container.innerHTML = '';
    let temSubgrupos = false;

    // Criar Set para subgrupos únicos na edição
    const subgruposParaRenderizar = new Set();
    tipos.forEach(tipo => {
        if (SUBGRUPOS_CONFIG[tipo]) {
            SUBGRUPOS_CONFIG[tipo].forEach(sub => subgruposParaRenderizar.add(sub));
        }
    });

    if (subgruposParaRenderizar.size > 0) {
        temSubgrupos = true;
        subgruposParaRenderizar.forEach(sub => {
            const isSelected = selecionados.includes(sub);
            const subBtn = document.createElement('button');
            subBtn.type = 'button';
            subBtn.className = `sub-btn ${isSelected ? 'active' : ''}`;
            subBtn.innerHTML = `<i class="far ${isSelected ? 'fa-check-square' : 'fa-square'}"></i> ${sub}`;
            
            subBtn.onclick = () => {
                subBtn.classList.toggle('active');
                const icon = subBtn.querySelector('i');
                if (subBtn.classList.contains('active')) {
                    icon.classList.replace('fa-square', 'fa-check-square');
                } else {
                    icon.classList.replace('fa-check-square', 'fa-square');
                }
                syncSubgrupoInput(container, inputEditSubgrupo);
            };
            subBtn.setAttribute('data-value', sub);
            container.appendChild(subBtn);
        });
    }

    // Sincronizar input da edição ao renderizar
    syncSubgrupoInput(container, inputEditSubgrupo);

    if (!temSubgrupos) {
        container.innerHTML = '<p style="color: #888; font-style: italic; font-size: 0.85rem;">Nenhum subgrupo disponível para os tipos selecionados.</p>';
    }
}

function habilitarEdicao() {
    document.getElementById('modal-view-content').classList.add('hidden');
    document.getElementById('modal-edit-content').classList.remove('hidden');
    document.querySelector('.edit-btn-top').classList.add('hidden');
}

function cancelarEdicao() {
    document.getElementById('modal-view-content').classList.remove('hidden');
    document.getElementById('modal-edit-content').classList.add('hidden');
    document.querySelector('.edit-btn-top').classList.remove('hidden');
}

async function salvarEdicao(id) {
    if (!id) {
        console.error('ID da ocorrência não fornecido para salvarEdicao');
        alert('Erro: ID da ocorrência não encontrado.');
        return;
    }

    console.log(`Tentando salvar edição para o ID: ${id}`);

    const tipoValue = document.getElementById('edit-tipo-pedido').value;
    const subgrupoValue = document.getElementById('edit-subgrupo-pedido').value;

    // Remover duplicatas antes de enviar
    const tiposUnicos = [...new Set(tipoValue.split(',').filter(t => t))].join(',');
    const subgruposUnicos = [...new Set(subgrupoValue.split(',').filter(s => s))].join(',');

    const data = {
        numero_pedido: document.getElementById('edit-numero-pedido').value,
        tipo: tiposUnicos,
        subgrupo: subgruposUnicos,
        cliente: document.getElementById('edit-cliente').value,
        endereco_antigo: document.getElementById('edit-endereco-antigo').value,
        endereco_novo: document.getElementById('edit-endereco-novo').value,
        observacao: document.getElementById('edit-observacao').value
    };

    if (!data.numero_pedido || !data.tipo) {
        alert('Número do Pedido e Tipo de Ocorrência são obrigatórios.');
        return;
    }

    console.log('Dados a serem enviados:', data);

    try {
        const response = await fetch(`${API_URL}/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            console.log('Edição salva com sucesso no servidor');
            fecharModal();
            carregarPendentes();
            // Se estiver na aba de histórico, recarregar também
            if (document.getElementById('historico').classList.contains('active')) {
                carregarHistorico();
            }
        } else {
            let errorMessage = 'Erro desconhecido';
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
            } catch (e) {
                errorMessage = `Status ${response.status}: ${response.statusText}`;
            }
            console.error('Erro retornado pelo servidor:', errorMessage);
            alert(`Erro ao salvar alterações: ${errorMessage}`);
        }
    } catch (error) {
        console.error('Erro de conexão ou crash no JS:', error);
        alert('Erro de conexão com o servidor. Verifique se o servidor está rodando.');
    }
}

function fecharModal() {
    document.getElementById('modal-detalhes').style.display = 'none';
}

async function marcarVisualizado(id) {
    try {
        const response = await fetch(`${API_URL}/${id}/visualizado`, { method: 'PATCH' });
        if (response.ok) carregarPendentes();
    } catch (error) {
        console.error('Erro:', error);
    }
}

async function marcarConcluido(id) {
    if (!confirm('Deseja marcar este pedido como concluído?')) return;
    
    try {
        const response = await fetch(`${API_URL}/${id}/concluido`, { method: 'PATCH' });
        if (response.ok) carregarPendentes();
    } catch (error) {
        console.error('Erro:', error);
    }
}

async function excluirOcorrencia(id) {
    console.log(`Solicitando exclusão da ocorrência ID: ${id}`);
    if (!confirm('Deseja realmente excluir esta ocorrência? Ela será movida para a lixeira no histórico.')) return;

    try {
        const response = await fetch(`${API_URL}/${id}/excluir`, { method: 'PATCH' });
        console.log('Resposta do servidor para exclusão:', response.status);
        if (response.ok) {
            console.log('Exclusão confirmada pelo servidor');
            carregarPendentes();
            if (document.getElementById('historico').classList.contains('active')) {
                carregarHistorico();
            }
        } else {
            const errorData = await response.json();
            console.error('Erro ao excluir retornado pelo servidor:', errorData);
            alert(`Erro ao excluir: ${errorData.error || 'Erro desconhecido'}`);
        }
    } catch (error) {
        console.error('Erro de rede ao excluir:', error);
        alert('Erro de conexão ao excluir ocorrência');
    }
}

async function restaurarOcorrencia(id) {
    if (!confirm('Deseja restaurar esta ocorrência para as pendências?')) return;

    try {
        const response = await fetch(`${API_URL}/${id}/restaurar`, { method: 'PATCH' });
        if (response.ok) {
            carregarPendentes();
            carregarHistorico();
        }
    } catch (error) {
        console.error('Erro ao restaurar:', error);
        alert('Erro ao restaurar ocorrência');
    }
}

// --- Histórico ---
async function carregarHistorico() {
    const dataFiltro = document.getElementById('filtro-data').value;
    const tipoFiltro = document.getElementById('filtro-tipo').value;
    
    let url = `${API_URL}/historico?`;
    if (dataFiltro) url += `data=${dataFiltro}&`;
    if (tipoFiltro) url += `tipo=${tipoFiltro}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        renderizarHistorico(data);
        
        // Também carregar excluídos
        carregarExcluidos();
    } catch (error) {
        console.error('Erro ao carregar histórico:', error);
    }
}

async function carregarExcluidos() {
    console.log('carregarExcluidos() chamada');
    try {
        const response = await fetch(`${API_URL}/excluidos?t=${Date.now()}`);
        const data = await response.json();
        console.log('Excluídos recebidos do servidor:', data);
        renderizarExcluidos(data);
    } catch (error) {
        console.error('Erro ao carregar excluídos:', error);
    }
}

function renderizarExcluidos(excluidos) {
    console.log('renderizarExcluidos() com:', excluidos);
    const container = document.getElementById('lista-excluidos');
    if (!container) {
        console.error('ERRO: Elemento lista-excluidos não encontrado no HTML!');
        return;
    }
    container.innerHTML = '';

    if (excluidos.length === 0) {
        container.innerHTML = '<p style="color: #888; font-style: italic;">Nenhuma ocorrência excluída recentemente.</p>';
        return;
    }

    const table = document.createElement('table');
    table.className = 'history-table excluidos-table';
    table.innerHTML = `
        <thead>
            <tr>
                <th>Pedido</th>
                <th>Tipo</th>
                <th>Cliente</th>
                <th>Excluído em</th>
                <th>Ação</th>
            </tr>
        </thead>
        <tbody>
            ${excluidos.map(item => {
                const configNomes = {
                    'cancelado': 'Cancelamento',
                    'mudanca_endereco': 'Mudança Endereço',
                    'envio_urgente': 'Envio Urgente',
                    'adicionar_unir': 'Adicionar/Unir',
                    'reenvios': 'Reenvio',
                    'pagamento_pendente': 'Pagamento Boleto/Pix',
                    'devolucao': 'Devolução',
                    'estorno': 'Estorno',
                    'lembrete': 'Lembrete',
                    'suspensao_entrega': 'Suspensão Entrega',
                    'manifestacao': 'Manifestação',
                    'protocolo': 'Protocolo',
                    'outros': 'Outros'
                };
                const tiposTexto = (item.tipo || '').split(',')
                    .map(t => configNomes[t] || t)
                    .join(', ');
                const subsTexto = (item.subgrupo || '').split(',').join(' • ');

                return `
                <tr>
                    <td>#${item.numero_pedido}</td>
                    <td>
                        ${tiposTexto}<br>
                        <small style="color: #666;">${subsTexto || '-'}</small>
                    </td>
                    <td>${item.cliente || '-'}</td>
                    <td>${formatarDataHora(item.atualizado_em)}</td>
                    <td>
                        <button onclick="restaurarOcorrencia(${item.id})" class="restore-btn" title="Restaurar Ocorrência">
                            <i class="fas fa-undo"></i> Restaurar
                        </button>
                    </td>
                </tr>
                `;
            }).join('')}
        </tbody>
    `;
    container.appendChild(table);
}

function renderizarHistorico(historico) {
    const container = document.getElementById('lista-historico');
    container.innerHTML = '';

    if (historico.length === 0) {
        container.innerHTML = '<p>Nenhum registro encontrado no histórico.</p>';
        return;
    }

    // Agrupar por data
    const grupos = {};
    historico.forEach(item => {
        const data = item.data_operacao;
        if (!grupos[data]) grupos[data] = [];
        grupos[data].push(item);
    });

    // Ordenar datas descendente
    const datasOrdenadas = Object.keys(grupos).sort().reverse();

    datasOrdenadas.forEach(data => {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'history-group';
        
        // Formatar data para exibição
        const dataFormatada = new Date(data + 'T00:00:00').toLocaleDateString('pt-BR');
        
        groupDiv.innerHTML = `
            <div class="history-date-header">${dataFormatada}</div>
            <table class="history-table">
                <thead>
                    <tr>
                        <th>Pedido</th>
                        <th>Tipo</th>
                        <th>Cliente</th>
                        <th>Status</th>
                        <th>Concluído em</th>
                    </tr>
                </thead>
                <tbody>
                    ${grupos[data].map(item => {
                        const configNomes = {
                            'cancelado': 'Cancelamento',
                            'mudanca_endereco': 'Mudança Endereço',
                            'envio_urgente': 'Envio Urgente',
                            'adicionar_unir': 'Adicionar/Unir',
                            'reenvios': 'Reenvio',
                            'pagamento_pendente': 'Pagamento Boleto/Pix',
                            'devolucao': 'Devolução',
                            'estorno': 'Estorno',
                            'lembrete': 'Lembrete',
                            'suspensao_entrega': 'Suspensão Entrega',
                            'manifestacao': 'Manifestação',
                            'protocolo': 'Protocolo',
                            'outros': 'Outros'
                        };
                        
                        const tiposTexto = (item.tipo || '').split(',')
                            .map(t => configNomes[t] || t)
                            .join(', ');

                        return `
                        <tr>
                            <td>#${item.numero_pedido}</td>
                            <td>
                                ${tiposTexto}<br>
                                <small style="color: #666; display: block; margin-top: 4px;">
                                    ${(item.subgrupo || '').split(',').join(' • ') || '-'}
                                </small>
                            </td>
                            <td>${item.cliente || '-'}</td>
                            <td>${item.status}</td>
                            <td>${formatarDataHora(item.atualizado_em)}</td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
        container.appendChild(groupDiv);
    });
}

// --- Estatísticas ---
async function carregarEstatisticas() {
    try {
        // Carregar pendentes e histórico para calcular estatísticas
        const respPendentes = await fetch(`${API_URL}/pendentes`);
        const pendentes = await respPendentes.json();
        
        const respHistorico = await fetch(`${API_URL}/historico`);
        const historico = await respHistorico.json();

        const hoje = new Date().toISOString().split('T')[0];

        // 1. Overview
        const concluidosHoje = historico.filter(p => p.data_operacao === hoje).length;
        const totalHoje = pendentes.filter(p => p.data_operacao === hoje).length + concluidosHoje;
        
        document.getElementById('stat-total-hoje').innerText = totalHoje;
        document.getElementById('stat-concluidos-hoje').innerText = concluidosHoje;
        document.getElementById('stat-pendentes-total').innerText = pendentes.length;

        // 2. Distribuição por Tipo
        const tiposContagem = {};
        pendentes.forEach(p => {
            const tipos = (p.tipo || '').split(',').filter(t => t);
            tipos.forEach(t => {
                tiposContagem[t] = (tiposContagem[t] || 0) + 1;
            });
        });

        const listaTipos = document.getElementById('stats-tipo-lista');
        listaTipos.innerHTML = '';
        
        const labels = {
            'cancelado': 'Cancelados',
            'mudanca_endereco': 'Mudança de Endereço',
            'envio_urgente': 'Envio Urgente',
            'adicionar_unir': 'Adicionar / Unir',
            'reenvios': 'Reenvios',
            'pagamento_pendente': 'Pagamento Boleto/Pix',
            'devolucao': 'Devolução',
            'estorno': 'Estornos',
            'suspensao_entrega': 'Suspensão',
            'outros': 'Outros'
        };

        Object.keys(tiposContagem).sort((a,b) => tiposContagem[b] - tiposContagem[a]).forEach(tipo => {
            const item = document.createElement('div');
            item.className = 'stats-item';
            item.innerHTML = `
                <span>${labels[tipo] || tipo}</span>
                <span class="stats-count">${tiposContagem[tipo]}</span>
            `;
            listaTipos.appendChild(item);
        });

        // 3. Atualizar Gráfico
        renderizarGrafico(tiposContagem, labels);

    } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
    }
}

function renderizarGrafico(contagem, labels) {
    const ctx = document.getElementById('chart-ocorrencias').getContext('2d');
    
    const data = {
        labels: Object.keys(contagem).map(key => labels[key] || key),
        datasets: [{
            label: 'Ocorrências Pendentes',
            data: Object.values(contagem),
            backgroundColor: [
                '#3498db', '#e74c3c', '#2ecc71', '#f1c40f', '#9b59b6',
                '#34495e', '#1abc9c', '#e67e22', '#95a5a6', '#d35400'
            ],
            borderWidth: 1
        }]
    };

    if (myChart) {
        myChart.destroy();
    }

    myChart = new Chart(ctx, {
        type: 'doughnut',
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        font: { size: 11 }
                    }
                }
            }
        },
        data: data
    });
}
