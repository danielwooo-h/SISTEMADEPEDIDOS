const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PATCH", "PUT", "DELETE"]
    }
});

const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'pedidos.db');

// Função para pegar o IP da rede local
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

// Helper para pegar o horário de Brasília (GMT-3)
function getBrasiliaTime() {
    const agora = new Date();
    // Força o fuso horário de Brasília (America/Sao_Paulo)
    const brasiliaStr = agora.toLocaleString("en-US", {timeZone: "America/Sao_Paulo"});
    return new Date(brasiliaStr);
}

function getBrasiliaISODate() {
    const data = getBrasiliaTime();
    const z = (n) => n.toString().padStart(2, '0');
    return `${data.getFullYear()}-${z(data.getMonth()+1)}-${z(data.getDate())} ${z(data.getHours())}:${z(data.getMinutes())}:${z(data.getSeconds())}`;
}

function getBrasiliaOnlyDate() {
    const data = getBrasiliaTime();
    const z = (n) => n.toString().padStart(2, '0');
    return `${data.getFullYear()}-${z(data.getMonth()+1)}-${z(data.getDate())}`;
}

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// WebSocket Connection
io.on('connection', (socket) => {
    console.log('Um cliente se conectou:', socket.id);
    
    socket.on('disconnect', () => {
        console.log('Um cliente se desconectou:', socket.id);
    });
});

// Inicialização do Banco de Dados
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados:', err.message);
    } else {
        console.log('Conectado ao banco de dados SQLite.');
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS ocorrencias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            numero_pedido TEXT NOT NULL,
            tipo TEXT NOT NULL,
            subgrupo TEXT,
            cliente TEXT,
            endereco_antigo TEXT,
            endereco_novo TEXT,
            observacao TEXT,
            status TEXT DEFAULT 'pendente',
            criado_em DATETIME,
            atualizado_em DATETIME,
            data_operacao DATE
        )`, (err) => {
            if (err) console.error('Erro ao criar tabela:', err.message);
            else console.log('Tabela "ocorrencias" verificada.');
        });

        // Garantir que a coluna subgrupo exista (caso a tabela já existisse sem ela)
        db.run(`ALTER TABLE ocorrencias ADD COLUMN subgrupo TEXT`, (err) => {
            if (err) {
                if (!err.message.includes('duplicate column name')) {
                    console.error('Erro ao adicionar coluna subgrupo:', err.message);
                }
            } else {
                console.log('Coluna "subgrupo" adicionada ao esquema existente.');
            }
        });
    });
}

// Helper para atualizar o campo atualizado_em
const updateTimestamp = (id) => {
    db.run(`UPDATE ocorrencias SET atualizado_em = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
};

// --- API Endpoints ---

