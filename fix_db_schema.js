const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('pedidos.db');

console.log("Tentando adicionar a coluna 'subgrupo'...");

db.run(`ALTER TABLE ocorrencias ADD COLUMN subgrupo TEXT`, (err) => {
    if (err) {
        if (err.message.includes('duplicate column name')) {
            console.log("A coluna 'subgrupo' já existe.");
        } else {
            console.error("Erro ao adicionar coluna:", err.message);
        }
    } else {
        console.log("Coluna 'subgrupo' adicionada com sucesso!");
    }
    db.close();
});
