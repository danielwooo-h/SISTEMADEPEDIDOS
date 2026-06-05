const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('pedidos.db');

db.all("PRAGMA table_info(recalculos_trocas)", (err, columns) => {
    if (err) {
        console.error("Erro ao verificar tabela recalculos_trocas:", err);
        return;
    }
    if (columns.length === 0) {
        console.log("A tabela 'recalculos_trocas' NÃO existe!");
    } else {
        console.log("Colunas da tabela recalculos_trocas:");
        columns.forEach(c => console.log(`- ${c.name} (${c.type})`));
    }
    db.close();
});