// POST /api/ocorrencias - Cria ocorrência
app.post('/api/ocorrencias', (req, res) => {
    let { numero_pedido, tipo, subgrupo, cliente, endereco_antigo, endereco_novo, observacao } = req.body;
    
    // Garantir que tipo e subgrupo sejam strings (caso venham como array do frontend)
    if (Array.isArray(tipo)) tipo = tipo.join(',');
    if (Array.isArray(subgrupo)) subgrupo = subgrupo.join(',');

    const timestamp = getBrasiliaISODate();
    const data_operacao = getBrasiliaOnlyDate();

    const sql = `INSERT INTO ocorrencias (numero_pedido, tipo, subgrupo, cliente, endereco_antigo, endereco_novo, observacao, data_operacao, criado_em, atualizado_em) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    db.run(sql, [numero_pedido, tipo, subgrupo, cliente, endereco_antigo, endereco_novo, observacao, data_operacao, timestamp, timestamp], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        // Emitir evento de novo pedido
        io.emit('atualizar_pedidos');
        
        res.status(201).json({ id: this.lastID, message: 'Ocorrência cadastrada com sucesso!' });
    });
});

// GET /api/ocorrencias/pendentes - Lista pendentes (pendente ou visualizado)
app.get('/api/ocorrencias/pendentes', (req, res) => {
    const sql = `SELECT * FROM ocorrencias WHERE status IN ('pendente', 'visualizado') ORDER BY criado_em ASC`;
    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// GET /api/ocorrencias/historico - Lista histórico (concluido)
app.get('/api/ocorrencias/historico', (req, res) => {
    let sql = `SELECT * FROM ocorrencias WHERE status = 'concluido'`;
    const params = [];

    const { data, tipo } = req.query;
    if (data) {
        sql += ` AND data_operacao = ?`;
        params.push(data);
    }
    if (tipo) {
        sql += ` AND tipo = ?`;
        params.push(tipo);
    }

    sql += ` ORDER BY data_operacao DESC, criado_em DESC`;

    db.all(sql, params, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// PATCH /api/ocorrencias/:id/visualizado - Altera status para visualizado
app.patch('/api/ocorrencias/:id/visualizado', (req, res) => {
    const { id } = req.params;
    const timestamp = getBrasiliaISODate();
    db.run(`UPDATE ocorrencias SET status = 'visualizado', atualizado_em = ? WHERE id = ?`, [timestamp, id], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        // Emitir evento de atualização
        io.emit('atualizar_pedidos');
        
        res.json({ message: 'Status atualizado para visualizado' });
    });
});

// PATCH /api/ocorrencias/:id/concluido - Altera status para concluído
app.patch('/api/ocorrencias/:id/concluido', (req, res) => {
    const { id } = req.params;
    const timestamp = getBrasiliaISODate();
    db.run(`UPDATE ocorrencias SET status = 'concluido', atualizado_em = ? WHERE id = ?`, [timestamp, id], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        // Emitir evento de atualização
        io.emit('atualizar_pedidos');
        
        res.json({ message: 'Status atualizado para concluído' });
    });
});

// PATCH /api/ocorrencias/:id/excluir - Altera status para excluído
app.patch('/api/ocorrencias/:id/excluir', (req, res) => {
    const { id } = req.params;
    const timestamp = getBrasiliaISODate();
    console.log(`Excluindo ocorrência ID: ${id}`);
    db.run(`UPDATE ocorrencias SET status = 'excluido', atualizado_em = ? WHERE id = ?`, [timestamp, id], function(err) {
        if (err) {
            console.error('Erro ao excluir:', err.message);
            return res.status(500).json({ error: err.message });
        }
        
        console.log(`Ocorrência ${id} movida para excluídos. Alterações: ${this.changes}`);
        // Emitir evento de atualização
        io.emit('atualizar_pedidos');
        
        res.json({ message: 'Ocorrência movida para a lixeira' });
    });
});

// PATCH /api/ocorrencias/:id/restaurar - Restaura status para pendente
app.patch('/api/ocorrencias/:id/restaurar', (req, res) => {
    const { id } = req.params;
    const timestamp = getBrasiliaISODate();
    console.log(`Restaurando ocorrência ID: ${id}`);
    db.run(`UPDATE ocorrencias SET status = 'pendente', atualizado_em = ? WHERE id = ?`, [timestamp, id], function(err) {
        if (err) {
            console.error('Erro ao restaurar:', err.message);
            return res.status(500).json({ error: err.message });
        }
        
        console.log(`Ocorrência ${id} restaurada com sucesso. Alterações: ${this.changes}`);
        // Emitir evento de atualização
        io.emit('atualizar_pedidos');
        
        res.json({ message: 'Ocorrência restaurada com sucesso!' });
    });
});

// GET /api/ocorrencias/excluidos - Lista ocorrências excluídas
app.get('/api/ocorrencias/excluidos', (req, res) => {
    console.log('Buscando ocorrências excluídas...');
    const sql = `SELECT * FROM ocorrencias WHERE status = 'excluido' ORDER BY atualizado_em DESC`;
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('Erro ao buscar excluídos:', err.message);
            return res.status(500).json({ error: err.message });
        }
        console.log(`Total de excluídos encontrados: ${rows.length}`);
        res.json(rows);
    });
});

// PATCH /api/ocorrencias/:id - Atualiza dados da ocorrência
app.patch('/api/ocorrencias/:id', (req, res) => {
    handleUpdateOcorrencia(req, res);
});

// PUT /api/ocorrencias/:id - Atualiza dados da ocorrência (fallback para PATCH)
app.put('/api/ocorrencias/:id', (req, res) => {
    handleUpdateOcorrencia(req, res);
});

function handleUpdateOcorrencia(req, res) {
    const { id } = req.params;
    let { numero_pedido, cliente, endereco_antigo, endereco_novo, observacao, tipo, subgrupo } = req.body;
    const timestamp = getBrasiliaISODate();

    // Garantir que tipo e subgrupo sejam strings
    if (Array.isArray(tipo)) tipo = tipo.join(',');
    if (Array.isArray(subgrupo)) subgrupo = subgrupo.join(',');

    console.log(`Recebida solicitação de edição (${req.method}) para o ID: ${id}`);
    console.log('Dados recebidos:', req.body);

    if (!id || !numero_pedido || !tipo) {
        return res.status(400).json({ error: 'Campos obrigatórios faltando (id, numero_pedido ou tipo)' });
    }

    // Primeiro, vamos verificar se o ID existe
    db.get(`SELECT id FROM ocorrencias WHERE id = ?`, [id], (err, row) => {
        if (err) {
            console.error('Erro ao verificar ID no banco de dados:', err.message);
            return res.status(500).json({ error: err.message });
        }

        if (!row) {
            console.warn(`Tentativa de editar ocorrência inexistente. ID: ${id}`);
            // Vamos listar alguns IDs existentes para depuração no log do servidor
            db.all(`SELECT id FROM ocorrencias LIMIT 5`, [], (err, rows) => {
                if (!err) console.log('IDs existentes no banco (primeiros 5):', rows.map(r => r.id));
            });
            return res.status(404).json({ error: `Ocorrência com ID ${id} não encontrada no banco de dados.` });
        }

        const sql = `UPDATE ocorrencias 
                     SET numero_pedido = ?, 
                         cliente = ?, 
                         endereco_antigo = ?, 
                         endereco_novo = ?, 
                         observacao = ?,
                         tipo = ?,
                         subgrupo = ?,
                         atualizado_em = ? 
                     WHERE id = ?`;
        
        db.run(sql, [numero_pedido, cliente, endereco_antigo, endereco_novo, observacao, tipo, subgrupo, timestamp, id], function(err) {
            if (err) {
                console.error('Erro ao atualizar no banco de dados:', err.message);
                return res.status(500).json({ error: err.message });
            }
            
            console.log(`Ocorrência ${id} atualizada com sucesso! Alterações: ${this.changes}`);
            
            // Emitir evento de atualização
            io.emit('atualizar_pedidos');
            
            res.json({ message: 'Ocorrência atualizada com sucesso!' });
        });
    });
}

// Iniciar Servidor
server.listen(PORT, '0.0.0.0', () => {
    const localIP = getLocalIP();
    console.log(`--------------------------------------------------`);
    console.log(`Servidor rodando!`);
    console.log(`Acesso local: http://localhost:${PORT}`);
    console.log(`Acesso na rede: http://${localIP}:${PORT}`);
    console.log(`--------------------------------------------------`);
});
