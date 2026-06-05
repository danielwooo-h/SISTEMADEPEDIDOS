const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('pedidos.db');

console.log("Tentando criar a tabela 'recalculos_trocas'...");

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS recalculos_trocas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        numero_pedido TEXT NOT NULL,
        valor REAL NOT NULL,
        justificativa TEXT NOT NULL,
        tipo_solicitacao TEXT NOT NULL,
        status TEXT DEFAULT 'Pendente',
        criado_em DATETIME,
        atualizado_em DATETIME
    )`, (err) => {
        if (err) {
            console.error("Erro ao criar tabela:", err.message);
        } else {
            console.log("Tabela 'recalculos_trocas' criada com sucesso!");
        }
        db.close();
    });
});
